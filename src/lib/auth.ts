import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function getRequestUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function getRequestUserId(request: NextRequest) {
  const user = await getRequestUser(request);
  return user?.id ?? null;
}

export function isAdminUser(user: Pick<User, "email"> | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}
