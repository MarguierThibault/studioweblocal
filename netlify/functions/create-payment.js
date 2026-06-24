const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { amount, description, isRecurring } = JSON.parse(event.body);

    console.log('Params reçus:', { amount, description, isRecurring });

    const price = await stripe.prices.create({
      unit_amount: amount * 100,
      currency: 'eur',
      ...(isRecurring ? { recurring: { interval: 'month' } } : {}),
      product_data: { name: description },
    });

    console.log('Price créé:', price.id);

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    console.log('Lien généré:', paymentLink.url);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: paymentLink.url }),
    };

  } catch (err) {
    console.error('ERREUR:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};