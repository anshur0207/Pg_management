"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { setRememberMePreference, setSessionStartCookie } from "@/lib/supabase/session";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register" | "reset" | "update";
type AuthValues = {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  phone: string;
  address: string;
  rememberMe: boolean;
};

const schemas = {
  login: z.object({ email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Password must be at least 8 characters.") }),
  register: z.object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters for your password."),
    fullName: z.string().trim().min(2, "Enter your full name."),
    businessName: z.string().trim().min(2, "Enter your business name."),
    phone: z.string().trim().regex(/^[+\d][\d\s()-]{7,19}$/, "Enter a valid phone number."),
    address: z.string().trim().min(5, "Enter your business address."),
  }),
  reset: z.object({ email: z.string().email("Enter a valid email address.") }),
  update: z.object({ password: z.string().min(8, "Use at least 8 characters for your password.") }),
};

const copy: Record<AuthMode, { title: string; description: string; button: string }> = {
  login: { title: "Welcome back", description: "Sign in to your PG Manager workspace.", button: "Sign in" },
  register: { title: "Create your workspace", description: "Start with the details for you and your business.", button: "Create account" },
  reset: { title: "Reset your password", description: "We’ll email you a secure link to choose a new password.", button: "Send reset link" },
  update: { title: "Choose a new password", description: "Use a strong password you have not used elsewhere.", button: "Update password" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const configured = isSupabaseConfigured();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AuthValues>({
    defaultValues: { email: "", password: "", fullName: "", businessName: "", phone: "", address: "", rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    const result = schemas[mode].safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof AuthValues;
        setError(field, { type: "manual", message: issue.message });
      });
      return;
    }
    if (!configured) {
      setNotice({ kind: "error", text: "Authentication is not connected yet. Add your Supabase URL and publishable key to .env.local." });
      return;
    }

    try {
      if (mode === "login") setRememberMePreference(values.rememberMe);
      const supabase = createClient();
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) throw error;
        setSessionStartCookie(values.rememberMe);
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
        if (profileError) throw profileError;
        router.push(profile?.role === "STUDENT" ? "/student/dashboard" : "/dashboard");
        return;
      }
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
            data: { full_name: values.fullName, business_name: values.businessName, phone: values.phone, business_address: values.address },
          },
        });
        if (error) throw error;
        setNotice({ kind: "success", text: "Account request received. Check your email for a verification link to continue." });
        return;
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setNotice({ kind: "success", text: "If an account exists for that email, a password reset link is on its way." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      setNotice({ kind: "success", text: "Your password has been updated." });
      router.push("/login?password-updated=1");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    }
  });

  const fieldClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-4 py-3.5 text-base text-[#203028] outline-none transition placeholder:text-[#a0aaa3] focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";
  const { title, description, button } = copy[mode];

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-[-.045em] text-[#17241f]">{title}</h1>
      <p className="mt-2 text-base leading-7 text-[#748078]">{description}</p>
      {!configured && <div className="mt-5 rounded-lg border border-[#eee2c9] bg-[#fffcf4] px-3.5 py-3 text-sm leading-6 text-[#756547]">Setup required: connect a Supabase project to enable real authentication.</div>}
      {notice && <div role="status" className={`mt-5 rounded-lg border px-3.5 py-3 text-base leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</div>}

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {mode === "register" && <>
          <Field label="Your name" error={errors.fullName?.message}><input autoComplete="name" className={fieldClass} placeholder="e.g. Ananya Sharma" {...register("fullName")} /></Field>
          <Field label="Business name" error={errors.businessName?.message}><input autoComplete="organization" className={fieldClass} placeholder="e.g. Green House Living" {...register("businessName")} /></Field>
          <Field label="Phone number" error={errors.phone?.message}><input autoComplete="tel" type="tel" className={fieldClass} placeholder="+91 98765 43210" {...register("phone")} /></Field>
          <Field label="Business address" error={errors.address?.message}><input autoComplete="street-address" className={fieldClass} placeholder="City, state" {...register("address")} /></Field>
        </>}
        {mode !== "update" && <Field label="Work email" error={errors.email?.message}><input autoComplete="email" type="email" className={fieldClass} placeholder="you@yourbusiness.com" {...register("email")} /></Field>}
        {mode !== "reset" && <Field label={mode === "update" ? "New password" : "Password"} error={errors.password?.message}>
          <div className="relative"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} className={`${fieldClass} pr-11`} placeholder="At least 8 characters" {...register("password")} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#8b978f] hover:text-[#425149]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        </Field>}
        {mode === "login" && <div className="-mt-1 flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#526058]"><input type="checkbox" className="size-4 accent-[#167354]" {...register("rememberMe")} />Remember me</label>
          <Link className="text-sm font-medium text-[#167354] hover:text-[#105a41]" href="/forgot-password">Forgot password?</Link>
        </div>}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full py-3.5 text-base shadow-sm disabled:cursor-not-allowed">{isSubmitting && <LoaderCircle size={18} className="animate-spin" />}{button}{!isSubmitting && <ArrowRight size={17} />}</Button>
      </form>
      <p className="mt-6 text-center text-base leading-7 text-[#77837c]">{mode === "login" ? <>New to PG Manager? <Link href="/register" className="font-medium text-[#167354] hover:underline">Create an account</Link></> : mode === "register" ? <>Already have a workspace? <Link href="/login" className="font-medium text-[#167354] hover:underline">Sign in</Link></> : <>Back to <Link href="/login" className="font-medium text-[#167354] hover:underline">sign in</Link></>}</p>
      {mode === "login" && <p className="mt-3 text-center text-sm text-[#77837c]">Student resident? <Link href="/student/login" className="font-medium text-[#167354] hover:underline">Use the student portal</Link></p>}
      <div className="mt-7 border-t border-[#edf0ed] pt-5 text-center text-sm leading-6 text-[#929c95]">By continuing, you agree to use PG Manager in accordance with your organization’s policies.</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium leading-6 text-[#38473e]">{label}{children}{error && <span className="block text-sm font-normal text-[#b44545]">{error}</span>}</label>;
}
