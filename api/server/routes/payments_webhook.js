const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateUserBalance } = require('~/server/services/UserService');

// Handle Stripe webhook
// Required before this route: DO NOT use express.json() or express.urlencoded() before this one!
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }), // Stripe requires raw body for signature verification
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
      let event;
  
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
  
      // ✅ Log event info
      console.log(`✅ Received event: ${event.type}`);
  
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
  
        // Log full metadata
        console.log('✅ Session Metadata:', session.metadata);
  
        const { userId, tokens, AccountID } = session.metadata || {};
  
        try {
          if (userId && tokens) {
            await updateUserBalance(userId, parseInt(tokens));
            console.log(`💰 Updated balance for user ${userId} with ${tokens} tokens`);
          } else if (AccountID) {
            console.log(`📦 Got AccountID metadata: ${AccountID}`);
            // You can handle AccountID-based logic here
          } else {
            console.warn('⚠️ No expected metadata found in session');
          }
        } catch (error) {
          console.error('❌ Error updating user balance:', error);
        }
      }
  
      res.json({ received: true });
    }
  );

module.exports = router;