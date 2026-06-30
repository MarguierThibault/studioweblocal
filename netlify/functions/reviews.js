const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  try {
    const store = getStore('swl-reviews');
    if (event.httpMethod === 'GET') {
      let reviews = [];
      try {
        const d = await store.get('list');
        if (d) reviews = JSON.parse(d);
      } catch (e) {}
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ reviews }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { n, av, biz, cat, txt, stars } = body;
      if (!n || !biz || !cat || !txt || !stars) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Champs manquants' }) };
      }
      let reviews = [];
      try {
        const d = await store.get('list');
        if (d) reviews = JSON.parse(d);
      } catch (e) {}
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
      await store.set('list', JSON.stringify(reviews));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, review: r, total: reviews.length }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
