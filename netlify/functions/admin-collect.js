const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' },
  body: JSON.stringify(body),
});

// Récupère la carte enregistrée lors de l'acompte et en fait le moyen de
// paiement par défaut du client, pour pouvoir débiter sans le déranger.
async function ensureDefaultCard(customerId, sessionId) {
  const customer = await stripe.customers.retrieve(customerId);
  let pm = customer.invoice_settings && customer.invoice_settings.default_payment_method;
  if (pm) return typeof pm === 'string' ? pm : pm.id;

  // sinon on va chercher la carte utilisée pour l'acompte
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
    if (pi.payment_method) pm = pi.payment_method;
  }
  if (!pm) {
    const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
    if (cards.data.length) pm = cards.data[0].id;
  }
  if (!pm) return null;

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm } });
  return pm;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const token = event.headers['x-admin-token'] || '';
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return json(401, { error: 'Code administrateur invalide.' });
  }

  try {
    // mode : 'once'  -> une facture du solde, débitée immédiatement
    //        '3x'    -> 3 mensualités qui s'arrêtent toutes seules
    const { session_id, customer_id, mode, amount_eur, label } = JSON.parse(event.body || '{}');
    if (!session_id || !customer_id) return json(400, { error: 'Client introuvable pour cette commande.' });
    const total = Math.round(Number(amount_eur) * 100);
    if (!(total > 0)) return json(400, { error: 'Montant du solde invalide.' });

    const pm = await ensureDefaultCard(customer_id, session_id);
    if (!pm) return json(400, { error: "Aucune carte enregistrée pour ce client. Envoie-lui une facture par e-mail depuis Stripe." });

    const title = label || 'Solde du site';

    if (mode === '3x') {
      const perCents = Math.round(total / 3);
      const product = await stripe.products.create({ name: `${title} — solde en 3 mensualités` });
      const nowSec = Math.floor(Date.now() / 1000);
      // 3 prélèvements : aujourd'hui, M+1, M+2 — l'abonnement s'arrête ensuite
      // tout seul grâce à cancel_at, placé juste avant la 4e échéance.
      const cancelAt = nowSec + 3 * 30 * 24 * 60 * 60 - 2 * 24 * 60 * 60;
      const sub = await stripe.subscriptions.create({
        customer: customer_id,
        default_payment_method: pm,
        collection_method: 'charge_automatically',
        cancel_at: cancelAt,
        description: `${title} — 3 mensualités de ${(perCents / 100).toFixed(2)}€, arrêt automatique après la 3e.`,
        items: [{ price_data: { currency: 'eur', product: product.id, unit_amount: perCents, recurring: { interval: 'month' } }, quantity: 1 }],
        metadata: { origin_session: session_id, kind: 'balance_3x', total_eur: String(total / 100) },
      });
      await stripe.checkout.sessions.update(session_id, { metadata: { balance_status: 'collected', balance_subscription: sub.id } }).catch(() => {});
      return json(200, {
        ok: true,
        message: `3 mensualités de ${(perCents / 100).toFixed(2)}€ lancées. La première est prélevée maintenant, l'échéancier s'arrête tout seul après la troisième.`,
        subscription_id: sub.id,
      });
    }

    // Solde en une fois : facture débitée immédiatement sur la carte enregistrée
    await stripe.invoiceItems.create({
      customer: customer_id,
      currency: 'eur',
      amount: total,
      description: `${title} — solde à la livraison`,
    });
    let invoice = await stripe.invoices.create({
      customer: customer_id,
      collection_method: 'charge_automatically',
      default_payment_method: pm,
      auto_advance: true,
      description: `${title} — solde après livraison du site`,
      metadata: { origin_session: session_id, kind: 'balance_once' },
    });
    invoice = await stripe.invoices.finalizeInvoice(invoice.id);
    invoice = await stripe.invoices.pay(invoice.id);

    await stripe.checkout.sessions.update(session_id, { metadata: { balance_status: 'collected', balance_invoice: invoice.id } }).catch(() => {});
    return json(200, {
      ok: true,
      message: `Solde de ${(total / 100).toFixed(2)}€ encaissé. La facture part par e-mail au client.`,
      invoice_id: invoice.id,
      invoice_url: invoice.hosted_invoice_url || null,
    });
  } catch (err) {
    console.error('admin-collect:', err.message);
    return json(500, { error: err.message });
  }
};