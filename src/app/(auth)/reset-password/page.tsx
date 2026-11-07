import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata: Metadata = { title: "Choose a new password" };

export default function UpdatePasswordPage() {
  return <AuthLayout><AuthForm mode="update" /></AuthLayout>;
}
