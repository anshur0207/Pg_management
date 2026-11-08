"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { clearRememberMePreference, setRememberMePreference, setSessionStartCookie } from "@/lib/supabase/session";

type StudentAuthMode = "login" | "register";

function getStudentAuthErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "Unable to continue. Please try again.";
  }

  const authError = error as { code?: string; message?: string };
  switch (authError.code) {
    case "email_address_invalid":
      return "Supabase Auth rejected this email address. Use the resident’s real email address (not a test/example address), and make sure it matches the invitation.";
    case "email_address_not_authorized":
      return "Supabase’s default email service can only send to authorized project users. Configure custom SMTP in Supabase Auth to send signup verification emails to residents.";
    case "email_exists":
    case "user_already_exists":
      return "An account already exists for this email. Sign in to the student portal instead.";
    case "over_email_send_rate_limit":
      return "Too many verification emails were requested. Wait a few minutes before trying again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Email signup is disabled in Supabase Auth. Enable email signups in the project’s Auth provider settings.";
    default:
      return authError.message || "Unable to continue. Please try again.";
  }
}

export function StudentAuthForm({ mode, inviteToken = "" }: { mode: StudentAuthMode; inviteToken?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim().toLowerCase();
    const password = String(values.get("password") ?? "");
    const fullName = String(values.get("fullName") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();

    try {
      if (mode === "register" && !inviteToken) {
        throw new Error("Student signup requires an invitation link from your PG owner.");
      }

      if (mode === "login") setRememberMePreference(rememberMe);
      else clearRememberMePreference();
      const supabase = createClient();

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/student/dashboard`,
            data: { full_name: fullName, phone, student_invite_token: inviteToken },
          },
        });
        if (error) throw error;

        if (data.session) {
          setSessionStartCookie(false);
          router.push("/student/dashboard");
          return;
        }
        setNotice({ kind: "success", text: `Check ${email} for the verification link to finish creating your student account.` });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== "STUDENT") {
        await supabase.auth.signOut();
        clearRememberMePreference();
        throw new Error("This is not a student account. Please use the PG owner sign-in instead.");
      }

      setSessionStartCookie(rememberMe);
      router.push("/student/dashboard");
    } catch (error) {
      setNotice({ kind: "error", text: getStudentAuthErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-4 py-3.5 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-[-.045em] text-[#17241f]">{mode === "login" ? "Student sign in" : "Join your PG"}</h1>
      <p className="mt-2 text-base leading-7 text-[#748078]">{mode === "login" ? "Sign in to see information shared by your PG." : "Create your resident account using the private invite from your PG owner."}</p>
      {mode === "register" && !inviteToken && <p role="alert" className="mt-5 rounded-lg border border-[#eee2c9] bg-[#fffcf4] px-4 py-3 text-sm leading-6 text-[#756547]">An invitation link is required. Ask your PG owner to add you and share your private signup link.</p>}
      {notice && <p role="status" className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

      <form className="mt-6 space-y-4" onSubmit={submit}>
        {mode === "register" && <>
          <label className="block text-sm font-medium leading-6 text-[#38473e]">Full name<input required minLength={2} name="fullName" autoComplete="name" className={inputClass} placeholder="Your name" /></label>
          <label className="block text-sm font-medium leading-6 text-[#38473e]">Phone number<input required type="tel" name="phone" autoComplete="tel" className={inputClass} placeholder="Your mobile number" /></label>
        </>}
        <label className="block text-sm font-medium leading-6 text-[#38473e]">Email address<input required type="email" name="email" autoComplete="email" className={inputClass} placeholder="you@example.com" /></label>
        <label className="block text-sm font-medium leading-6 text-[#38473e]">Password<input required minLength={8} type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} placeholder="At least 8 characters" /></label>
        {mode === "login" && <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#526058]"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="size-4 accent-[#167354]" />Remember me</label>
          <Link className="text-sm font-medium text-[#167354] hover:text-[#105a41]" href="/forgot-password">Forgot password?</Link>
        </div>}
        <Button type="submit" disabled={isSubmitting || (mode === "register" && !inviteToken)} className="w-full py-3.5 text-base">{isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <>{mode === "login" ? "Sign in" : "Create student account"}<ArrowRight size={17} /></>}</Button>
      </form>

      {mode === "register" && <p className="mt-6 text-center text-base leading-7 text-[#77837c]">Already registered? <Link href="/student/login" className="font-medium text-[#167354] hover:underline">Student sign in</Link></p>}
      <p className="mt-5 border-t border-[#edf0ed] pt-5 text-center text-sm text-[#929c95]">PG owner? <Link href="/login" className="font-medium text-[#167354] hover:underline">Owner sign in</Link></p>
    </div>
  );
}
