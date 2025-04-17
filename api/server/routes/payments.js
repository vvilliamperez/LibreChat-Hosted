const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireJwtAuth } = require('~/server/middleware');
const { updateUserBalance } = require('~/server/services/UserService');

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

// Handle Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, tokens } = session.metadata;

    try {
      // Update user balance
      await updateUserBalance(userId, parseInt(tokens));
      console.log(`Updated balance for user ${userId} with ${tokens} tokens`);
    } catch (error) {
      console.error('Error updating user balance:', error);
      // You might want to implement a retry mechanism here
    }
  }

  res.json({ received: true });
});

module.exports = router; 