import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type BillingRow = {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  freeSubmissionUsed: boolean;
};

export type BillingState = BillingRow & {
  completedSubmissionCount: number;
  todaySubscriberSubmissionCount: number;
  freeSubmissionsRemaining: number;
  dailySubmissionsRemaining: number;
  dailySubmissionLimit: number;
  canSubmit: boolean;
  isSubscriber: boolean;
  denialReason: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function fromBillingRow(row: Record<string, unknown>): BillingRow {
  return {
    userId: String(row.user_id),
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    subscriptionStatus: String(row.subscription_status ?? "none"),
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    currentPeriodEndsAt: row.current_period_ends_at
      ? String(row.current_period_ends_at)
      : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    freeSubmissionUsed: Boolean(row.free_submission_used),
  };
}

function fallbackBillingRow(userId: string): BillingRow {
  return {
    userId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "none",
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    freeSubmissionUsed: false,
  };
}

export async function getOrCreateBillingRow(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return fallbackBillingRow(userId);
  }

  const { data: existing, error: selectError } = await supabase
    .from("user_billing")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) {
    return fromBillingRow(existing);
  }

  const { data, error } = await supabase
    .from("user_billing")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return fromBillingRow(data);
}

export async function findBillingByStripeCustomerId(stripeCustomerId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_billing")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? fromBillingRow(data) : null;
}

async function getCompletedSubmissionCount(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return 0;
  }

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function tokyoDayRange(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = formatter.format(now);
  const start = new Date(`${today}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function getTodaySubscriberSubmissionCount(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return 0;
  }

  const range = tokyoDayRange();
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("access_type", "subscriber")
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getBillingState(userId: string): Promise<BillingState> {
  const row = await getOrCreateBillingRow(userId);
  const completedSubmissionCount = await getCompletedSubmissionCount(userId);
  const todaySubscriberSubmissionCount = await getTodaySubscriberSubmissionCount(userId);
  const isSubscriber = ACTIVE_SUBSCRIPTION_STATUSES.has(row.subscriptionStatus);
  const freeSubmissionUsed = row.freeSubmissionUsed || completedSubmissionCount > 0;
  const dailySubmissionLimit = 1;
  const dailySubmissionsRemaining = isSubscriber
    ? Math.max(0, dailySubmissionLimit - todaySubscriberSubmissionCount)
    : 0;
  const freeSubmissionsRemaining = !isSubscriber && !freeSubmissionUsed ? 1 : 0;
  const canSubmit = isSubscriber ? dailySubmissionsRemaining > 0 : !freeSubmissionUsed;

  return {
    ...row,
    completedSubmissionCount,
    todaySubscriberSubmissionCount,
    freeSubmissionUsed,
    freeSubmissionsRemaining,
    dailySubmissionsRemaining,
    dailySubmissionLimit,
    canSubmit,
    isSubscriber,
    denialReason: canSubmit
      ? null
      : isSubscriber
        ? "今日の添削は完了済みです。次回は明日また利用できます。"
        : "無料添削は1回までです。3日間の無料体験を開始すると続けて利用できます。",
  };
}

export async function updateBillingCustomer(userId: string, stripeCustomerId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("user_billing").upsert({
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function markFreeSubmissionUsed(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("user_billing").upsert({
    user_id: userId,
    free_submission_used: true,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateBillingFromSubscription(input: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("user_billing").upsert({
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    subscription_status: input.subscriptionStatus,
    trial_ends_at: input.trialEndsAt,
    current_period_ends_at: input.currentPeriodEndsAt,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
