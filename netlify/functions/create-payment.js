const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { amount, description, isRecurring } = JSON.parse(event.body);

    const price = await stripe.prices.create({
      unit_amount: amount * 100,
      currency: 'eur',
      ...(isRecurring ? { recurring: { interval: 'month' } } : {}),
      product_data: { name: description },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: paymentLink.url }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
