const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireJwtAuth } = require('~/server/middleware');

// Create a checkout session
router.post('/create-checkout-session', requireJwtAuth, async (req, res) => {
  try {
    const { productId, metadata } = req.body;
    const userId = req.user.id; // Get user ID from authenticated session

    // Get the frontend URL from environment variables with a fallback
    const frontendUrl = process.env.DOMAIN_CLIENT;
    
    // Use the returnUrl from metadata if provided, otherwise use default success/cancel pages
    const successUrl = metadata.returnUrl 
      ? `${metadata.returnUrl}?session_id={CHECKOUT_SESSION_ID}`
      : `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    
    const cancelUrl = metadata.returnUrl 
      ? metadata.returnUrl
      : `${frontendUrl}/cancel`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            product: productId,
            unit_amount: metadata.amount * 100, // Convert to cents
            currency: 'usd',
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        userId, // Add user ID to metadata
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

module.exports = router;