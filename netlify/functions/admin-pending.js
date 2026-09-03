const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});

  const token = event.headers['x-admin-token'] || '';
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return json(401, { error: 'Code administrateur invalide.' });
  }

  try {
    // On liste les commandes passées par le devis : chaque Checkout Session
    // porte le mode de paiement choisi et le solde restant dû.
    const sessions = await stripe.checkout.sessions.list({ limit: 100, expand: ['data.customer'] });

    const pending = [];
    for (const s of sessions.data) {
      const m = s.metadata || {};
      if (m.payment_plan !== 'deposit' && m.payment_plan !== 'deposit3x') continue;
      if (s.payment_status !== 'paid') continue;              // acompte non réglé
      if (m.balance_status === 'collected') continue;          // solde déjà encaissé
      const balance = Number(m.balance_due_eur || 0);
      if (!(balance > 0)) continue;

      const customer = s.customer && typeof s.customer === 'object' ? s.customer : null;
      pending.push({
        session_id: s.id,
        created: s.created,
        plan: m.payment_plan,
        customer_id: customer ? customer.id : (typeof s.customer === 'string' ? s.customer : null),
        customer_email: (customer && customer.email) || s.customer_details?.email || '—',
        customer_name: (customer && customer.name) || s.customer_details?.name || '—',
        site_total: Number(m.site_total_eur || 0),
        deposit_paid: Number(m.deposit_paid_eur || 0),
        balance_due: balance,
        installments: Number(m.balance_installments || 1),
      });
    }

    pending.sort((a, b) => b.created - a.created);
    return json(200, { pending });
  } catch (err) {
    console.error('admin-pending:', err.message);
    return json(500, { error: err.message });
  }
};