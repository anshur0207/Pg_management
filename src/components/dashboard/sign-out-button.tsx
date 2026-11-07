"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const { error } = await createClient().auth.signOut();
    if (!error) router.replace("/login");
    setBusy(false);
  }

  return <button type="button" onClick={signOut} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[#e1e8e2] px-3 py-2 text-sm font-medium text-[#57665d] transition hover:bg-[#f7faf7] disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />} Sign out</button>;
}
