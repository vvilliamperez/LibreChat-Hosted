const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');

// Cache for price IDs
let priceCache = new Map();

// Initialize price cache on startup
async function initializePriceCache() {
  try {
    const products = [
      process.env.STRIPE_PRODUCT_ID_5,
      process.env.STRIPE_PRODUCT_ID_10,
      process.env.STRIPE_PRODUCT_ID_25
    ];

    for (const productId of products) {
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 1
      });

      if (prices.data.length) {
        priceCache.set(productId, prices.data[0].id);
      }
    }
  } catch (error) {
    logger.error('Error initializing price cache:', error);
  }
}

// Initialize cache when the server starts
initializePriceCache();

// Create a checkout session
router.post('/create-checkout-session', requireJwtAuth, async (req, res) => {
  try {
    const { productId, metadata } = req.body;
    const userId = req.user.id;

    // Get the frontend URL from environment variables with a fallback
    const frontendUrl = process.env.DOMAIN_CLIENT;
    
    // Use the returnUrl from metadata if provided, otherwise use default success/cancel pages
    const successUrl = metadata.returnUrl 
      ? `${metadata.returnUrl}?session_id={CHECKOUT_SESSION_ID}`
      : `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    
    const cancelUrl = metadata.returnUrl 
      ? metadata.returnUrl
      : `${frontendUrl}/cancel`;

    // Get price ID from cache or fetch it
    let priceId = priceCache.get(productId);
    
    if (!priceId) {
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 1
      });

      if (!prices.data.length) {
        throw new Error('No active prices found for this product');
      }

      priceId = prices.data[0].id;
      priceCache.set(productId, priceId);
    }

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
        userId,
        returnUrl: metadata.returnUrl,
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

module.exports = router;