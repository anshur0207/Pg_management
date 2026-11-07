import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BedDouble, Building2, CircleHelp, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="min-h-screen bg-[#f7f9f7]">
      <header className="flex h-[68px] items-center justify-between border-b border-[#e7ece8] bg-white px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-[#23332a]"><span className="grid size-8 place-items-center rounded-lg bg-[#167354] text-white"><Building2 size={17} /></span><span>pg<span className="text-[#167354]">manager</span></span></Link>
        <div className="flex items-center gap-3"><span className="hidden text-sm text-[#76827a] sm:inline">{user.email}</span><SignOutButton /></div>
      </header>
      <div className="mx-auto max-w-[1080px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#167354]">Owner workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[#17241f] sm:text-4xl">Good to see you, {firstName}.</h1><p className="mt-3 text-sm text-[#718078]">Your PG Manager workspace is ready for its first property.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce9e1] bg-white px-3 py-1.5 text-xs text-[#5b7162]"><ShieldCheck size={14} className="text-[#167354]" /> Account verified</div></div>

        <section className="mt-8 rounded-2xl border border-[#e4ebe5] bg-white p-6 shadow-[0_6px_24px_-20px_rgba(27,65,41,.2)] sm:p-8">
          <div className="grid size-12 place-items-center rounded-xl bg-[#eff7f1] text-[#167354]"><Building2 size={22} /></div>
          <h2 className="mt-5 text-xl font-semibold tracking-[-.025em] text-[#24332b]">Start with your first property</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#718078]">Property setup is the next development phase. Your account is connected, but property records and management tools are not available yet. No sample occupancy or financial numbers are shown.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-lg bg-[#f2f5f2] px-4 py-2.5 text-sm font-medium text-[#627068]"><BedDouble size={16} /> Property tools coming next</span><Link href="/" className="inline-flex items-center gap-2 px-2 py-2.5 text-sm font-medium text-[#167354] hover:underline">Explore the platform <ArrowRight size={15} /></Link></div>
        </section>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e4ebe5] bg-white px-4 py-4 text-sm text-[#748078]"><CircleHelp size={17} className="mt-0.5 shrink-0 text-[#87958c]"/><p>Phase 1 foundation is in place. Property records, tenant isolation policies, and operational modules will be added with their database migrations in the next phase.</p></div>
      </div>
    </main>
  );
}
