import { NextResponse, type NextRequest } from "next/server";
import { isSessionExpired, SESSION_COOKIE } from "@/lib/supabase/session";

export function proxy(request: NextRequest) {
  const isProtectedDashboard = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/student/dashboard");
  if (isProtectedDashboard) {
    const startedAt = request.cookies.get(SESSION_COOKIE)?.value;
    if (isSessionExpired(startedAt)) {
      const loginPath = request.nextUrl.pathname.startsWith("/student/") ? "/student/login?session-expired=1" : "/login?session-expired=1";
      const response = NextResponse.redirect(new URL(loginPath, request.url));
      response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
