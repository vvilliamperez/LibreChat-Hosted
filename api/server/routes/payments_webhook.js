const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateUserBalance } = require('~/server/services/UserService');
const Balance = require('~/models/Balance');

// Price ID to token amount mapping (1 USD = 1M tokens)
const PRICE_TO_TOKENS = {
  'prod_S8Xll00KkF8qlY': 5000000, // $5 = 5M tokens
  'prod_S8XlkZMk8dnfdR': 10000000, // $10 = 10M tokens
  'prod_S8XmYxnNpZUuow': 25000000, // $25 = 25M tokens
};

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
        console.log('✅ Session Metadata:', session.metadata);
        console.log('✅ Session id:', session.id);
        
        try {
          // Get the line items to find the purchased product
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          
          // Process each line item
          for (const item of lineItems.data) {
            const priceId = item.price.id;
            const tokensToAdd = PRICE_TO_TOKENS[priceId];
            
            if (tokensToAdd && session.metadata.userId) {
              // Update user's balance
              const balance = await Balance.findOne({ user: session.metadata.userId });
              
              if (balance) {
                // Update existing balance
                balance.tokenCredits += tokensToAdd;
                await balance.save();
                console.log(`✅ Added ${tokensToAdd} tokens to user ${session.metadata.userId}`);
              } else {
                // Create new balance if none exists
                await Balance.create({
                  user: session.metadata.userId,
                  tokenCredits: tokensToAdd
                });
                console.log(`✅ Created new balance with ${tokensToAdd} tokens for user ${session.metadata.userId}`);
              }
            }
          }
        } catch (err) {
          console.error('❌ Error updating user balance:', err);
          return res.status(500).send('Error updating user balance');
        }
      }
  
      res.json({ received: true });
    }
  );

module.exports = router;