"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PropertyReviewForm({ propertyId, ownerId, studentId }: { propertyId: string; ownerId: string; studentId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = new FormData(form).get("feedback");
    const message = typeof feedback === "string" ? feedback.trim() : "";
    if (message.length < 5) {
      setNotice({ success: false, message: "Please write at least 5 characters." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().from("property_reviews").insert({ owner_id: ownerId, property_id: propertyId, student_id: studentId, rating, feedback: message });
    if (error) setNotice({ success: false, message: error.code === "23505" ? "You’ve already left feedback for this PG." : error.message });
    else {
      setNotice({ success: true, message: "Thanks for sharing your experience." });
      form.reset();
      setRating(5);
      router.refresh();
    }
    setBusy(false);
  }

  return <form onSubmit={submit} className="mt-5 rounded-xl border border-[#e4ebe5] bg-[#fbfcfb] p-4 sm:p-5">
    <h3 className="font-semibold text-[#34443a]">Share your experience</h3>
    <p className="mt-1 text-sm text-[#718078]">Feedback is available to verified current and former residents.</p>
    <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Your rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} onClick={() => setRating(value)} className="rounded p-1 text-[#e4a93b] transition hover:scale-110"><Star size={21} className={value <= rating ? "fill-current" : "fill-transparent text-[#cbd5ce]"} /></button>)}</div>
    <label className="mt-3 block text-sm font-medium text-[#38473e]">Your feedback<textarea name="feedback" required minLength={5} maxLength={2000} rows={4} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm font-normal text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]" placeholder="What was your stay like?" /></label>
    <button type="submit" disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#167354] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#105a41] disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}Post feedback</button>
    {notice && <p role={notice.success ? "status" : "alert"} className={`mt-3 text-sm ${notice.success ? "text-[#26714f]" : "text-[#9b413c]"}`}>{notice.message}</p>}
  </form>;
}
