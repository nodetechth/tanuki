import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hasSupabaseConfig, supabase } from "../lib/supabase";

type AuthState = {
  configured: boolean;
  error: string | null;
  loading: boolean;
  message: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
  user: User | null;
};

function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit") || normalized.includes("security purposes")) {
    return "短時間に複数回送信されています。少し待ってから再送信してください。";
  }
  return message;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuthUrl = useCallback(async (url: string | null) => {
    if (!url || !supabase) {
      return;
    }

    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get("code");
    if (!code) {
      return;
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      setError(getAuthErrorMessage(exchangeError.message));
      return;
    }

    setMessage("ログインしました。");
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }
      setSession(data.session ?? null);
      setLoading(false);
    });

    Linking.getInitialURL().then(handleAuthUrl);
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthUrl(url);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      linkingSubscription.remove();
      data.subscription.unsubscribe();
    };
  }, [handleAuthUrl]);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) {
      setError("Supabase環境変数が未設定です。");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("メールアドレスを入力してください。");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const redirectTo = Linking.createURL("auth/callback");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(getAuthErrorMessage(signInError.message));
      return;
    }

    setMessage("ログイン用メールを送りました。メール内のリンクを開いてください。");
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    setError(null);
    setMessage(null);
    await supabase.auth.signOut();
  }, []);

  const user = useMemo(() => session?.user ?? null, [session]);

  return {
    configured: hasSupabaseConfig,
    error,
    loading,
    message,
    sendMagicLink,
    session,
    signOut,
    user,
  };
}
