#!/bin/bash

# Your local webhook URL
WEBHOOK_URL="localhost:3080/api/payments_webhook/webhook"

PRICE_ID="price_1REGgECOnbJ0yGyodFPY4sBe"

# Start listening to Stripe webhooks (in the background)
echo "➡️ Starting Stripe CLI to listen for webhooks..."
stripe listen --forward-to $WEBHOOK_URL &

# Capture the PID so we can kill it later
STRIPE_PID=$!

# Give Stripe CLI a moment to set up the listener
sleep 3

# Trigger a test event with metadata using Stripe CLI
echo "🧪 Triggering test checkout.session.completed event with metadata..."
stripe trigger checkout.session.completed --add payment_intent:data.object.metadata.AccountID=abc123

# Optional: Keep the listener running or stop it
read -p "Press Enter to stop Stripe webhook listener..."

# Stop Stripe CLI listener
kill $STRIPE_PID
echo "🛑 Stripe CLI listener stopped."