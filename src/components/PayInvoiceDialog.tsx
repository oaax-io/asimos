import { useEffect, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createInvoicePaymentIntent, markInvoicePaid } from "@/utils/payments.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoiceId: string | null;
  onPaid?: () => void;
}

export function PayInvoiceDialog({ open, onOpenChange, invoiceId, onPaid }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("chf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) {
      setClientSecret(null);
      setError(null);
      return;
    }
    setLoading(true);
    createInvoicePaymentIntent({ data: { invoiceId, environment: getStripeEnvironment() } })
      .then((r) => {
        setClientSecret(r.clientSecret);
        setAmount(r.amount);
        setCurrency(r.currency);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, invoiceId]);

  const fmt = new Intl.NumberFormat("de-CH", { style: "currency", currency: currency.toUpperCase() }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechnung bezahlen</DialogTitle>
          <DialogDescription>
            Sicher bezahlen via Stripe – {amount > 0 ? fmt : "…"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Zahlungsformular …
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {clientSecret && (
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <PayForm
              onSuccess={() => {
                toast.success("Zahlung erfolgreich");
                onPaid?.();
                setTimeout(() => onOpenChange(false), 1200);
              }}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      setErr(error.message ?? "Zahlung fehlgeschlagen");
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      setSucceeded(true);
      onSuccess();
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="font-medium">Zahlung erhalten</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Jetzt bezahlen
      </Button>
    </form>
  );
}
