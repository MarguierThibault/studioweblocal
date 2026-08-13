const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // Nouveau format "panier" :
    // structural      : { amount, service_name, payment_plan: 'once'|'x4'|'x12' } | null
    //                    → le site / la refonte (un seul à la fois)
    // maintenance_monthly : montant mensuel (€) de l'option Maintenance liée au structural, 0 si absente
    // subscriptions   : [ { amount, service_name } ] → abonnements ajoutés au panier
    //                    (Community Management, Abonnement SEO, Pack Ads géré, Pack Avis clients...)
    const { structural, maintenance_monthly, subscriptions } = JSON.parse(event.body);
    const subs = Array.isArray(subscriptions) ? subscriptions : [];
    const maintenance = Math.max(0, Math.round(Number(maintenance_monthly) || 0));

    const origin = event.headers.origin || 'https://studioweblocal.netlify.app';
    const successUrl = origin + '/?payment=success';
    const cancelUrl = origin + '/?payment=cancel';
    const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    const lineItems = [];
    let hasRecurring = subs.length > 0; // les abonnements du panier sont toujours récurrents
    let installmentsTotal = 0;
    let structuralPlan = 'once';

    // ── Ligne "structurelle" : le site ou la refonte, en 1x ou fractionné en Nx ──
    if (structural && structural.amount > 0) {
      structuralPlan = structural.payment_plan === 'x4' || structural.payment_plan === 'x12' ? structural.payment_plan : 'once';
      const installments = structuralPlan === 'x4' ? 4 : structuralPlan === 'x12' ? 12 : 1;
      installmentsTotal = installments;
      const desc = 'Studio Web Local';

      if (structuralPlan === 'once') {
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: { name: structural.service_name || 'Service Studio Web Local', description: desc },
            unit_amount: Math.max(50, Math.round(Number(structural.amount) * 100)),
          },
          quantity: 1,
        });
      } else {
        hasRecurring = true;
        const perInstallmentCents = Math.max(50, Math.round((Number(structural.amount) * 100) / installments));
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${structural.service_name || 'Studio Web Local'} — paiement en ${installments}x`,
              description: desc,
            },
            unit_amount: perInstallmentCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        });
      }

      // ── Maintenance mensuelle liée au structural, cumulable avec n'importe quel plan ──
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

    // ── Lignes "abonnements" du panier (Community Management, SEO, Ads, Avis clients...) ──
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

    // Stripe ne permet pas de borner un abonnement à N échéances au moment de la
    // création d'une Checkout Session. Quand il y a un plan Nx sur le structural,
    // l'abonnement continue de tourner tant qu'il n'est pas arrêté manuellement —
    // la description ci-dessous sert de pense-bête dans le Dashboard Stripe.
    let subscriptionDescription;
    if (structural && structuralPlan !== 'once') {
      const nowSec = Math.floor(Date.now() / 1000);
      const stopDateLabel = new Date((nowSec + installmentsTotal * 30 * 24 * 60 * 60) * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      subscriptionDescription = `⚠️ Panier avec paiement en ${installmentsTotal}x sur "${structural.service_name}" — à SUPPRIMER après le ${installmentsTotal}e prélèvement (~${stopDateLabel}). Les autres lignes (maintenance / abonnements du panier) sont illimitées et doivent être conservées : retirer uniquement la ligne ${installmentsTotal}x depuis Stripe → cet abonnement → gérer les articles.`;
    } else if (hasRecurring) {
      subscriptionDescription = 'Panier Studio Web Local — abonnement(s) mensuel(s), résiliable(s) à tout moment.';
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
          structural_plan: structural ? structuralPlan : 'none',
          installments_total: String(installmentsTotal),
          has_maintenance: String(maintenance > 0),
          maintenance_monthly: String(maintenance),
          subscriptions_count: String(subs.length),
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