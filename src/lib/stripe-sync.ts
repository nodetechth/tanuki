import Stripe from "stripe";
import {
  findBillingByStripeCustomerId,
  updateBillingFromSubscription,
} from "@/lib/billing";

function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function customerIdFromSubscription(subscription: Stripe.Subscription) {
  const customer = subscription.customer;
  return typeof customer === "string" ? customer : customer.id;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = customerIdFromSubscription(subscription);
  const userId =
    subscription.metadata.userId ??
    (await findBillingByStripeCustomerId(customerId))?.userId;

  if (!userId) {
    throw new Error(`User mapping not found for Stripe customer ${customerId}`);
  }

  const subscriptionRecord = subscription as Stripe.Subscription & {
    current_period_end?: number;
    trial_end?: number | null;
  };

  await updateBillingFromSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    trialEndsAt: unixToIso(subscriptionRecord.trial_end),
    currentPeriodEndsAt: unixToIso(subscriptionRecord.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  return userId;
}
