import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleHelp, UserRound } from "lucide-react";
import { SessionExpiry } from "@/components/dashboard/session-expiry";
import { StudentHeader } from "@/components/dashboard/student-header";
import { StudentProfileForm } from "@/components/dashboard/student-profile-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  if (!isSupabaseConfigured()) redirect("/student/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");
  const { data: authProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (authProfile?.role !== "STUDENT") redirect("/dashboard");

  const { data: student } = await supabase.from("students").select("id, owner_id, property_id, full_name, email, phone, emergency_contact_name, emergency_contact_phone, permanent_address, government_id_type, government_id_last4, joined_on, monthly_rent_paise, security_deposit_paise, rent_due_day, agreement_start, agreement_end, status").eq("auth_user_id", user.id).maybeSingle();
  const header = <><SessionExpiry redirectTo="/student/login" /><StudentHeader email={student?.email ?? user.email} /></>;

  if (!student) return <main className="min-h-screen bg-[#f7f9f7]">{header}<div className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><section className="rounded-2xl border border-[#e4ebe5] bg-white p-8 text-center"><CircleHelp size={28} className="mx-auto text-[#167354]" /><h1 className="mt-4 text-2xl font-semibold text-[#24332b]">Resident profile unavailable</h1><p className="mt-2 text-sm leading-6 text-[#718078]">Ask your PG owner to check your invitation and resident account.</p><Link href="/student/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#167354] hover:underline"><ArrowLeft size={15} />Back to dashboard</Link></section></div></main>;

  const [propertyResult, stayResult, agreementResult] = await Promise.all([
    supabase.from("properties").select("name, address, locality, city").eq("id", student.property_id).maybeSingle(),
    supabase.from("occupancies").select("id, bed_id, check_in, expected_check_out, checked_out_at, monthly_rent_paise, status").eq("student_id", student.id).order("check_in", { ascending: false }),
    supabase.from("rental_agreements").select("id, agreement_number, status, starts_on, ends_on, monthly_rent_paise, security_deposit_paise, owner_terms, created_at").eq("student_id", student.id).order("created_at", { ascending: false }),
  ]);

  const stayRows = stayResult.data ?? [];
  const currentStay = stayRows.find((stay) => stay.status === "active" && !stay.checked_out_at);
  let assignment = "Not currently assigned";
  if (currentStay) {
    const { data: bed } = await supabase.from("beds").select("bed_number, room_id").eq("id", currentStay.bed_id).maybeSingle();
    if (bed) {
      const { data: room } = await supabase.from("rooms").select("room_number, floor_id").eq("id", bed.room_id).maybeSingle();
      const { data: floor } = room ? await supabase.from("floors").select("name").eq("id", room.floor_id).maybeSingle() : { data: null };
      assignment = `${floor?.name ? `${floor.name} · ` : ""}${room ? `Room ${room.room_number}` : "Room unavailable"} · Bed ${bed.bed_number}`;
    }
  }

  const stays = await Promise.all(stayRows.map(async (stay) => {
    const { data: bed } = await supabase.from("beds").select("bed_number, room_id").eq("id", stay.bed_id).maybeSingle();
    const { data: room } = bed ? await supabase.from("rooms").select("room_number, floor_id").eq("id", bed.room_id).maybeSingle() : { data: null };
    const { data: floor } = room ? await supabase.from("floors").select("name").eq("id", room.floor_id).maybeSingle() : { data: null };
    return {
      id: stay.id,
      check_in: stay.check_in,
      expected_check_out: stay.expected_check_out,
      checked_out_at: stay.checked_out_at,
      status: stay.status,
      rent: stay.monthly_rent_paise,
      location: bed ? `${floor?.name ? `${floor.name} · ` : ""}Room ${room?.room_number ?? "—"} · Bed ${bed.bed_number}` : "Past room assignment",
    };
  }));

  const property = propertyResult.data;
  return <main className="min-h-screen bg-[#f7f9f7]">{header}<div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
    <Link href="/student/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-[#167354] hover:underline"><ArrowLeft size={15} />Back to dashboard</Link>
    <div className="mb-6 mt-5 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eff7f1] text-[#167354]"><UserRound size={20} /></span><div><p className="text-sm font-medium text-[#167354]">Resident account</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] text-[#17241f]">My profile</h1><p className="mt-2 text-sm text-[#718078]">Review your stay information and update your personal details.</p></div></div>
    <StudentProfileForm profile={student} propertyName={property?.name ?? "Property unavailable"} propertyAddress={[property?.address, property?.locality, property?.city].filter(Boolean).join(", ")} assignment={assignment} stays={stays} agreements={agreementResult.data ?? []} />
  </div></main>;
}
