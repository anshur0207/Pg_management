"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdentityProofDocuments } from "@/components/dashboard/resident-management";
import { RentalAgreementDocument } from "@/components/dashboard/rental-agreement-document";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  permanent_address: string | null;
  government_id_type: string | null;
  government_id_last4: string | null;
  joined_on: string;
  monthly_rent_paise: number;
  security_deposit_paise: number;
  rent_due_day: number;
  agreement_start: string | null;
  agreement_end: string | null;
  status: string;
};
type Stay = { id: string; check_in: string; expected_check_out: string | null; checked_out_at: string | null; status: string; rent: number; location: string };
type Agreement = { id: string; agreement_number: string; status: string; starts_on: string; ends_on: string | null; monthly_rent_paise: number; security_deposit_paise: number; owner_terms: string };

export function StudentProfileForm({ profile, propertyName, propertyAddress, assignment, stays, agreements }: {
  profile: Profile;
  propertyName: string;
  propertyAddress: string;
  assignment: string;
  stays: Stay[];
  agreements: Agreement[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const currency = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" });
  const statusLabel = profile.status === "active" ? "Active" : profile.status === "notice_period" ? "Notice Period" : ["checked_out", "inactive"].includes(profile.status) ? "Checked Out" : profile.status.replaceAll("_", " ");

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const values = new FormData(event.currentTarget);
    const supabase = createClient();
    const email = String(values.get("email") ?? "").trim();
    if (email !== (profile.email ?? "")) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        setNotice({ kind: "error", text: emailError.message });
        setSaving(false);
        return;
      }
    }
    const { error } = await supabase.from("students").update({
      full_name: String(values.get("fullName") ?? "").trim(),
      email: email || null,
      phone: String(values.get("phone") ?? "").trim(),
      emergency_contact_name: String(values.get("emergencyContactName") ?? "").trim() || null,
      emergency_contact_phone: String(values.get("emergencyContactPhone") ?? "").trim() || null,
      permanent_address: String(values.get("address") ?? "").trim() || null,
      government_id_type: String(values.get("governmentIdType") ?? "").trim() || null,
      government_id_last4: String(values.get("governmentIdLast4") ?? "").replace(/\D/g, "").slice(-4) || null,
    }).eq("id", profile.id);
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Your profile was updated." });
      router.refresh();
    }
    setSaving(false);
  }

  return <>
    <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-[#167354]">Personal information</p><h2 className="mt-1 text-xl font-semibold text-[#24332b]">Your profile</h2><p className="mt-1 text-sm text-[#718078]">Keep your contact and emergency details up to date.</p></div><span className="rounded-full bg-[#eff7f1] px-3 py-1.5 text-sm font-medium text-[#26714f]">{statusLabel}</span></div>
      <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#38473e]">Full name<input required minLength={2} name="fullName" defaultValue={profile.full_name} className={inputClass} /></label>
        <label className="text-sm font-medium text-[#38473e]">Phone number<input required type="tel" name="phone" defaultValue={profile.phone} className={inputClass} /></label>
        <label className="text-sm font-medium text-[#38473e]">Email address<input required type="email" name="email" defaultValue={profile.email ?? ""} className={inputClass} /><span className="mt-1 block text-xs font-normal text-[#89948d]">Changing your sign-in email may require confirmation.</span></label>
        <label className="text-sm font-medium text-[#38473e]">Emergency contact name<input name="emergencyContactName" defaultValue={profile.emergency_contact_name ?? ""} className={inputClass} /></label>
        <label className="text-sm font-medium text-[#38473e]">Emergency contact phone<input type="tel" name="emergencyContactPhone" defaultValue={profile.emergency_contact_phone ?? ""} className={inputClass} /></label>
        <label className="text-sm font-medium text-[#38473e]">ID proof type<input name="governmentIdType" defaultValue={profile.government_id_type ?? ""} placeholder="Aadhaar, passport, etc." className={inputClass} /></label>
        <label className="text-sm font-medium text-[#38473e]">ID proof last 4 digits<input inputMode="numeric" maxLength={4} name="governmentIdLast4" defaultValue={profile.government_id_last4 ?? ""} className={inputClass} /><span className="mt-1 block text-xs font-normal text-[#89948d]">Only the last four digits are stored.</span></label>
        <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Permanent address<textarea name="address" rows={3} defaultValue={profile.permanent_address ?? ""} className={inputClass} /></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={saving} className="py-2.5">{saving ? <LoaderCircle size={16} className="animate-spin" /> : notice?.kind === "success" ? <Check size={16} /> : <Save size={16} />}Save profile</Button>{notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${notice.kind === "error" ? "text-[#9b413c]" : "text-[#26714f]"}`}>{notice.text}</p>}</div>
      </form>
    </section>

    <section className="mt-5 rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-[#24332b]">Stay and rent details</h2><p className="mt-1 text-sm text-[#718078]">Managed by your PG owner. Contact them if a stay or billing detail needs correction.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
        ["Property", propertyName], ["Assigned floor, room and bed", assignment], ["Joining date", showDate(profile.joined_on)],
        ["Monthly rent", currency(profile.monthly_rent_paise)], ["Security deposit", currency(profile.security_deposit_paise)], ["Rent due date", `Day ${profile.rent_due_day} of each month`],
        ["Agreement start", showDate(profile.agreement_start)], ["Agreement end", showDate(profile.agreement_end)], ["Property address", propertyAddress || "Not provided"],
      ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-[#89948d]">{label}</dt><dd className="mt-1 text-sm text-[#34443a]">{value}</dd></div>)}</dl>
      <h3 className="mt-6 font-semibold text-[#34443a]">Check-in and check-out history</h3>{stays.length ? <div className="mt-3 divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] px-4">{stays.map((stay) => <div key={stay.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-medium capitalize text-[#34443a]">{stay.status === "active" ? "Current stay" : "Past stay"}</p><p className="mt-1 text-xs text-[#718078]">{stay.location} · {currency(stay.rent)} / month</p></div><div className="text-right text-xs text-[#718078]">Check-in {showDate(stay.check_in)}<p className="mt-1">{stay.checked_out_at ? `Checked out ${showDate(stay.checked_out_at)}` : stay.expected_check_out ? `Expected checkout ${showDate(stay.expected_check_out)}` : "Currently staying"}</p></div></div>)}</div> : <p className="mt-2 text-sm text-[#718078]">No stay history recorded.</p>}
    </section>

    <IdentityProofDocuments ownerId={profile.owner_id} studentId={profile.id} />

    <section className="mt-5 rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-[#24332b]">Agreement details</h2>{agreements.length ? <div className="mt-3 space-y-3">{agreements.map((agreement) => <details key={agreement.id} className="rounded-xl border border-[#e8ede8] p-4"><summary className="cursor-pointer font-medium text-[#34443a]">{agreement.agreement_number} · <span className="capitalize">{agreement.status.replaceAll("_", " ")}</span></summary><div className="mt-3 text-sm leading-6 text-[#526058]"><p>{showDate(agreement.starts_on)} to {showDate(agreement.ends_on)} · {currency(agreement.monthly_rent_paise)} / month · Deposit {currency(agreement.security_deposit_paise)}</p><div className="mt-3"><RentalAgreementDocument terms={agreement.owner_terms} /></div></div></details>)}</div> : <p className="mt-2 text-sm text-[#718078]">No agreement has been added.</p>}</section>
  </>;
}

const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";
const showDate = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
