import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { StudentAuthForm } from "@/components/auth/student-auth-form";

export const metadata: Metadata = { title: "Student sign in" };

export default function StudentLoginPage() {
  return <AuthLayout><StudentAuthForm mode="login" /></AuthLayout>;
}
