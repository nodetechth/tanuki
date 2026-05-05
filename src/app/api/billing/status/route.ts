import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  }

  const billing = await getBillingState(user.id);
  return NextResponse.json({ billing });
}
