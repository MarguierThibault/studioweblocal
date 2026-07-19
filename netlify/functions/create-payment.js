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

    // ── Paiement comptant en 1 fois, avec ou sans maintenance mensuelle ──
    if (plan === 'once') {
      const lineItems = [{
        price_data: {
          currency: 'eur',
          product_data: { name: service_name || 'Service Studio Web Local', description: desc },
          unit_amount: Math.max(50, Math.round(Number(amount) * 100)),
          // Pas de "recurring" ici : en mode subscription, cette ligne n'est
          // facturée qu'une seule fois, sur la toute première facture.
        },
        quantity: 1,
      }];

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

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        // S'il y a de la maintenance, il faut mode:'subscription' pour que
        // Stripe puisse créer l'abonnement récurrent (le site, lui, ne sera
        // facturé qu'une fois grâce à l'absence de "recurring" ci-dessus).
        // Sans maintenance, on garde 'payment' comme avant.
        mode: maintenance > 0 ? 'subscription' : 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: session.url }) };
    }

    // ── Paiement fractionné (4x ou mensualisé/12) ──
    // Abonnement Stripe borné à N échéances via subscription_data.cancel_at.
    // La maintenance n'est PAS gérée ici : elle est désactivée côté site
    // dès que 4x/12 mois est choisi (impossible techniquement de faire
    // cohabiter, dans UN SEUL abonnement Stripe, un nombre d'échéances
    // limité et un prélèvement mensuel illimité — ça demanderait un second
    // abonnement indépendant créé via webhook après paiement).
    const installments = plan === 'x4' ? 4 : 12;
    const perInstallmentCents = Math.max(50, Math.round((Number(amount) * 100) / installments));
    // ⚠️ Répartition à parts égales : le total réel peut différer de
    // quelques centimes de celui affiché sur le devis (arrondi).
    const nowSec = Math.floor(Date.now() / 1000);
    const oneMonthSec = 30 * 24 * 60 * 60;
    const cancelAt = nowSec + installments * oneMonthSec + 86400; // +1 jour de marge après la dernière échéance

    const lineItem = {
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
    };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'subscription',
      subscription_data: { cancel_at: cancelAt },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
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