"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type PropertyOption = { id: string; name: string; status: string };
type Announcement = { id: string; property_id: string | null; title: string; body: string; status: string; publish_at: string; expires_at: string | null; created_at: string };

type AnnouncementDraft = { id?: string; propertyId: string; title: string; body: string; expiresAt: string; status: "published" | "draft" };

const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";
const localDateTime = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export function OwnerAnnouncementManager({ ownerId, userId, properties, announcements }: { ownerId: string; userId: string; properties: PropertyOption[]; announcements: Announcement[] }) {
  const router = useRouter();
  const activeProperties = properties.filter((property) => property.status === "active");
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function startCreate() {
    setNotice(null);
    setDraft({ propertyId: activeProperties[0]?.id ?? "", title: "", body: "", expiresAt: "", status: "published" });
  }

  function startEdit(item: Announcement) {
    setNotice(null);
    setDraft({ id: item.id, propertyId: item.property_id ?? "", title: item.title, body: item.body, expiresAt: item.expires_at ? localDateTime(item.expires_at) : "", status: item.status === "published" ? "published" : "draft" });
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.propertyId) {
      setNotice({ kind: "error", text: "Choose a property for this announcement." });
      return;
    }
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      setNotice({ kind: "error", text: "Enter both a title and announcement message." });
      return;
    }
    const expiresAt = draft.expiresAt ? new Date(draft.expiresAt) : null;
    const publishAt = draft.id ? new Date(announcements.find((item) => item.id === draft.id)?.publish_at ?? Date.now()) : new Date();
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= publishAt)) {
      setNotice({ kind: "error", text: "The expiry must be after the publish date." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const client = createClient();
    const payload = {
      owner_id: ownerId,
      property_id: draft.propertyId,
      title,
      body,
      publish_at: publishAt.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
      status: draft.status,
      created_by: userId,
    };
    const result = draft.id
      ? await client.from("announcements").update(payload).eq("id", draft.id).eq("owner_id", ownerId)
      : await client.from("announcements").insert(payload);

    if (result.error) {
      setNotice({ kind: "error", text: result.error.message });
    } else {
      setNotice({ kind: "success", text: draft.id ? "Announcement updated." : draft.status === "published" ? "Announcement published to this property's residents." : "Announcement saved as a draft." });
      setDraft(null);
      router.refresh();
    }
    setBusy(false);
  }

  async function deleteAnnouncement(item: Announcement) {
    if (!window.confirm(`Delete “${item.title}”? It will be removed from this property's resident portal.`)) return;
    setDeletingId(item.id);
    setNotice(null);
    const { error } = await createClient().from("announcements").delete().eq("id", item.id).eq("owner_id", ownerId);
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: "Announcement deleted." });
      router.refresh();
    }
    setDeletingId(null);
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#24332b]">Announcements</h2><p className="mt-1 text-sm text-[#718078]">Post updates for residents of one specific property.</p></div><Button type="button" onClick={startCreate} disabled={!activeProperties.length} className="py-2.5"><Plus size={16} />New announcement</Button></div>
    {!activeProperties.length && <p className="rounded-lg border border-[#eee2c9] bg-[#fffcf4] px-4 py-3 text-sm text-[#756547]">Add an active property before creating an announcement.</p>}
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

    {draft && <form onSubmit={saveAnnouncement} className="space-y-4 rounded-xl border border-[#e8ede8] bg-[#fbfcfb] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-[#34443a]">{draft.id ? "Edit announcement" : "Create announcement"}</h3><p className="mt-1 text-sm text-[#718078]">Only residents assigned to the selected property can see this post.</p></div><button type="button" aria-label="Close announcement form" onClick={() => setDraft(null)} className="grid size-8 place-items-center rounded-lg text-[#718078] hover:bg-[#eff3ef]"><X size={17} /></button></div>
      <label className="block text-sm font-medium text-[#38473e]">Property<select required value={draft.propertyId} onChange={(event) => setDraft({ ...draft, propertyId: event.target.value })} className={inputClass}><option value="" disabled>Select property</option>{properties.map((property) => <option key={property.id} value={property.id} disabled={property.status !== "active" && property.id !== draft.propertyId}>{property.name}{property.status !== "active" ? " · inactive" : ""}</option>)}</select></label>
      <label className="block text-sm font-medium text-[#38473e]">Title<input required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputClass} placeholder="e.g. Water maintenance on Friday" /></label>
      <label className="block text-sm font-medium text-[#38473e]">Message<textarea required maxLength={5000} rows={5} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className={inputClass} placeholder="Write the update for residents…" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-[#38473e]">Post status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as AnnouncementDraft["status"] })} className={inputClass}><option value="published">Publish now</option><option value="draft">Save as draft</option></select></label><label className="block text-sm font-medium text-[#38473e]">Hide after (optional)<input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} className={inputClass} /><span className="mt-1 block text-xs font-normal text-[#89948d]">Leave blank to keep it visible until deleted or archived.</span></label></div>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !draft.propertyId} className="py-2.5">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Megaphone size={16} />}{draft.status === "published" ? draft.id ? "Save and publish" : "Publish announcement" : "Save draft"}</Button><Button type="button" variant="outline" onClick={() => setDraft(null)} className="py-2.5">Cancel</Button></div>
    </form>}

    {announcements.length ? <div className="divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] bg-white px-4">{announcements.map((item) => <article key={item.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-[#34443a]">{item.title}</p><p className="mt-1 text-xs text-[#89948d]">{properties.find((property) => property.id === item.property_id)?.name ?? "Property"} · {item.status === "published" ? "Published" : item.status === "archived" ? "Archived" : "Draft"} · {new Date(item.publish_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{item.expires_at ? ` · Hides ${new Date(item.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#58685e]">{item.body}</p></div><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" onClick={() => startEdit(item)} className="py-2 text-sm"><Pencil size={14} />Edit</Button><Button type="button" variant="outline" disabled={deletingId === item.id} onClick={() => deleteAnnouncement(item)} className="py-2 text-sm text-[#9b413c] hover:bg-[#fff7f6]">{deletingId === item.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</Button></div></div></article>)}</div> : <div className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">No announcements yet. Create a property-specific post to share it with residents.</div>}
  </section>;
}
