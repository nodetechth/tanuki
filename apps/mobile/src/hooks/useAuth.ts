import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hasSupabaseConfig, supabase } from "../lib/supabase";

export type AuthState = {
  configured: boolean;
  error: string | null;
  loading: boolean;
  message: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
  user: User | null;
};

function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "このメールアドレスは登録済みです。ログインをお試しください。";
  }
  if (normalized.includes("email not confirmed")) {
    return "メール確認が完了していません。届いたメールを確認してください。";
  }
  if (normalized.includes("password should be at least") || normalized.includes("weak password")) {
    return "パスワードは6文字以上で設定してください。";
  }
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

  const validateEmailAndPassword = useCallback((email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("メールアドレスを入力してください。");
      return null;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return null;
    }
    return trimmedEmail;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError("Supabase環境変数が未設定です。");
      return;
    }

    const trimmedEmail = validateEmailAndPassword(email, password);
    if (!trimmedEmail) {
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const redirectTo = Linking.createURL("auth/callback");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError.message));
      return;
    }

    if (data.session) {
      setMessage("登録しました。続けて学習設定を選んでください。");
      return;
    }

    setMessage("登録確認メールを送りました。メール内のリンクを開いてからログインしてください。");
  }, [validateEmailAndPassword]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError("Supabase環境変数が未設定です。");
      return;
    }

    const trimmedEmail = validateEmailAndPassword(email, password);
    if (!trimmedEmail) {
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(getAuthErrorMessage(signInError.message));
      return;
    }

    setMessage("ログインしました。");
  }, [validateEmailAndPassword]);

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
    signInWithPassword,
    signUpWithPassword,
    session,
    signOut,
    user,
  };
}
