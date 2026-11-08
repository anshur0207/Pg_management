"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FilePlus2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type PropertyOption = { id: string; name: string; status: string };
type ResidentOption = { id: string; full_name: string; property_id: string; status: string; archived_at: string | null; monthly_rent_paise: number };
type Invoice = { id: string; property_id: string; student_id: string; invoice_number: string; billing_period_start: string; billing_period_end: string; issued_at: string; due_date: string; total_paise: number; amount_paid_paise: number; status: string; notes: string | null };
type CashPayment = { id: string; student_id: string; invoice_id: string | null; amount_paise: number; method: string; status: string; created_at: string };

const amount = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const localMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function OwnerInvoiceManager({ properties, residents, activeStudentIds, invoices, payments }: { properties: PropertyOption[]; residents: ResidentOption[]; activeStudentIds: string[]; invoices: Invoice[]; payments: CashPayment[] }) {
  const router = useRouter();
  const activeProperties = properties.filter((property) => property.status === "active");
  const activeResidents = residents.filter((resident) => activeStudentIds.includes(resident.id) && !resident.archived_at && !["inactive", "checked_out"].includes(resident.status));
  const [propertyId, setPropertyId] = useState(activeProperties[0]?.id ?? "");
  const propertyResidents = activeResidents.filter((resident) => resident.property_id === propertyId);
  const [studentId, setStudentId] = useState(propertyResidents[0]?.id ?? "");
  const selectedResident = propertyResidents.find((resident) => resident.id === studentId);
  const [period, setPeriod] = useState(localMonth());
  const [dueDate, setDueDate] = useState(localDate(new Date()));
  const [manualAmount, setManualAmount] = useState(selectedResident ? (selectedResident.monthly_rent_paise / 100).toFixed(2) : "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const residentNames = new Map(residents.map((resident) => [resident.id, resident.full_name]));
  const propertyNames = new Map(properties.map((property) => [property.id, property.name]));
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const pendingCash = payments.filter((payment) => payment.method === "cash" && payment.status === "pending" && payment.invoice_id);

  function changeProperty(nextPropertyId: string) {
    const nextResident = activeResidents.find((resident) => resident.property_id === nextPropertyId);
    setPropertyId(nextPropertyId);
    setStudentId(nextResident?.id ?? "");
    setManualAmount(nextResident ? (nextResident.monthly_rent_paise / 100).toFixed(2) : "");
  }

  async function createManualInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResident || !period) {
      setNotice({ kind: "error", text: "Choose a property, current resident, and billing month." });
      return;
    }
    const amountPaise = Math.round(Number(manualAmount) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      setNotice({ kind: "error", text: "Enter an invoice amount greater than zero." });
      return;
    }
    setSaving(true);
    setNotice(null);
    const { error } = await createClient().rpc("owner_create_manual_invoice", {
      target_property_id: propertyId,
      target_student_id: selectedResident.id,
      target_period_start: `${period}-01`,
      target_due_date: dueDate,
      target_amount_paise: amountPaise,
      target_notes: notes.trim() || null,
    });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: `Invoice created and sent to ${selectedResident.full_name}'s resident dashboard.` });
      setNotes("");
      router.refresh();
    }
    setSaving(false);
  }

  async function confirmCash(payment: CashPayment) {
    if (!window.confirm(`Confirm receipt of ${amount(payment.amount_paise)} cash from ${residentNames.get(payment.student_id) ?? "this resident"}? This will mark the payment and invoice accordingly.`)) return;
    setConfirmingId(payment.id);
    setNotice(null);
    const { error } = await createClient().rpc("owner_confirm_cash_invoice_payment", { target_payment_id: payment.id });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Cash receipt confirmed; the payment and invoice are updated." });
      router.refresh();
    }
    setConfirmingId(null);
  }

  async function rejectCash(payment: CashPayment) {
    if (!window.confirm(`Decline the cash payment report from ${residentNames.get(payment.student_id) ?? "this resident"}? The invoice will remain unpaid.`)) return;
    setConfirmingId(payment.id);
    setNotice(null);
    const { error } = await createClient().rpc("owner_reject_cash_invoice_payment", { target_payment_id: payment.id });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Cash report declined. The invoice remains due." });
      router.refresh();
    }
    setConfirmingId(null);
  }

  return <section className="space-y-5">
    <div><h2 className="text-xl font-semibold text-[#24332b]">Invoices</h2><p className="mt-1 text-sm text-[#718078]">Monthly rent invoices are generated automatically on the 2nd. You can also add a resident-specific invoice.</p></div>
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

    <details className="rounded-xl border border-[#e8ede8] bg-[#fbfcfb] p-4"><summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#34443a]"><FilePlus2 size={17} className="text-[#167354]" />Create manual invoice</summary>
      <form onSubmit={createManualInvoice} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#38473e]">Property<select required value={propertyId} onChange={(event) => changeProperty(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5"><option value="">Select property</option>{activeProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label className="text-sm font-medium text-[#38473e]">Current resident<select required value={studentId} onChange={(event) => { setStudentId(event.target.value); const resident = propertyResidents.find((item) => item.id === event.target.value); setManualAmount(resident ? (resident.monthly_rent_paise / 100).toFixed(2) : ""); }} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5"><option value="">Select resident</option>{propertyResidents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}</option>)}</select></label>
        <label className="text-sm font-medium text-[#38473e]">Billing month<input required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-[#38473e]">Payment due date<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-[#38473e]">Amount (₹)<input required type="number" min="0.01" step="0.01" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-[#38473e]">Description / notes<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5" placeholder="e.g. Monthly rent, electricity" /></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={saving || !selectedResident} className="py-2.5">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <FilePlus2 size={16} />}Create and send invoice</Button>{propertyId && propertyResidents.length === 0 && <p className="mt-2 text-sm text-[#9a6b22]">No current residents with an active stay at this property.</p>}</div>
      </form>
    </details>

    {pendingCash.length > 0 && <section className="rounded-xl border border-[#eee2c9] bg-[#fffcf4] p-4"><h3 className="font-semibold text-[#756547]">Cash payments to confirm</h3><div className="mt-2 divide-y divide-[#eee2c9]">{pendingCash.map((payment) => { const invoice = payment.invoice_id ? invoiceMap.get(payment.invoice_id) : undefined; return <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-[#34443a]">{residentNames.get(payment.student_id) ?? "Resident"} · {amount(payment.amount_paise)}</p><p className="mt-1 text-xs text-[#718078]">{invoice?.invoice_number ?? "Invoice"} · {invoice ? propertyNames.get(invoice.property_id) : "Property"} · reported {new Date(payment.created_at).toLocaleDateString("en-IN")}</p></div><div className="flex gap-2"><Button type="button" variant="outline" disabled={confirmingId === payment.id} onClick={() => void rejectCash(payment)} className="py-2 text-sm">Decline</Button><Button type="button" disabled={confirmingId === payment.id} onClick={() => void confirmCash(payment)} className="py-2 text-sm">{confirmingId === payment.id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Confirm received</Button></div></div>; })}</div></section>}

    {invoices.length ? <div className="overflow-x-auto rounded-xl border border-[#e8ede8] bg-white"><table className="w-full min-w-[790px] text-left text-sm"><thead><tr className="border-b border-[#edf0ed] text-xs uppercase tracking-wide text-[#89948d]"><th className="px-4 py-3 font-medium">Invoice / resident</th><th className="px-4 py-3 font-medium">Property · month</th><th className="px-4 py-3 font-medium">Bill · due</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Total · balance</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{invoices.map((invoice) => <tr key={invoice.id}><td className="px-4 py-3"><p className="font-medium text-[#34443a]">{invoice.invoice_number}</p><p className="mt-1 text-xs text-[#718078]">{residentNames.get(invoice.student_id) ?? "Resident"}</p></td><td className="px-4 py-3 text-[#526058]">{propertyNames.get(invoice.property_id) ?? "Property"}<p className="mt-1 text-xs text-[#718078]">{date(invoice.billing_period_start)} – {date(invoice.billing_period_end)}</p></td><td className="px-4 py-3 text-[#526058]">{date(invoice.issued_at)}<p className="mt-1 text-xs text-[#718078]">Due {date(invoice.due_date)}</p></td><td className="px-4 py-3"><span className="capitalize">{invoice.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-right font-medium text-[#34443a]">{amount(invoice.total_paise)}<p className="mt-1 text-xs text-[#718078]">{amount(Math.max(0, invoice.total_paise - invoice.amount_paid_paise))} balance</p></td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">No invoices yet. Monthly rent invoices will appear after the scheduled run on the 2nd.</p>}
  </section>;
}
