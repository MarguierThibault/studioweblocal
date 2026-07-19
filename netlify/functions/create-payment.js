const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // payment_plan : 'once' | 'x4' | 'x12'. Absent => 'once'.
    // maintenance_monthly : montant mensuel (€) de l'option Maintenance, 0 si non sélectionnée.
    const { amount, service_name, options, is_monthly, payment_plan, maintenance_monthly } = JSON.parse(event.body);
    const desc = options ? String(options).substring(0, 255) : 'Studio Web Local';
    const origin = event.headers.origin || 'https://studioweblocal.netlify.app';
    const successUrl = origin + '/?payment=success';
    const cancelUrl = origin + '/?payment=cancel';
    const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    const maintenance = Math.max(0, Math.round(Number(maintenance_monthly) || 0));

    // ── Abonnement mensuel classique (Community Management) — inchangé ──
    if (is_monthly) {
      const lineItem = {
        price_data: {
          currency: 'eur',
          product_data: { name: service_name || 'Service Studio Web Local', description: desc },
          unit_amount: Math.max(50, Math.round(Number(amount) * 100)),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      };
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [lineItem],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: session.url }) };
    }

    const plan = payment_plan === 'x4' || payment_plan === 'x12' ? payment_plan : 'once';
    const installments = plan === 'x4' ? 4 : plan === 'x12' ? 12 : 1;

    // ── Ligne principale : le site, en 1x ou fractionné en Nx ──
    const lineItems = [];
    if (plan === 'once') {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: service_name || 'Service Studio Web Local', description: desc },
          unit_amount: Math.max(50, Math.round(Number(amount) * 100)),
          // Pas de "recurring" : même en mode subscription, cette ligne n'est
          // facturée qu'une seule fois, sur la toute première facture.
        },
        quantity: 1,
      });
    } else {
      const perInstallmentCents = Math.max(50, Math.round((Number(amount) * 100) / installments));
      // ⚠️ Répartition à parts égales : le total réel peut différer de
      // quelques centimes de celui affiché sur le devis (arrondi).
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${service_name || 'Studio Web Local'} — paiement en ${installments}x`,
            description: desc,
          },
          unit_amount: perInstallmentCents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      });
    }

    // ── Ligne optionnelle : maintenance mensuelle, cumulable avec n'importe quel plan ──
    if (maintenance > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Maintenance mensuelle',
            description: 'Mises à jour et suivi mensuel du site — résiliable à tout moment',
          },
          unit_amount: maintenance * 100,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      });
    }

    const hasRecurring = plan !== 'once' || maintenance > 0;

    // Stripe ne permet pas de borner un abonnement à N échéances au moment
    // de la création d'une Checkout Session (cancel_at n'existe que sur
    // subscriptions.update, une fois l'abonnement déjà créé). Donc quand il
    // y a un plan Nx, l'abonnement continue de tourner tant que tu ne
    // l'arrêtes pas toi-même dans le Dashboard Stripe — la description
    // ci-dessous te rappelle quoi faire, et quand.
    let subscriptionDescription;
    if (plan !== 'once' && maintenance > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const stopDateLabel = new Date((nowSec + installments * 30 * 24 * 60 * 60) * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      subscriptionDescription = `⚠️ ABONNEMENT MIXTE — 2 lignes : "paiement en ${installments}x" (à SUPPRIMER après le ${installments}e prélèvement, ~${stopDateLabel}) + "Maintenance mensuelle" (à GARDER, illimitée). Ne pas annuler tout l'abonnement : retirer uniquement la ligne ${installments}x depuis Stripe → cet abonnement → gérer les articles.`;
    } else if (plan !== 'once') {
      const nowSec = Math.floor(Date.now() / 1000);
      const stopDateLabel = new Date((nowSec + installments * 30 * 24 * 60 * 60) * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      subscriptionDescription = `⚠️ À ANNULER après le ${installments}e prélèvement (~${stopDateLabel}) — paiement en ${installments}x, pas un abonnement classique.`;
    } else {
      subscriptionDescription = 'Maintenance mensuelle Studio Web Local — résiliable à tout moment.';
    }

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: hasRecurring ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    };
    if (hasRecurring) {
      sessionParams.subscription_data = {
        description: subscriptionDescription,
        metadata: {
          installment_plan: plan,
          installments_total: String(installments),
          has_maintenance: String(maintenance > 0),
          maintenance_monthly: String(maintenance),
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};