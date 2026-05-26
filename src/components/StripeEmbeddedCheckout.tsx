import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  agencyId?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, agencyId, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const cs = await createCheckoutSession({
      data: {
        priceId,
        agencyId,
        returnUrl: returnUrl || `${window.location.origin}/settings?tab=subscription&checkout=success`,
        environment: getStripeEnvironment(),
      },
    });
    if (!cs) throw new Error("Konnte Checkout-Session nicht erstellen");
    return cs;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
