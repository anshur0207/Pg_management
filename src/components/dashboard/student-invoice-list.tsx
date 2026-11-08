"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Download, FileText, LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { InvoicePdfData } from "@/lib/invoice-pdf";

type Invoice = {
  id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  issued_at: string;
  due_date: string;
  subtotal_paise: number;
  total_paise: number;
  amount_paid_paise: number;
  status: string;
  notes: string | null;
};
type InvoiceItem = { invoice_id: string; description: string; quantity: number; amount_paise: number };
type Props = { invoices: Invoice[]; items: InvoiceItem[]; pendingCashInvoiceIds: string[]; propertyName: string; residentName: string; onlinePaymentsEnabled: boolean };

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void }; }
}

const amount = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function StudentInvoiceList({ invoices, items, pendingCashInvoiceIds, propertyName, residentName, onlinePaymentsEnabled }: Props) {
  const router = useRouter();
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function buildPdf(invoice: Invoice): InvoicePdfData {
    return {
      invoiceNumber: invoice.invoice_number,
      residentName,
      propertyName,
      billingStart: invoice.billing_period_start,
      billingEnd: invoice.billing_period_end,
      issuedAt: invoice.issued_at,
      dueDate: invoice.due_date,
      totalPaise: invoice.total_paise,
      paidPaise: invoice.amount_paid_paise,
      status: invoice.status,
      notes: invoice.notes,
      items: items.filter((item) => item.invoice_id === invoice.id).map(({ description, quantity, amount_paise }) => ({ description, quantity: Number(quantity), amountPaise: amount_paise })),
    };
  }

  async function downloadPdf(invoice: Invoice) {
    const { downloadInvoicePdf } = await import("@/lib/invoice-pdf");
    downloadInvoicePdf(buildPdf(invoice));
  }

  async function requestCash(invoice: Invoice) {
    setBusyInvoiceId(invoice.id);
    setNotice(null);
    const { error } = await createClient().rpc("resident_request_cash_invoice_payment", { target_invoice_id: invoice.id });
    setNotice(error ? { kind: "error", text: error.message } : { kind: "success", text: "Cash payment reported. It will show as paid after your PG owner confirms receipt." });
    if (!error) router.refresh();
    setBusyInvoiceId(null);
  }

  async function payOnline(invoice: Invoice) {
    setBusyInvoiceId(invoice.id);
    setNotice(null);
    try {
      const response = await fetch("/api/invoices/create-razorpay-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: invoice.id }) });
      const order = await response.json() as { error?: string; orderId?: string; paymentId?: string; keyId?: string; amount?: number; currency?: string; invoiceNumber?: string; student?: { name: string; email: string; phone: string } };
      if (!response.ok || !order.orderId || !order.paymentId || !order.keyId) throw new Error(order.error ?? "Could not start online payment.");
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Online payment checkout could not be loaded.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: propertyName,
        description: `Invoice ${order.invoiceNumber}`,
        order_id: order.orderId,
        prefill: { name: order.student?.name, email: order.student?.email, contact: order.student?.phone },
        notes: { invoice_id: invoice.id, payment_id: order.paymentId },
        handler: async (result: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyResponse = await fetch("/api/invoices/verify-razorpay-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: invoice.id, orderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, signature: result.razorpay_signature }),
          });
          const verification = await verifyResponse.json() as { error?: string; verified?: boolean };
          if (!verifyResponse.ok || !verification.verified) {
            setNotice({ kind: "error", text: verification.error ?? "Payment is not verified yet. Refresh shortly or contact your PG owner." });
            setBusyInvoiceId(null);
            return;
          }
          setNotice({ kind: "success", text: "Payment verified. Your invoice has been updated." });
          setBusyInvoiceId(null);
          router.refresh();
        },
        theme: { color: "#167354" },
        modal: { ondismiss: () => setBusyInvoiceId(null) },
      });
      checkout.on("payment.failed", (response) => {
        setNotice({ kind: "error", text: response.error?.description ?? "Payment was not completed. You can try again or choose cash payment." });
        setBusyInvoiceId(null);
      });
      checkout.open();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to start online payment." });
      setBusyInvoiceId(null);
    }
  }

  return <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#24332b]">Invoices</h2><p className="mt-1 text-sm text-[#718078]">Review your bills, choose a payment option, and download receipts.</p></div><FileText size={19} className="text-[#167354]" /></div>
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
    {invoices.length ? <div className="mt-4 space-y-3">{invoices.map((invoice) => {
      const balance = Math.max(0, invoice.total_paise - invoice.amount_paid_paise);
      const invoiceItems = items.filter((item) => item.invoice_id === invoice.id);
      const cashPending = pendingCashInvoiceIds.includes(invoice.id);
      return <article key={invoice.id} className="rounded-xl border border-[#e6ece7] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#34443a]">{invoice.invoice_number}</p><p className="mt-1 text-sm text-[#718078]">{date(invoice.billing_period_start)} – {date(invoice.billing_period_end)} · Bill date {date(invoice.issued_at)}</p><p className="mt-1 text-sm text-[#718078]">Due {date(invoice.due_date)} · <span className="capitalize">{invoice.status.replaceAll("_", " ")}</span></p></div><p className="text-lg font-semibold text-[#24332b]">{amount(balance)} due</p></div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-[#167354]">Invoice details</summary><div className="mt-3 rounded-lg bg-[#f7faf7] p-3"><div className="divide-y divide-[#e7ece8]">{invoiceItems.map((item, index) => <div key={`${item.invoice_id}-${index}`} className="flex justify-between gap-3 py-2 text-sm"><span className="text-[#526058]">{item.description}{Number(item.quantity) > 1 ? ` × ${item.quantity}` : ""}</span><span className="font-medium text-[#34443a]">{amount(item.amount_paise)}</span></div>)}</div><div className="mt-2 flex justify-between border-t border-[#dfe8e1] pt-2 text-sm font-semibold text-[#34443a]"><span>Total billed</span><span>{amount(invoice.total_paise)}</span></div>{invoice.amount_paid_paise > 0 && <div className="mt-1 flex justify-between text-sm text-[#26714f]"><span>Paid</span><span>{amount(invoice.amount_paid_paise)}</span></div>}{invoice.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-[#718078]">{invoice.notes}</p>}</div></details>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => void downloadPdf(invoice)} className="py-2 text-sm"><Download size={15} />Download PDF</Button>{balance > 0 && !["paid", "cancelled"].includes(invoice.status) && (cashPending ? <span className="rounded-lg bg-[#fff8e9] px-3 py-2 text-xs font-medium text-[#8a6825]">Cash payment reported · awaiting owner confirmation</span> : <>
          {onlinePaymentsEnabled ? <Button type="button" disabled={busyInvoiceId === invoice.id} onClick={() => void payOnline(invoice)} className="py-2 text-sm">{busyInvoiceId === invoice.id ? <LoaderCircle size={15} className="animate-spin" /> : <LockKeyhole size={15} />}Pay online</Button> : <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f2f5f2] px-3 py-2 text-xs text-[#718078]"><LockKeyhole size={14} />Online payment setup required</span>}
          <Button type="button" variant="outline" disabled={busyInvoiceId === invoice.id} onClick={() => void requestCash(invoice)} className="py-2 text-sm"><Banknote size={15} />I paid cash</Button>
        </>)}</div>
      </article>;
    })}</div> : <p className="mt-4 rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">No invoices have been issued yet.</p>}
  </section>;
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay checkout.")), { once: true });
      if (window.Razorpay) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  });
}
