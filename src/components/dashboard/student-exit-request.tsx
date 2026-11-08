"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, LoaderCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Notice = { id: string; expected_checkout: string; submitted_at: string; reason: string | null; status: string; owner_response: string | null; expected_deposit_refund_paise: number };
const money = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function StudentExitRequest({ securityDepositPaise, notices }: { securityDepositPaise: number; notices: Notice[] }) {
  const router = useRouter();
  const activeNotice = notices.find((notice) => ["pending", "approved"].includes(notice.status));
  const [leavingDate, setLeavingDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return dateValue(date);
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().rpc("resident_request_exit_notice", {
      target_expected_checkout: leavingDate,
      target_reason: reason.trim() || null,
    });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Your exit request has been sent to the PG owner." });
      setReason("");
      router.refresh();
    }
    setBusy(false);
  }

  async function withdrawRequest() {
    if (!activeNotice || !window.confirm("Withdraw your exit request? Your resident status will return to Active.")) return;
    setWithdrawing(true);
    setNotice(null);
    const { error } = await createClient().rpc("resident_withdraw_exit_notice", { target_notice_id: activeNotice.id });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Your exit request was withdrawn. Your resident status is active again." });
      router.refresh();
    }
    setWithdrawing(false);
  }

  return <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff8e9] text-[#92702a]"><LogOut size={18} /></span><div><h2 className="text-lg font-semibold text-[#24332b]">Exit from PG</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Submit your expected leaving date to notify your PG owner.</p></div></div>
    <div className="mt-4 rounded-lg border border-[#eee2c9] bg-[#fffcf4] p-3 text-sm leading-6 text-[#756547]"><p>Your estimated security deposit refund is <strong>{money(Math.floor(securityDepositPaise / 2))}</strong> (50% of your recorded deposit). This is an estimate; the owner will confirm the final amount after checking outstanding rent, charges, and property condition.</p></div>
    {activeNotice ? <div className="mt-4 rounded-lg border border-[#dce9e1] bg-[#f7faf7] p-4"><div className="flex items-center gap-2 text-sm font-semibold capitalize text-[#34443a]"><CheckCircle2 size={16} className="text-[#167354]" />Exit request {activeNotice.status}</div><p className="mt-2 text-sm text-[#526058]">Leaving date: {new Date(`${activeNotice.expected_checkout}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p><p className="mt-1 text-sm text-[#526058]">Estimated refund: {money(activeNotice.expected_deposit_refund_paise)}</p>{activeNotice.reason && <p className="mt-2 whitespace-pre-wrap text-sm text-[#718078]">{activeNotice.reason}</p>}{activeNotice.owner_response && <p className="mt-2 border-t border-[#e4ebe5] pt-2 text-sm text-[#718078]">Owner response: {activeNotice.owner_response}</p>}<Button type="button" variant="outline" disabled={withdrawing} onClick={() => void withdrawRequest()} className="mt-4 py-2 text-sm">{withdrawing ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />}Withdraw exit request</Button></div> : <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium text-[#38473e]">Expected leaving date<div className="relative mt-1.5"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718078]" /><input required type="date" min={dateValue(new Date())} value={leavingDate} onChange={(event) => setLeavingDate(event.target.value)} className="w-full rounded-lg border border-[#dfe6e1] bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-[#63a888]" /></div></label>
      <label className="block text-sm font-medium text-[#38473e]">Message to owner (optional)<textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#63a888]" placeholder="Add any details about your move-out" /></label>
      <Button type="submit" disabled={busy} className="py-2.5">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}Submit exit request</Button>
    </form>}
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-lg border px-3 py-2 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
  </section>;
}
