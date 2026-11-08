"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type TicketFormProps = { studentId: string; ownerId: string; propertyId: string };

export function StudentTicketForm({ studentId, ownerId, propertyId }: TicketFormProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);
    const form = event.currentTarget;
    const values = new FormData(form);

    try {
      const { error } = await createClient().from("tickets").insert({
        owner_id: ownerId,
        property_id: propertyId,
        student_id: studentId,
        ticket_number: `SR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`,
        category: String(values.get("category") ?? "other"),
        title: String(values.get("title") ?? "").trim(),
        description: String(values.get("description") ?? "").trim(),
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Your request was sent to the PG team." });
      form.reset();
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to send the request. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return (
    <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[#24332b]">Request help</h2>
      <p className="mt-1 text-sm leading-6 text-[#718078]">Send a maintenance or service request to your PG team.</p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium text-[#38473e]">Category<select name="category" className={inputClass}><option value="other">Other</option><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="wifi">Wi-Fi</option><option value="water">Water</option><option value="cleaning">Cleaning</option><option value="housekeeping">Housekeeping</option><option value="food">Food</option><option value="laundry">Laundry</option><option value="furniture">Furniture</option><option value="security">Security</option></select></label>
        <label className="block text-sm font-medium text-[#38473e]">Subject<input required maxLength={120} name="title" className={inputClass} placeholder="What do you need help with?" /></label>
        <label className="block text-sm font-medium text-[#38473e]">Details<textarea required maxLength={3000} minLength={5} name="description" rows={4} className={inputClass} placeholder="Add details so the team can help you." /></label>
        <Button type="submit" disabled={isSubmitting} className="py-3 text-base">{isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}Send request</Button>
      </form>
      {notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
    </section>
  );
}
