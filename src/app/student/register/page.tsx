import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { StudentAuthForm } from "@/components/auth/student-auth-form";

export const metadata: Metadata = { title: "Join your PG" };

export default async function StudentRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const inviteToken = typeof params.token === "string" ? params.token : "";

  return <AuthLayout><StudentAuthForm mode="register" inviteToken={inviteToken} /></AuthLayout>;
}
