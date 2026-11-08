import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE } from "@/lib/supabase/session";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") ?? "/login";
  const nextPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/login";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
        response.cookies.set(SESSION_COOKIE, String(Date.now()), {
          path: "/",
          sameSite: "lax",
          secure: requestUrl.protocol === "https:",
        });
        return response;
      }
    } catch {
      // Redirect to a safe page below; never expose server auth details in the response URL.
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth-callback", requestUrl.origin));
}
