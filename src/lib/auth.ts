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

export async function isAdminUser(user: Pick<User, "id" | "email"> | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  const supabase = getSupabaseAdmin();
  if (supabase && user?.id) {
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data) {
      return true;
    }

    const emailResult = await supabase
      .from("admin_users")
      .select("email, is_active")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (!emailResult.error && emailResult.data) {
      return true;
    }
  }

  return isAdminEmailConfigured(email);
}

export function isAdminEmailConfigured(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
