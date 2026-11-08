"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type NoticeRequest = {
  id: string;
  student_id: string;
  expected_checkout: string;
  submitted_at: string;
  reason: string | null;
  status: string;
  owner_response: string | null;
  expected_deposit_refund_paise: number;
  resident_name: string;
  property_name: string;
  floor_name: string;
  room_number: string;
  bed_number: string;
};

const amount = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function OwnerNoticeManager({ notices }: { notices: NoticeRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function review(item: NoticeRequest, decision: "approved" | "rejected") {
    setBusyId(item.id);
    setError(null);
    setMessage(null);
    const { error: rpcError } = await createClient().rpc("owner_review_exit_notice", {
      target_notice_id: item.id,
      target_decision: decision,
      target_response: responses[item.id]?.trim() || null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(decision === "approved" ? `Exit request approved for ${item.resident_name}.` : `Exit request declined for ${item.resident_name}.`);
      router.refresh();
    }
    setBusyId(null);
  }

  const pendingCount = notices.filter((item) => item.status === "pending").length;

  return <section className="space-y-4">
    <div><h2 className="text-xl font-semibold text-[#24332b]">Notice requests <span className="ml-2 rounded-full bg-[#fff3dc] px-2.5 py-1 text-sm font-semibold text-[#86631f]">{pendingCount}</span></h2><p className="mt-1 text-sm text-[#718078]">Review move-out dates, current room assignment, and the estimated deposit refund.</p></div>
    {error && <p role="alert" className="rounded-lg border border-[#f0d7d4] bg-[#fff7f6] px-4 py-3 text-sm text-[#9b413c]">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-[#cfe7d7] bg-[#f2faf4] px-4 py-3 text-sm text-[#286344]">{message}</p>}
    {notices.length ? <div className="space-y-3">{notices.map((item) => <article key={item.id} className="rounded-xl border border-[#e6ece7] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold text-[#34443a]">{item.resident_name}</p><p className="mt-1 text-sm text-[#718078]">{item.property_name} · {item.floor_name} · Room {item.room_number} · Bed {item.bed_number}</p></div><span className={`rounded-full px-3 py-1 text-xs capitalize ${item.status === "pending" ? "bg-[#fff8e9] text-[#8a6825]" : item.status === "approved" ? "bg-[#eff7f1] text-[#26714f]" : item.status === "rejected" ? "bg-[#fff0ef] text-[#9b413c]" : "bg-[#f2f5f2] text-[#627068]"}`}>{item.status.replaceAll("_", " ")}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#f7faf7] p-3"><p className="text-xs text-[#89948d]">Leaving date</p><p className="mt-1 text-sm font-semibold text-[#34443a]">{date(item.expected_checkout)}</p></div><div className="rounded-lg bg-[#f7faf7] p-3"><p className="text-xs text-[#89948d]">Estimated refund · 50%</p><p className="mt-1 text-sm font-semibold text-[#34443a]">{amount(item.expected_deposit_refund_paise)}</p></div><div className="rounded-lg bg-[#f7faf7] p-3"><p className="text-xs text-[#89948d]">Request received</p><p className="mt-1 text-sm font-semibold text-[#34443a]">{new Date(item.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div></div>
      {item.reason && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#526058]">{item.reason}</p>}
      {item.owner_response && <p className="mt-3 rounded-lg bg-[#f7faf7] p-3 text-sm text-[#526058]">{item.status === "withdrawn" ? "Request update" : "Your response"}: {item.owner_response}</p>}
      {item.status === "pending" && <div className="mt-4 border-t border-[#edf0ed] pt-4"><label className="block text-sm font-medium text-[#38473e]">Response to resident (optional)<textarea rows={2} maxLength={1000} value={responses[item.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3 py-2.5 text-sm outline-none focus:border-[#63a888]" placeholder="Next steps or reason for declining" /></label><p className="mt-2 text-xs leading-5 text-[#89948d]">Approval marks the stay as checkout pending. The 50% amount is an estimate; complete any refund after final inspection and settlement.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" disabled={busyId === item.id} onClick={() => void review(item, "approved")} className="py-2 text-sm">{busyId === item.id ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}Approve request</Button><Button type="button" variant="outline" disabled={busyId === item.id} onClick={() => void review(item, "rejected")} className="py-2 text-sm text-[#9b413c]"><X size={15} />Decline request</Button></div></div>}
    </article>)}</div> : <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">Residents’ submitted exit requests will appear here.</p>}
  </section>;
}
