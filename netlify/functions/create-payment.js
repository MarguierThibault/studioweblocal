const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DEPOSIT_RATE = 0.4;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // structural : { amount, service_name, payment_plan: 'once' | 'deposit' | 'deposit3x' } | null
    //   once      -> la totalité est encaissée maintenant
    //   deposit   -> 40 % maintenant, le solde encaissé à la livraison
    //   deposit3x -> 40 % maintenant, le solde en 3 mensualités après livraison
    // maintenance_monthly : montant mensuel de la maintenance (0 si absente)
    // subscriptions : [ { amount, service_name } ] -> abonnements du panier
    const { structural, maintenance_monthly, subscriptions } = JSON.parse(event.body);
    const subs = Array.isArray(subscriptions) ? subscriptions : [];
    const maintenance = Math.max(0, Math.round(Number(maintenance_monthly) || 0));

    const origin = event.headers.origin || 'https://studioweblocal.netlify.app';
    const successUrl = origin + '/?payment=success';
    const cancelUrl = origin + '/?payment=cancel';
    const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    const lineItems = [];
    let hasRecurring = subs.length > 0;
    let plan = 'once';
    let depositCents = 0;
    let balanceCents = 0;
    let installments = 0;

    // ── Le site ou la refonte ──
    if (structural && structural.amount > 0) {
      plan = ['once', 'deposit', 'deposit3x'].includes(structural.payment_plan) ? structural.payment_plan : 'once';
      const totalCents = Math.round(Number(structural.amount) * 100);
      const name = structural.service_name || 'Service Studio Web Local';

      if (plan === 'once') {
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: { name, description: 'Studio Web Local — paiement comptant' },
            unit_amount: Math.max(50, totalCents),
          },
          quantity: 1,
        });
      } else {
        depositCents = Math.max(50, Math.round(totalCents * DEPOSIT_RATE));
        balanceCents = totalCents - depositCents;
        installments = plan === 'deposit3x' ? 3 : 1;
        const balanceLabel = plan === 'deposit3x'
          ? `solde de ${(balanceCents / 100).toFixed(2)}€ en 3 mensualités de ${(Math.round(balanceCents / 3) / 100).toFixed(2)}€ après livraison`
          : `solde de ${(balanceCents / 100).toFixed(2)}€ à la livraison`;
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${name} — acompte 40 %`,
              description: `Acompte sur ${name} (total ${(totalCents / 100).toFixed(2)}€) — ${balanceLabel}`,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        });
      }

      // ── Maintenance mensuelle liée au site ──
      if (maintenance > 0) {
        hasRecurring = true;
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
    }

    // ── Abonnements du panier ──
    subs.forEach((s) => {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: s.service_name || 'Abonnement Studio Web Local',
            description: 'Abonnement mensuel — résiliable à tout moment',
          },
          unit_amount: Math.max(50, Math.round(Number(s.amount) * 100)),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      });
    });

    if (lineItems.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Panier vide' }) };
    }

    // Rappel affiché dans le Dashboard Stripe : ce qu'il reste à encaisser.
    let reminder;
    if (plan === 'deposit') {
      reminder = `Acompte 40 % encaissé. RESTE A ENCAISSER : ${(balanceCents / 100).toFixed(2)}€ à la livraison du site, avant remise des accès. La carte du client est enregistrée : Clients > ce client > "Créer un paiement".`;
    } else if (plan === 'deposit3x') {
      reminder = `Acompte 40 % encaissé. RESTE A ENCAISSER : ${(balanceCents / 100).toFixed(2)}€ en 3 mensualités de ${(Math.round(balanceCents / 3) / 100).toFixed(2)}€ après la livraison. La carte du client est enregistrée : créer 3 factures datées M+1, M+2, M+3 en paiement automatique.`;
    }

    const metadata = {
      payment_plan: plan,
      site_total_eur: structural ? String(structural.amount) : '0',
      deposit_paid_eur: depositCents ? String(depositCents / 100) : '0',
      balance_due_eur: balanceCents ? String(balanceCents / 100) : '0',
      balance_installments: String(installments),
      maintenance_monthly: String(maintenance),
      subscriptions_count: String(subs.length),
    };

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: hasRecurring ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (hasRecurring) {
      sessionParams.subscription_data = {
        description: reminder || 'Panier Studio Web Local — abonnement(s) mensuel(s), résiliable(s) à tout moment.',
        metadata,
      };
    } else {
      // Paiement unique : on enregistre la carte pour pouvoir encaisser le solde
      // plus tard sans redemander les coordonnées bancaires au client.
      sessionParams.customer_creation = 'always';
      sessionParams.payment_intent_data = {
        setup_future_usage: 'off_session',
        description: reminder || 'Studio Web Local — paiement comptant',
        metadata,
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