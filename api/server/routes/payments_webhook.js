const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateUserBalance } = require('~/server/services/UserService');
const Balance = require('~/models/Balance');

// Product ID to token amount mapping (1 USD = 1M tokens)
const PROD_ID_TO_TOKENS = {
  [process.env.STRIPE_PRODUCT_ID_5]: 5000000, // $5 = 5M tokens
  [process.env.STRIPE_PRODUCT_ID_10]: 10000000, // $10 = 10M tokens
  [process.env.STRIPE_PRODUCT_ID_25]: 25000000, // $25 = 25M tokens
};

// Handle Stripe webhook
// Required before this route: DO NOT use express.json() or express.urlencoded() before this one!
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }), // Stripe requires raw body for signature verification
    async (req, res) => {


       
       let event;
       let isSecure = true; // False in Local Debug only, NEVER DISABLE THIS IN PROD
       if (isSecure) {
       // Signature check
            const sig = req.headers['stripe-signature'];
            const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
            
            try {
                event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
            } catch (err) {
                console.error('❌ Webhook signature verification failed:', err.message);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }
       }
  
      // ✅ Log event info
      console.log(`✅ Received event: ${event.type}`);
  
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('✅ Session Client Reference ID:', session.client_reference_id);
        console.log('✅ Session id:', session.id);
        
        try {
          // Get the line items to find the purchased product
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          
          // Process each line item
          for (const item of lineItems.data) {
            const productId = item.price.product;
            const tokensToAdd = PROD_ID_TO_TOKENS[productId];
            
            if (tokensToAdd && session.client_reference_id) {
              // Update user's balance
              /*
                !!!!!!!
                TODO
                !!!!!!!: Change this to ensure atomicity
                We need to add this event ID to the transaction to ensure idempotency
                Refactor would look like: add unique events to db, process in the background. 
              */
              const balance = await Balance.findOne({ user: session.client_reference_id });
              
              if (balance) {
                // Update existing balance
                balance.tokenCredits += tokensToAdd;
                await balance.save();
                console.log(`✅ Added ${tokensToAdd} tokens to user ${session.client_reference_id}`);
              } else {
                // Create new balance if none exists
                await Balance.create({
                  user: session.client_reference_id,
                  tokenCredits: tokensToAdd
                });
                console.log(`✅ Created new balance with ${tokensToAdd} tokens for user ${session.client_reference_id}`);
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