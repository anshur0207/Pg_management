"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type OwnerTicket = {
  id: string;
  student_id: string;
  property_id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resident_name: string;
  property_name: string;
};

type TicketComment = {
  id: string;
  author_user_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

type TicketFilter = "open" | "closed" | "all";

const closedStatuses = new Set(["resolved", "closed"]);
const displayDate = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function OwnerTicketManager({
  ownerId,
  userId,
  tickets,
}: {
  ownerId: string;
  userId: string;
  tickets: OwnerTicket[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TicketFilter>("open");
  const [selectedTicket, setSelectedTicket] = useState<OwnerTicket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const openCount = tickets.filter((ticket) => !closedStatuses.has(ticket.status)).length;
  const closedCount = tickets.filter((ticket) => closedStatuses.has(ticket.status)).length;
  const selectedTicketId = selectedTicket?.id;
  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    if (filter === "open") return !closedStatuses.has(ticket.status);
    if (filter === "closed") return closedStatuses.has(ticket.status);
    return true;
  }), [filter, tickets]);

  useEffect(() => {
    if (!selectedTicketId) return;
    let active = true;

    void createClient()
      .from("ticket_comments")
      .select("id, author_user_id, body, is_internal, created_at")
      .eq("owner_id", ownerId)
      .eq("ticket_id", selectedTicketId)
      .order("created_at", { ascending: true })
      .then((result: { data: TicketComment[] | null; error: { message: string } | null }) => {
        if (!active) return;
        if (result.error) setNotice({ kind: "error", text: result.error.message });
        else setComments(result.data ?? []);
        setCommentsLoading(false);
      });

    return () => { active = false; };
  }, [ownerId, selectedTicketId]);

  useEffect(() => {
    if (!selectedTicket) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedTicket(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicket]);

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = String(values.get("reply") ?? "").trim();
    if (body.length < 2) return;

    setReplyBusy(true);
    setNotice(null);
    const { data, error } = await createClient()
      .from("ticket_comments")
      .insert({
        owner_id: ownerId,
        ticket_id: selectedTicket.id,
        author_user_id: userId,
        body,
        is_internal: false,
      })
      .select("id, author_user_id, body, is_internal, created_at")
      .single();

    if (error) {
      setNotice({ kind: "error", text: error.message });
    } else {
      setComments((previous) => [...previous, data as TicketComment]);
      setNotice({ kind: "success", text: "Your reply was sent to the resident." });
      form.reset();
    }
    setReplyBusy(false);
  }

  function openTicket(ticket: OwnerTicket) {
    setCommentsLoading(true);
    setComments([]);
    setNotice(null);
    setSelectedTicket(ticket);
  }

  async function resolveTicket() {
    if (!selectedTicket || closedStatuses.has(selectedTicket.status)) return;
    setResolveBusy(true);
    setNotice(null);
    const resolvedAt = new Date().toISOString();
    const { error } = await createClient()
      .from("tickets")
      .update({ status: "resolved", resolved_at: resolvedAt })
      .eq("id", selectedTicket.id)
      .eq("owner_id", ownerId);

    if (error) {
      setNotice({ kind: "error", text: error.message });
    } else {
      const resolved = { ...selectedTicket, status: "resolved" };
      setSelectedTicket(resolved);
      setNotice({ kind: "success", text: "Ticket marked resolved and moved to Closed tickets." });
      setFilter("closed");
      router.refresh();
    }
    setResolveBusy(false);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm font-medium text-[#38473e]">Show tickets
          <select value={filter} onChange={(event) => setFilter(event.target.value as TicketFilter)} className="mt-1.5 block rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]">
            <option value="open">Open tickets ({openCount})</option>
            <option value="closed">Closed tickets ({closedCount})</option>
            <option value="all">All tickets ({tickets.length})</option>
          </select>
        </label>
        <p className="text-sm text-[#718078]">Select a ticket to read and reply.</p>
      </div>

      {visibleTickets.length === 0 ? <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm leading-6 text-[#718078]">{filter === "closed" ? "No resolved tickets yet." : "There are no tickets in this view."}</p> : <div className="divide-y divide-[#edf0ed]">
        {visibleTickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => openTicket(ticket)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left first:pt-0 last:pb-0 hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#167354]">
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[#34443a]">{ticket.title}</span><span className="mt-1 block text-xs text-[#89948d]">{ticket.ticket_number} · {ticket.resident_name} · {ticket.property_name}</span></span>
          <span className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs capitalize ${ticket.priority === "urgent" || ticket.priority === "high" ? "bg-[#fff0ed] text-[#a84337]" : "bg-[#f2f5f2] text-[#627068]"}`}>{ticket.priority}</span><span className="rounded-full bg-[#eff7f1] px-2.5 py-1 text-xs capitalize text-[#26714f]">{ticket.status.replaceAll("_", " ")}</span></span>
        </button>)}
      </div>}

      {selectedTicket && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
        <button type="button" aria-label="Close ticket details" className="absolute inset-0 bg-[#17241f]/45" onClick={() => setSelectedTicket(null)} />
        <section role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title" className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-[#edf0ed] px-5 py-4 sm:px-6">
            <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-[#167354]">{selectedTicket.ticket_number} · {selectedTicket.category}</p><h2 id="ticket-dialog-title" className="mt-1 text-xl font-semibold text-[#24332b]">{selectedTicket.title}</h2><p className="mt-1 text-sm text-[#718078]">{selectedTicket.resident_name} · {selectedTicket.property_name}</p></div>
            <button type="button" onClick={() => setSelectedTicket(null)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#f2f5f2]"><X size={19} /></button>
          </header>

          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-xl bg-[#f7faf7] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#34443a]">Issue details</p><p className="text-xs text-[#89948d]">{displayDate(selectedTicket.created_at)}</p></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526058]">{selectedTicket.description}</p><div className="mt-3 flex items-center gap-2 text-xs capitalize text-[#718078]"><span>Priority: {selectedTicket.priority}</span><span>·</span><span>Status: {selectedTicket.status.replaceAll("_", " ")}</span></div></div>

            <div className="mt-6"><div className="flex items-center gap-2"><MessageSquareText size={17} className="text-[#167354]" /><h3 className="font-semibold text-[#34443a]">Conversation</h3></div>
              {commentsLoading ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#718078]"><LoaderCircle size={15} className="animate-spin" />Loading messages…</p> : comments.length ? <div className="mt-3 space-y-3">{comments.map((comment) => <article key={comment.id} className={`rounded-xl border p-3.5 ${comment.author_user_id === userId ? "border-[#cfe7d7] bg-[#f2faf4]" : "border-[#e8ede8] bg-white"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#526058]">{comment.author_user_id === userId ? "You · PG team" : "Resident"}{comment.is_internal && <span className="ml-2 rounded bg-[#f2f5f2] px-1.5 py-0.5 font-normal">Internal</span>}</p><time className="text-xs text-[#89948d]">{displayDate(comment.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">{comment.body}</p></article>)}</div> : <p className="mt-3 text-sm text-[#89948d]">No replies yet.</p>}
            </div>

            {notice && <p role="status" className={`mt-4 rounded-lg border px-3.5 py-2.5 text-sm leading-5 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

            <form onSubmit={sendReply} className="mt-5"><label htmlFor="ticket-reply" className="text-sm font-medium text-[#38473e]">Reply to resident</label><textarea id="ticket-reply" name="reply" required minLength={2} maxLength={2000} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]" placeholder="For example: We’ve received your request and will resolve it within a few hours." /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><Button type="submit" disabled={replyBusy} className="py-2.5 text-sm">{replyBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={15} />}Send reply</Button>{!closedStatuses.has(selectedTicket.status) && <Button type="button" variant="outline" disabled={resolveBusy} onClick={resolveTicket} className="py-2.5 text-sm">{resolveBusy ? <LoaderCircle size={16} className="animate-spin" /> : <CircleCheck size={16} />}Mark as resolved</Button>}</div></form>
          </div>
        </section>
      </div>}
    </>
  );
}
