"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSignature, LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { RentalAgreementDocument } from "@/components/dashboard/rental-agreement-document";

type Agreement = {
  id: string;
  agreement_number: string;
  property_id: string;
  monthly_rent_paise: number;
  security_deposit_paise: number;
  starts_on: string;
  ends_on: string | null;
  premises_address: string;
  owner_terms: string;
  status: string;
  student_signature_name: string | null;
  signed_at: string | null;
  created_at: string;
};

const amount = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function StudentAgreements({ agreements, propertyName, profileName }: { agreements: Agreement[]; propertyName: string; profileName: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState(profileName);
  const [consent, setConsent] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function signAgreement(agreementId: string) {
    setBusyId(agreementId);
    setNotice(null);
    const { error } = await createClient().rpc("sign_rental_agreement", {
      target_agreement_id: agreementId,
      typed_signature: signature,
    });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Agreement signed and returned to your PG owner." });
      setConsent(false);
      router.refresh();
    }
    setBusyId(null);
  }

  async function downloadAgreement(agreement: Agreement) {
    if (!agreement.student_signature_name || !agreement.signed_at) {
      setNotice({ kind: "error", text: "The signed agreement details are not available yet. Refresh and try again." });
      return;
    }
    setDownloadId(agreement.id);
    setNotice(null);
    try {
      const { downloadRentalAgreementPdf } = await import("@/lib/download-rental-agreement-pdf");
      downloadRentalAgreementPdf({
        agreementNumber: agreement.agreement_number,
        terms: agreement.owner_terms,
        signedName: agreement.student_signature_name,
        signedAt: agreement.signed_at,
      });
    } catch {
      setNotice({ kind: "error", text: "Could not create the PDF. Please try again." });
    } finally {
      setDownloadId(null);
    }
  }

  return <section className="space-y-4">
    {notice && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
    {agreements.length ? agreements.map((agreement) => <article key={agreement.id} className="rounded-xl border border-[#e4ebe5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-[#167354]">{agreement.agreement_number}</p><h3 className="mt-1 text-lg font-semibold text-[#24332b]">Stay agreement · {propertyName}</h3><p className="mt-1 text-sm text-[#718078]">{date(agreement.starts_on)}{agreement.ends_on ? ` – ${date(agreement.ends_on)}` : " · No end date specified"}</p></div><span className={`rounded-full px-3 py-1 text-xs capitalize ${agreement.status === "signed" ? "bg-[#eff7f1] text-[#26714f]" : "bg-[#fff8e9] text-[#8a6825]"}`}>{agreement.status.replaceAll("_", " ")}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-[#f7faf7] p-3"><p className="text-xs text-[#718078]">Monthly rent</p><p className="mt-1 font-semibold text-[#34443a]">{amount(agreement.monthly_rent_paise)}</p></div><div className="rounded-lg bg-[#f7faf7] p-3"><p className="text-xs text-[#718078]">Security deposit</p><p className="mt-1 font-semibold text-[#34443a]">{amount(agreement.security_deposit_paise)}</p></div></div>
      <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-[#167354]">Read full agreement</summary><div className="mt-3"><RentalAgreementDocument terms={agreement.owner_terms} /></div></details>
      {agreement.status === "pending_signature" ? <div className="mt-5 border-t border-[#edf0ed] pt-4"><div className="flex items-start gap-2 rounded-lg border border-[#eee2c9] bg-[#fffcf4] p-3 text-xs leading-5 text-[#756547]"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><p>Please read the complete document. A typed-name signature is recorded with its submission time. Whether it meets local e-signature requirements depends on your jurisdiction; ask the PG owner for a compliant signing process if needed.</p></div><label className="mt-4 block text-sm font-medium text-[#38473e]">Type your full legal name to sign<input value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label><label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-[#526058]"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-[#167354]" /><span>I have read this agreement and intend my typed name to be my electronic signature.</span></label><Button type="button" disabled={!consent || !signature.trim() || busyId === agreement.id} onClick={() => signAgreement(agreement.id)} className="mt-4 py-2.5">{busyId === agreement.id ? <LoaderCircle size={16} className="animate-spin" /> : <FileSignature size={16} />}Sign and submit</Button></div> : agreement.status === "signed" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#eff7f1] px-3 py-2"><p className="text-sm text-[#26714f]">Signed by {agreement.student_signature_name} · {agreement.signed_at ? new Date(agreement.signed_at).toLocaleString("en-IN") : ""}</p><Button type="button" variant="outline" disabled={downloadId === agreement.id} onClick={() => downloadAgreement(agreement)} className="py-2 text-sm">{downloadId === agreement.id ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}Download PDF</Button></div> : <p className="mt-4 text-sm text-[#718078]">This agreement is no longer active.</p>}
    </article>) : <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">Your PG has not shared a stay agreement yet.</p>}
  </section>;
}
