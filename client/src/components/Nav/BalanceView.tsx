import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '~/components';
import { useLocalize, useAuthContext } from '~/hooks';
import { Button } from '~/components/ui';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

const PRODUCT_IDS = {
  FIVE: 'prod_S8Xll00KkF8qlY',
  TEN: 'prod_S8XlkZMk8dnfdR',
  TWENTY_FIVE: 'prod_S8XmYxnNpZUuow',
};


const BalanceBar = ({ balance }) => {
  // Convert tokens to dollars (1M tokens = 1 USD)
  const balanceInDollars = balance / 1000000;
  const percentage = (balanceInDollars / 5) * 100;
  
  return (
    <div className="w-full h-8 bg-gray-200 rounded-lg overflow-hidden">
      <div 
        className="h-full bg-blue-500" 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default function BalanceView({ open, onOpenChange, balance: initialBalance }) {
  const localize = useLocalize();
  const { token, user } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [localBalance, setLocalBalance] = useState(initialBalance);

  // Convert tokens to dollars for display
  const balanceInDollars = localBalance / 1000000;

  const handlePurchase = async (productId: string, dollar_amount: number) => {
    try {
      setIsLoading(true);
      console.log('priceId', productId);
      console.log('token', token);
      console.log('userId', user?.id);

      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          productId: productId,
          metadata: {
            userId: user?.id,
            returnUrl: window.location.href
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { sessionId } = await response.json();
      
      if (sessionId) {
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to initialize');
        }
        const { error } = await stripe.redirectToCheckout({
          sessionId,
        });

        if (error) {
          console.error('Error redirecting to checkout:', error);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        title={localize('com_nav_balance')}
        className="w-[400px] max-w-[90vw] bg-background text-text-primary shadow-2xl"
      >
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_nav_balance')}</OGDialogTitle>
        </OGDialogHeader>
        <div className="flex flex-col items-center gap-4 p-4">
          <div className="text-2xl font-bold">
            {localize('com_nav_balance')}: ${balanceInDollars.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">
            ({localBalance.toLocaleString()} tokens)
          </div>
          
          <div className="w-full">
            <BalanceBar balance={localBalance} />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>$0</span>
              <span>$5</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <Button
              className="w-full"
              onClick={() => handlePurchase(PRODUCT_IDS.FIVE, 5)}
              disabled={isLoading}
            >
              Add $5
            </Button>
            <Button
              className="w-full"
              onClick={() => handlePurchase(PRODUCT_IDS.TEN, 10)}
              disabled={isLoading}
            >
              Add $10
            </Button>
            <Button
              className="w-full"
              onClick={() => handlePurchase(PRODUCT_IDS.TWENTY_FIVE, 25)}
              disabled={isLoading}
            >
              Add $25
            </Button>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
} 