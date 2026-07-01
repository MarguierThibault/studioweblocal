const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

let fallbackReviews = [];

function getStoreSafe() {
  try {
    return getStore('swl-reviews');
  } catch (e) {
    return null;
  }
}

async function loadReviews(store) {
  if (!store) return fallbackReviews;
  try {
    const d = await store.get('list');
    if (d) {
      const parsed = JSON.parse(d);
      if (Array.isArray(parsed)) {
        fallbackReviews = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return fallbackReviews;
}

async function saveReviews(store, reviews) {
  if (store) {
    try {
      await store.set('list', JSON.stringify(reviews));
      fallbackReviews = reviews;
      return true;
    } catch (e) {
      fallbackReviews = reviews;
      return false;
    }
  }
  fallbackReviews = reviews;
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  try {
    const store = getStoreSafe();
    if (event.httpMethod === 'GET') {
      const reviews = await loadReviews(store);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ reviews }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { n, av, biz, cat, txt, stars } = body;
      if (!n || !biz || !cat || !txt || !stars) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Champs manquants' }) };
      }
      const reviews = await loadReviews(store);
      const r = {
        n: String(n).substring(0, 50),
        av: String(av || '?').substring(0, 2).toUpperCase(),
        biz: String(biz).substring(0, 60),
        cat: ['vitrine', 'premium', 'ultra', 'cm'].includes(cat) ? cat : 'vitrine',
        txt: String(txt).substring(0, 400),
        stars: Math.min(5, Math.max(1, Number(stars))),
        days: 1,
        isNew: true
      };
      reviews.unshift(r);
      const persisted = await saveReviews(store, reviews);
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ success: true, review: r, total: reviews.length, fallback: !persisted })
      };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
