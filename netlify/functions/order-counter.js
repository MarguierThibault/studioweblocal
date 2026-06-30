// OPTIONNEL — à placer dans votre dossier netlify/functions/ (à côté de create-payment.js)
// Permet au compteur "créations livrées" d'être PARTAGÉ entre tous les visiteurs,
// au lieu d'augmenter seulement dans le navigateur de la personne qui envoie le devis.
// Sans ce fichier, le site fonctionne quand même : le compteur reste local par visiteur.
// Nécessite le package @netlify/blobs (auto-disponible sur Netlify, sinon : npm install @netlify/blobs)

const { getStore } = require('@netlify/blobs');

const BASE_COUNT = 143;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    const store = getStore('studio-web-local-counters');

    if (event.httpMethod === 'GET') {
      const current = await store.get('orders_total');
      const count = current ? parseInt(current, 10) : BASE_COUNT;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ count }) };
    }

    if (event.httpMethod === 'POST') {
      const current = await store.get('orders_total');
      let count = current ? parseInt(current, 10) : BASE_COUNT;
      count += 1;
      await store.set('orders_total', String(count));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ count }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};