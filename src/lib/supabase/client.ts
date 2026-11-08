import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getRememberMePreference, SESSION_DURATION_SECONDS } from "@/lib/supabase/session";

let cachedClient: ReturnType<typeof createBrowserClient> | undefined;
let cachedRememberMe: boolean | undefined;

export function createClient() {
  const rememberMe = getRememberMePreference();
  if (cachedClient && cachedRememberMe === rememberMe) return cachedClient;

  const { url, key } = getSupabaseConfig();
  cachedClient = createBrowserClient(url, key, {
    isSingleton: false,
    cookieOptions: { maxAge: rememberMe ? SESSION_DURATION_SECONDS : undefined },
  });
  cachedRememberMe = rememberMe;
  return cachedClient;
}

