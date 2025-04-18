const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireJwtAuth } = require('~/server/middleware');

// Create a checkout session
router.post('/create-checkout-session', requireJwtAuth, async (req, res) => {
  try {
    const { productId, metadata } = req.body;
    const userId = req.user.id; // Get user ID from authenticated session

    console.log('productId', productId);
    console.log('metadata', metadata);
    console.log('userId', userId);  
    // Get the frontend URL from environment variables with a fallback
    const frontendUrl = process.env.DOMAIN_CLIENT;
    
    // Use the returnUrl from metadata if provided, otherwise use default success/cancel pages
    const successUrl = metadata.returnUrl 
      ? `${metadata.returnUrl}?session_id={CHECKOUT_SESSION_ID}`
      : `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    
    const cancelUrl = metadata.returnUrl 
      ? metadata.returnUrl
      : `${frontendUrl}/cancel`;

    // Fetch the first available price for the product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1
    });

    if (!prices.data.length) {
      throw new Error('No active prices found for this product');
    }

    const priceId = prices.data[0].id;

    // Create the session with the server-side user ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId, // Use the server-side verified user ID
        returnUrl: metadata.returnUrl, // Keep the return URL from frontend
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

module.exports = router;