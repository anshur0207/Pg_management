"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, LoaderCircle, MailPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type PropertyOption = { id: string; name: string; city: string; locality: string | null };
type Invitation = { studentId: string; name: string; email: string; url: string; expiresAt: string };

function getInviteErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "Unable to create the invitation. Please try again.";

  const databaseError = error as { code?: string; message?: string; hint?: string };
  if (databaseError.code === "PGRST202" || databaseError.code === "42883") {
    return "The student-invitation database function is missing. Apply the latest Supabase migration, then try again.";
  }

  return [databaseError.message, databaseError.hint].filter(Boolean).join(" ") || "Unable to create the invitation. Please try again.";
}

export function StudentInviteForm({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setInvitation(null);
    setCopied(false);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const values = new FormData(event.currentTarget);
    const propertyId = String(values.get("propertyId") ?? "");
    const fullName = String(values.get("fullName") ?? "").trim();
    const email = String(values.get("email") ?? "").trim().toLowerCase();
    const phone = String(values.get("phone") ?? "").trim();

    try {
      const { data, error } = await createClient().rpc("create_student_invitation", {
        target_property_id: propertyId,
        target_full_name: fullName,
        target_email: email,
        target_phone: phone,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.invite_token || !result?.student_id) throw new Error("The invitation was not returned. Please try again.");

      const url = new URL("/student/register", window.location.origin);
      url.searchParams.set("token", result.invite_token);
      setInvitation({
        studentId: result.student_id,
        name: fullName,
        email,
        url: url.toString(),
        expiresAt: result.invite_expires_at,
      });
      setNotice({ kind: "success", text: `Resident record created for ${fullName}. Share the secure invitation link with ${email}.` });
      form.reset();
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: getInviteErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch {
      setNotice({ kind: "error", text: "Could not copy automatically. Select and copy the invitation link above." });
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return (
    <section className="mt-8 rounded-2xl border border-[#e4ebe5] bg-white p-6 shadow-[0_6px_24px_-20px_rgba(27,65,41,.2)] sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eff7f1] text-[#167354]"><MailPlus size={20} /></span>
        <div><h2 className="text-xl font-semibold text-[#24332b]">Invite a resident</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Add a resident to one of your properties, then share a private, email-bound signup link. The link expires in seven days.</p></div>
      </div>

      {properties.length === 0 ? <p className="mt-6 rounded-lg bg-[#f7faf7] p-4 text-sm leading-6 text-[#64736a]">Add an active property before inviting residents.</p> : <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium text-[#38473e]">Resident name<input required minLength={2} name="fullName" autoComplete="name" className={inputClass} placeholder="Full name" /></label>
        <label className="text-sm font-medium text-[#38473e]">Email address<input required type="email" name="email" autoComplete="email" className={inputClass} placeholder="student@example.com" /></label>
        <label className="text-sm font-medium text-[#38473e]">Phone number<input required type="tel" name="phone" autoComplete="tel" className={inputClass} placeholder="+91 98765 43210" /></label>
        <label className="text-sm font-medium text-[#38473e]">Property<select required name="propertyId" defaultValue="" className={inputClass}><option value="" disabled>Select a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.locality ? ` · ${property.locality}` : ""} · {property.city}</option>)}</select></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={isSubmitting || properties.length === 0} className="w-full py-3 text-base sm:w-auto">{isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <MailPlus size={18} />}Create invitation</Button></div>
      </form>}

      {notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
      {invitation && <div className="mt-4 rounded-xl border border-[#dce9e1] bg-[#f7faf7] p-4">
        <p className="text-sm font-semibold text-[#24332b]">One-time invitation link</p>
        <p className="mt-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-[#526058]">{invitation.url}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" onClick={copyInvitation} className="py-2.5 text-sm">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}</Button><span className="text-sm text-[#718078]">Valid until {new Date(invitation.expiresAt).toLocaleString()}</span></div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#718078]"><ArrowRight size={13} /> The student must sign up using this email: {invitation.email}</p>
      </div>}
    </section>
  );
}
