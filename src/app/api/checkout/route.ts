import { NextRequest, NextResponse } from "next/server";
import { getOrCreateBillingRow, updateBillingCustomer } from "@/lib/billing";
import { appUrl } from "@/lib/env";
import { getRequestUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "STRIPE_SECRET_KEY と STRIPE_PRICE_ID が未設定です。設定後に3日間無料体験のCheckoutを開始できます。",
      },
      { status: 501 },
    );
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  }

  const billing = await getOrCreateBillingRow(user.id);
  let customerId = billing.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
      },
    });
    customerId = customer.id;
    await updateBillingCustomer(user.id, customer.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
    },
    subscription_data: {
      trial_period_days: 3,
      metadata: {
        userId: user.id,
      },
    },
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${appUrl()}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
