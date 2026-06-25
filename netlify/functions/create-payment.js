/**
 * netlify/functions/create-payment.js
 *
 * Crée une session Stripe Checkout dynamique (paiement unique ou abonnement)
 * en fonction de l'offre choisie et des options sélectionnées.
 *
 * Variable d'environnement requise dans Netlify :
 *   STRIPE_SECRET_KEY  →  ta clé secrète Stripe (sk_live_...)
 */

const Stripe = require("stripe");

// En-têtes CORS (nécessaires pour les appels depuis le navigateur)
const CORS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {

  // Réponse au preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Méthode non autorisée" })
    };
  }

  try {
    // ── Lecture du corps de la requête ──────────────────────────
    const { amount, service_name, options, is_monthly } = JSON.parse(event.body);

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Montant invalide" })
      };
    }

    // ── Initialisation de Stripe avec la clé secrète ───────────
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // ── URL de base du site (fournie automatiquement par Netlify) ─
    const siteUrl = process.env.URL || "https://studioweblocal.netlify.app";

    // ── Description visible dans Stripe ───────────────────────
    const description = options
      ? `${service_name} — ${options}`
      : service_name;

    // ── Construction de la session selon le type d'offre ───────
    let sessionConfig;

    if (is_monthly) {
      // Community Management → abonnement mensuel récurrent
      sessionConfig = {
        mode       : "subscription",
        line_items : [{
          price_data: {
            currency     : "eur",
            product_data : { name: service_name, description },
            unit_amount  : amount * 100,          // Stripe travaille en centimes
            recurring    : { interval: "month" }
          },
          quantity: 1
        }],
        success_url : `${siteUrl}/?paiement=ok`,
        cancel_url  : `${siteUrl}/?paiement=annule`,
        metadata    : { service: service_name, options: options || "" }
      };
    } else {
      // Sites Vitrine / Premium / Ultra → paiement unique
      sessionConfig = {
        mode       : "payment",
        line_items : [{
          price_data: {
            currency     : "eur",
            product_data : { name: service_name, description },
            unit_amount  : amount * 100           // Stripe travaille en centimes
          },
          quantity: 1
        }],
        success_url : `${siteUrl}/?paiement=ok`,
        cancel_url  : `${siteUrl}/?paiement=annule`,
        metadata    : { service: service_name, options: options || "" }
      };
    }

    // ── Création de la session Stripe ──────────────────────────
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      headers   : CORS,
      body      : JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error("Stripe error:", err.message);
    return {
      statusCode: 500,
      headers   : CORS,
      body      : JSON.stringify({ error: err.message })
    };
  }
};