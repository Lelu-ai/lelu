import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function paidPriceId(): string {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error("STRIPE_PRICE_ID is not set — create a recurring Price in the Stripe dashboard and set its ID here.");
  return id;
}
