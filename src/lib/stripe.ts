import Stripe from "stripe";
import { hasStripeEnv } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!hasStripeEnv()) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    });
  }

  return stripeClient;
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}
