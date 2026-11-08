"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  clearSessionStartCookie,
  clearRememberMePreference,
  getSessionStartFromDocument,
  isSessionExpired,
  SESSION_DURATION_MS,
} from "@/lib/supabase/session";

export function SessionExpiry({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();

  useEffect(() => {
    const startedAt = getSessionStartFromDocument();
    if (isSessionExpired(startedAt)) {
      void expireSession();
      return;
    }

    const remaining = SESSION_DURATION_MS - (Date.now() - Number(startedAt));
    const timeout = window.setTimeout(() => void expireSession(), remaining);

    async function expireSession() {
      await createClient().auth.signOut();
      clearSessionStartCookie();
      clearRememberMePreference();
      router.replace(`${redirectTo}?session-expired=1`);
    }

    return () => window.clearTimeout(timeout);
  }, [router, redirectTo]);

  return null;
}