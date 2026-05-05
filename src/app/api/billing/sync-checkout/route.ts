import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/stripe-sync";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripeが未設定です。" }, { status: 501 });
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.retrieve(body.sessionId);
  if (session.client_reference_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typeof session.subscription !== "string") {
    return NextResponse.json({ error: "Subscription not found" }, { status: 400 });
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  await syncStripeSubscription(subscription);

  return NextResponse.json({ synced: true });
}
