const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { amount, service_name, options, is_monthly } = JSON.parse(event.body);
    const desc = options ? String(options).substring(0, 255) : 'Studio Web Local';
    const lineItem = {
      price_data: {
        currency: 'eur',
        product_data: {
          name: service_name || 'Service Studio Web Local',
          description: desc,
        },
        unit_amount: Math.max(50, Math.round(Number(amount) * 100)),
      },
      quantity: 1,
    };
    if (is_monthly) lineItem.price_data.recurring = { interval: 'month' };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: is_monthly ? 'subscription' : 'payment',
      success_url: (event.headers.origin || 'https://studioweblocal.netlify.app') + '/?payment=success',
      cancel_url:  (event.headers.origin || 'https://studioweblocal.netlify.app') + '/?payment=cancel',
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};