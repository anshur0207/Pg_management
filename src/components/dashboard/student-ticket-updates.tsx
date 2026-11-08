"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageSquareText, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type StudentTicket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
};

type TicketReply = {
  id: string;
  author_user_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

const displayDate = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function StudentTicketUpdates({ tickets, userId }: { tickets: StudentTicket[]; userId: string }) {
  const [selectedTicket, setSelectedTicket] = useState<StudentTicket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTicketId = selectedTicket?.id;

  useEffect(() => {
    if (!selectedTicketId) return;
    let active = true;

    async function refreshReplies(isBackground = false) {
      if (!isBackground && active) setLoading(true);
      if (isBackground && active) setRefreshing(true);
      const { data, error: queryError } = await createClient()
        .from("ticket_comments")
        .select("id, author_user_id, body, is_internal, created_at")
        .eq("ticket_id", selectedTicketId)
        .order("created_at", { ascending: true });
      if (active) {
        if (queryError) setError(queryError.message);
        else {
          setError(null);
          setReplies((data ?? []) as TicketReply[]);
        }
        setLoading(false);
        setRefreshing(false);
      }
    }

    void refreshReplies();
    const interval = window.setInterval(() => void refreshReplies(true), 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicket) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedTicket(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicket]);

  function openTicket(ticket: StudentTicket) {
    setReplies([]);
    setError(null);
    setLoading(true);
    setSelectedTicket(ticket);
  }

  return (
    <>
      {tickets.length ? <div className="mt-4 divide-y divide-[#edf0ed]">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => openTicket(ticket)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#167354]"><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#34443a]">{ticket.title}</span><span className="mt-1 block text-sm text-[#718078]">{ticket.ticket_number} · {new Date(ticket.created_at).toLocaleDateString("en-IN")}</span></span><span className="shrink-0 rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs capitalize text-[#627068]">{ticket.status.replaceAll("_", " ")}</span></button>)}</div> : <p className="mt-4 rounded-lg bg-[#f7faf7] px-4 py-4 text-sm leading-6 text-[#718078]">You have not sent a help request yet.</p>}

      {selectedTicket && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
        <button type="button" aria-label="Close ticket updates" className="absolute inset-0 bg-[#17241f]/45" onClick={() => setSelectedTicket(null)} />
        <section role="dialog" aria-modal="true" aria-labelledby="student-ticket-title" className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-[#edf0ed] px-5 py-4 sm:px-6"><div><p className="text-xs font-medium uppercase tracking-wide text-[#167354]">{selectedTicket.ticket_number}</p><h2 id="student-ticket-title" className="mt-1 text-xl font-semibold text-[#24332b]">{selectedTicket.title}</h2><p className="mt-1 text-sm capitalize text-[#718078]">{selectedTicket.status.replaceAll("_", " ")} · {selectedTicket.priority} priority</p></div><button type="button" onClick={() => setSelectedTicket(null)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#f2f5f2]"><X size={19} /></button></header>
          <div className="overflow-y-auto px-5 py-5 sm:px-6"><div className="rounded-xl bg-[#f7faf7] p-4"><p className="text-sm font-semibold text-[#34443a]">Your request</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526058]">{selectedTicket.description}</p><p className="mt-3 text-xs text-[#89948d]">Opened {displayDate(selectedTicket.created_at)}</p></div>
            <div className="mt-6 flex items-center justify-between gap-3"><h3 className="inline-flex items-center gap-2 font-semibold text-[#34443a]"><MessageSquareText size={17} className="text-[#167354]" />Messages from your PG</h3><span aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-[#89948d]">{refreshing ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={12} />}Updates every few seconds</span></div>
            {loading ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#718078]"><LoaderCircle size={15} className="animate-spin" />Loading messages…</p> : replies.length ? <div className="mt-3 space-y-3">{replies.filter((reply) => !reply.is_internal).map((reply) => <article key={reply.id} className={`rounded-xl border p-3.5 ${reply.author_user_id === userId ? "border-[#dfe6e1] bg-[#fbfcfb]" : "border-[#cfe7d7] bg-[#f2faf4]"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#526058]">{reply.author_user_id === userId ? "You" : "PG owner / team"}</p><time className="text-xs text-[#89948d]">{displayDate(reply.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">{reply.body}</p></article>)}</div> : <p className="mt-3 text-sm text-[#89948d]">No replies yet. Your PG team’s response will appear here.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-[#f0d7d4] bg-[#fff7f6] px-3 py-2 text-sm text-[#9b413c]">Could not refresh messages: {error}</p>}
          </div>
        </section>
      </div>}
    </>
  );
}
