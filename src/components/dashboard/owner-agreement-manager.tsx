"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, LoaderCircle, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { buildRentalAgreementTemplate, getAgreementEndDate } from "@/lib/rental-agreement-template";
import { RentalAgreementDocument } from "@/components/dashboard/rental-agreement-document";

type ResidentOption = { id: string; full_name: string; email: string | null; property_id: string; monthly_rent_paise: number; security_deposit_paise: number; rent_due_day: number; joined_on: string; agreement_start: string | null; status: string; email_verified: boolean };
type PropertyOption = { id: string; name: string; address: string; contact_phone: string };
type ResidentStay = { student_id: string; check_in: string; room_number: string; bed_number: string };
type Agreement = { id: string; agreement_number: string; student_id: string; property_id: string; monthly_rent_paise: number; security_deposit_paise: number; starts_on: string; ends_on: string | null; owner_terms: string; status: string; student_signature_name: string | null; signed_at: string | null; created_at: string };

const amount = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function OwnerAgreementManager({
  ownerId,
  userId,
  ownerDetails,
  residents,
  properties,
  residentStays,
  agreements,
}: {
  ownerId: string;
  userId: string;
  ownerDetails: { name: string; phone: string; address: string };
  residents: ResidentOption[];
  properties: PropertyOption[];
  residentStays: ResidentStay[];
  agreements: Agreement[];
}) {
  const router = useRouter();
  const eligibleResidents = residents.filter((resident) => resident.email_verified && !["inactive", "checked_out"].includes(resident.status));
  const [selectedResidentId, setSelectedResidentId] = useState(eligibleResidents[0]?.id ?? "");
  const selectedResident = eligibleResidents.find((resident) => resident.id === selectedResidentId);
  const property = properties.find((item) => item.id === selectedResident?.property_id);
  const selectedStay = residentStays.find((stay) => stay.student_id === selectedResident?.id);
  const [rent, setRent] = useState(selectedResident ? (selectedResident.monthly_rent_paise / 100).toFixed(2) : "0");
  const [deposit, setDeposit] = useState(selectedResident ? (selectedResident.security_deposit_paise / 100).toFixed(2) : "0");
  const [startsOn, setStartsOn] = useState(selectedResident ? residentStays.find((stay) => stay.student_id === selectedResident.id)?.check_in ?? selectedResident.agreement_start ?? selectedResident.joined_on : new Date().toISOString().slice(0, 10));
  const [additionalTerms, setAdditionalTerms] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAgreementId, setDeletingAgreementId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function selectResident(id: string) {
    setSelectedResidentId(id);
    const resident = eligibleResidents.find((item) => item.id === id);
    setRent(resident ? (resident.monthly_rent_paise / 100).toFixed(2) : "0");
    setDeposit(resident ? (resident.security_deposit_paise / 100).toFixed(2) : "0");
    setStartsOn(resident ? residentStays.find((stay) => stay.student_id === resident.id)?.check_in ?? resident.agreement_start ?? resident.joined_on : new Date().toISOString().slice(0, 10));
  }

  async function createAgreement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResident || !property) {
      setNotice({ kind: "error", text: "Choose an onboarded, email-verified resident first." });
      return;
    }
    setSaving(true);
    setNotice(null);
    const agreementNumber = `AGR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const checkInDate = residentStays.find((stay) => stay.student_id === selectedResident.id)?.check_in ?? selectedResident.agreement_start ?? selectedResident.joined_on;
    const agreementDate = new Date().toISOString().slice(0, 10);
    const agreementTerms = buildRentalAgreementTemplate({
      agreementDate,
      ownerName: ownerDetails.name,
      propertyName: property.name,
      propertyAddress: property.address || ownerDetails.address,
      ownerPhone: property.contact_phone || ownerDetails.phone,
      residentName: selectedResident.full_name,
      checkInDate,
      startsOn,
      roomNumber: residentStays.find((stay) => stay.student_id === selectedResident.id)?.room_number ?? "",
      bedNumber: residentStays.find((stay) => stay.student_id === selectedResident.id)?.bed_number ?? "",
      monthlyRentPaise: Math.round(Number(rent) * 100),
      securityDepositPaise: Math.round(Number(deposit) * 100),
      rentDueDay: selectedResident.rent_due_day,
      additionalTerms,
    });
    const { error } = await createClient().from("rental_agreements").insert({
      owner_id: ownerId,
      property_id: property.id,
      student_id: selectedResident.id,
      agreement_number: agreementNumber,
      monthly_rent_paise: Math.round(Number(rent) * 100),
      security_deposit_paise: Math.round(Number(deposit) * 100),
      starts_on: startsOn,
      ends_on: getAgreementEndDate(startsOn),
      premises_address: property.address,
      owner_terms: agreementTerms,
      created_by: userId,
    });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: `Agreement ${agreementNumber} is ready in ${selectedResident.full_name}'s student portal for review and signature.` });
      setShowForm(false);
      setAdditionalTerms("");
      router.refresh();
    }
    setSaving(false);
  }

  async function deleteAgreement(agreement: Agreement) {
    if (!window.confirm(`Permanently delete agreement ${agreement.agreement_number}? It will also be removed from the resident's portal.`)) return;
    setDeletingAgreementId(agreement.id);
    setNotice(null);
    const { error } = await createClient()
      .from("rental_agreements")
      .delete()
      .eq("id", agreement.id)
      .eq("owner_id", ownerId);
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: `Agreement ${agreement.agreement_number} was deleted from the resident portal.` });
      router.refresh();
    }
    setDeletingAgreementId(null);
  }

  const pending = agreements.filter((agreement) => agreement.status === "pending_signature");
  const signed = agreements.filter((agreement) => agreement.status === "signed");
  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";
  const agreementPreview = selectedResident && property ? buildRentalAgreementTemplate({
    agreementDate: new Date().toISOString().slice(0, 10),
    ownerName: ownerDetails.name,
    propertyName: property.name,
    propertyAddress: property.address || ownerDetails.address,
    ownerPhone: property.contact_phone || ownerDetails.phone,
    residentName: selectedResident.full_name,
    checkInDate: selectedStay?.check_in ?? selectedResident.agreement_start ?? selectedResident.joined_on,
    startsOn,
    roomNumber: selectedStay?.room_number ?? "",
    bedNumber: selectedStay?.bed_number ?? "",
    monthlyRentPaise: Math.round(Number(rent) * 100),
    securityDepositPaise: Math.round(Number(deposit) * 100),
    rentDueDay: selectedResident.rent_due_day,
    additionalTerms,
  }) : "";

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#24332b]">Rental agreements</h2><p className="mt-1 text-sm text-[#718078]">Prepare an agreement for an onboarded resident and track their signature.</p></div><Button type="button" onClick={() => { setShowForm((open) => !open); setNotice(null); }} className="py-2.5"><Plus size={16} />New agreement</Button></div>
    <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-[#fff8e9] px-3 py-1.5 text-[#8a6825]">Awaiting signature: {pending.length}</span><span className="rounded-full bg-[#eff7f1] px-3 py-1.5 text-[#26714f]">Signed: {signed.length}</span></div>

    {notice && <p role="status" className={`rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

    {showForm && <form onSubmit={createAgreement} className="space-y-4 rounded-xl border border-[#e8ede8] bg-[#fbfcfb] p-4 sm:p-5">
      <label className="block text-sm font-medium text-[#38473e]">Onboarded resident<select required value={selectedResidentId} onChange={(event) => selectResident(event.target.value)} className={inputClass}><option value="">Select resident</option>{eligibleResidents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name} · {resident.email} · {properties.find((item) => item.id === resident.property_id)?.name ?? "PG"}</option>)}</select></label>
      {eligibleResidents.length === 0 && <p className="text-sm text-[#9a6b22]">Only current residents with verified emails can receive an agreement.</p>}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-[#38473e]">Monthly rent (₹)<input required type="number" min="0" step="0.01" value={rent} onChange={(event) => setRent(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium text-[#38473e]">Security deposit (₹)<input required type="number" min="0" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium text-[#38473e]">Agreement starts<input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium text-[#38473e]">Agreement duration<input readOnly value="11 months" className={`${inputClass} bg-[#f7faf7]`} /><span className="mt-1 block text-xs font-normal text-[#718078]">Ends {startsOn ? new Date(`${getAgreementEndDate(startsOn)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "11 months after start"}.</span></label></div>
      <label className="block text-sm font-medium text-[#38473e]">Additional terms (optional)<textarea rows={3} value={additionalTerms} onChange={(event) => setAdditionalTerms(event.target.value)} className={inputClass} placeholder="Any additional terms agreed with this resident" /></label>
      <details className="rounded-lg border border-[#e8ede8] bg-white p-3"><summary className="cursor-pointer text-sm font-medium text-[#167354]">Preview auto-filled agreement</summary><div className="mt-4 max-h-[32rem] overflow-auto"><RentalAgreementDocument terms={agreementPreview} /></div></details>
      <div className="flex items-start gap-2 rounded-lg border border-[#eee2c9] bg-[#fffcf4] p-3 text-xs leading-5 text-[#756547]"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><p>This creates a reviewable typed-signature agreement, not a certified e-signature or jurisdiction-approved legal document. Have the terms reviewed for your location before relying on them.</p></div>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving || !selectedResident || !property} className="py-2.5">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <FileSignature size={16} />}Create and send to student portal</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)} className="py-2.5">Cancel</Button></div>
    </form>}

    {agreements.length ? <div className="divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] bg-white px-4">{agreements.map((agreement) => <article key={agreement.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#34443a]">{agreement.agreement_number}</p><p className="mt-1 text-sm text-[#718078]">{residents.find((resident) => resident.id === agreement.student_id)?.full_name ?? "Resident"} · {properties.find((item) => item.id === agreement.property_id)?.name ?? "PG"}</p><p className="mt-1 text-xs text-[#89948d]">{amount(agreement.monthly_rent_paise)} / month · {agreement.starts_on}{agreement.ends_on ? ` to ${agreement.ends_on}` : ""}</p>{agreement.status === "signed" && <p className="mt-1 text-xs text-[#26714f]">Signed by {agreement.student_signature_name} · {agreement.signed_at ? new Date(agreement.signed_at).toLocaleString("en-IN") : ""}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs capitalize ${agreement.status === "signed" ? "bg-[#eff7f1] text-[#26714f]" : "bg-[#fff8e9] text-[#8a6825]"}`}>{agreement.status.replaceAll("_", " ")}</span><Button type="button" variant="outline" disabled={deletingAgreementId === agreement.id} onClick={() => deleteAgreement(agreement)} className="py-2 text-sm text-[#9b413c] hover:bg-[#fff7f6]">{deletingAgreementId === agreement.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}Delete</Button></div></div><details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-[#167354]">View agreement</summary><div className="mt-3"><RentalAgreementDocument terms={agreement.owner_terms} /></div></details></article>)}</div> : <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">No rental agreements yet.</p>}
  </section>;
}
