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
    // Stripe n'autorise PAS de borner un abonnement à N échéances au moment
    // de la création d'une Checkout Session (cancel_at n'existe que sur
    // subscriptions.update, une fois l'abonnement déjà créé — d'où l'erreur
    // "unknown parameter" que tu as eue). Pour l'arrêter automatiquement il
    // faudrait un webhook Stripe qui, une fois l'abonnement créé, appelle
    // subscriptions.update(id, {cancel_at:...}) — je peux le construire si
    // tu veux, mais ça demande de créer un endpoint de webhook + configurer
    // son secret dans Stripe (une étape à faire toi-même côté Dashboard).
    //
    // En attendant : l'abonnement tourne normalement (prélèvement mensuel)
    // et sa description + ses metadata indiquent clairement quand l'annuler
    // à la main dans le Dashboard Stripe (Abonnements > cet abonnement >
    // Annuler l'abonnement).
    const installments = plan === 'x4' ? 4 : 12;
    const perInstallmentCents = Math.max(50, Math.round((Number(amount) * 100) / installments));
    // ⚠️ Répartition à parts égales : le total réel peut différer de
    // quelques centimes de celui affiché sur le devis (arrondi).
    const nowSec = Math.floor(Date.now() / 1000);
    const oneMonthSec = 30 * 24 * 60 * 60;
    const targetStopSec = nowSec + installments * oneMonthSec;
    const stopDateLabel = new Date(targetStopSec * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
      subscription_data: {
        description: `⚠️ À ANNULER après le ${installments}e prélèvement (~${stopDateLabel}) — paiement en ${installments}x, pas un abonnement classique.`,
        metadata: {
          installment_plan: plan,
          installments_total: String(installments),
          auto_cancel_after_unix: String(targetStopSec),
        },
      },
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