import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getOrCreateBillingRow } from "@/lib/billing";
import { appUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripeが未設定です。" }, { status: 501 });
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  }

  const billing = await getOrCreateBillingRow(user.id);
  if (!billing.stripeCustomerId) {
    return NextResponse.json(
      { error: "先に3日間無料体験を開始してください。" },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: appUrl(),
  });

  return NextResponse.json({ url: session.url });
}
