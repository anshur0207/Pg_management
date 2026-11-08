import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BedDouble, Building2, CircleHelp, MapPin, ReceiptText, ShieldCheck, Wrench } from "lucide-react";
import { StudentHeader } from "@/components/dashboard/student-header";
import { SessionExpiry } from "@/components/dashboard/session-expiry";
import { StudentTicketForm } from "@/components/dashboard/student-ticket-form";
import { StudentTicketUpdates } from "@/components/dashboard/student-ticket-updates";
import { StudentAgreements } from "@/components/dashboard/student-agreements";
import { StudentInvoiceList } from "@/components/dashboard/student-invoice-list";
import { StudentExitRequest } from "@/components/dashboard/student-exit-request";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Student portal" };
export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (paise: number | null | undefined) => currency.format((paise ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function StudentDashboardPage() {
  if (!isSupabaseConfigured()) redirect("/student/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "STUDENT") redirect("/dashboard");

  const { data: student } = await supabase
    .from("students")
    .select("id, owner_id, property_id, full_name, email, phone, monthly_rent_paise, rent_due_day, security_deposit_paise, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const firstName = student?.full_name?.trim().split(" ")[0] || "there";

  if (!student) {
    return (
      <main className="min-h-screen bg-[#f7f9f7]">
        <SessionExpiry redirectTo="/student/login" />
        <StudentHeader email={user.email} />
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <div className="rounded-2xl border border-[#e4ebe5] bg-white p-8 text-center shadow-sm sm:p-12">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eff7f1] text-[#167354]"><CircleHelp size={25} /></span>
            <h1 className="mt-5 text-2xl font-semibold text-[#17241f]">Resident portal access is not active</h1>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#718078]">Your account does not currently have an active resident profile. If you have just joined, contact your PG owner to check your invitation. If your stay has ended, your resident records remain with the PG owner.</p>
            <Link href="/student/login" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#167354] hover:underline">Return to student sign in <ArrowRight size={15} /></Link>
          </div>
        </div>
      </main>
    );
  }

  const todayMenuDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const todayDate = new Date(`${todayMenuDate}T00:00:00Z`);
  const todayDayOfWeek = ((todayDate.getUTCDay() + 6) % 7) + 1;
  const sundayWeek = Math.ceil(todayDate.getUTCDate() / 7);
  const announcementsNow = new Date().toISOString();
  const [propertyResult, invoiceResult, paymentResult, ticketResult, occupancyResult, announcementResult, menuResult, agreementResult, pendingCashResult, exitNoticeResult, depositResult] = await Promise.all([
    supabase.from("properties").select("name, city, locality").eq("id", student.property_id).maybeSingle(),
    supabase.from("invoices").select("id, invoice_number, billing_period_start, billing_period_end, issued_at, due_date, subtotal_paise, total_paise, amount_paid_paise, status, notes").eq("student_id", student.id).order("due_date", { ascending: false }),
    supabase.from("payments").select("id, invoice_id, amount_paise, method, paid_at, created_at, status, receipt_number, external_reference, notes").eq("student_id", student.id).order("paid_at", { ascending: false, nullsFirst: false }).limit(10),
    supabase.from("tickets").select("id, ticket_number, title, description, status, priority, created_at").eq("student_id", student.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("occupancies").select("bed_id, check_in").eq("student_id", student.id).eq("status", "active").is("checked_out_at", null).order("check_in", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("announcements").select("id, title, body, publish_at").eq("owner_id", student.owner_id).eq("property_id", student.property_id).eq("status", "published").lte("publish_at", announcementsNow).or(`expires_at.is.null,expires_at.gt.${announcementsNow}`).order("publish_at", { ascending: false }).limit(10),
    supabase.from("weekly_meal_menus").select("id, day_of_week, meal_type, week_of_month, items").eq("property_id", student.property_id).eq("day_of_week", todayDayOfWeek),
    supabase.from("rental_agreements").select("id, agreement_number, property_id, monthly_rent_paise, security_deposit_paise, starts_on, ends_on, premises_address, owner_terms, status, student_signature_name, signed_at, created_at").eq("student_id", student.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("invoice_id").eq("student_id", student.id).eq("method", "cash").eq("status", "pending").not("invoice_id", "is", null),
    supabase.from("notice_requests").select("id, expected_checkout, submitted_at, reason, status, owner_response, expected_deposit_refund_paise").eq("student_id", student.id).order("submitted_at", { ascending: false }),
    supabase.from("security_deposits").select("amount_paise, refunded_paise").eq("student_id", student.id),
  ]);

  const invoiceIds = (invoiceResult.data ?? []).map((invoice) => invoice.id);
  const { data: invoiceItems } = invoiceIds.length
    ? await supabase.from("invoice_items").select("invoice_id, description, quantity, amount_paise").in("invoice_id", invoiceIds).order("created_at")
    : { data: [] };

  let roomLabel = "Not assigned";
  if (occupancyResult.data?.bed_id) {
    const { data: bed } = await supabase.from("beds").select("bed_number, room_id").eq("id", occupancyResult.data.bed_id).maybeSingle();
    if (bed) {
      const { data: room } = await supabase.from("rooms").select("room_number, floor_id").eq("id", bed.room_id).maybeSingle();
      const { data: floor } = room ? await supabase.from("floors").select("name").eq("id", room.floor_id).maybeSingle() : { data: null };
      roomLabel = room ? `${floor?.name ? `${floor.name} · ` : ""}Room ${room.room_number} · Bed ${bed.bed_number}` : `Bed ${bed.bed_number}`;
    }
  }

  const invoices = invoiceResult.data ?? [];
  const outstanding = invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + Math.max(0, invoice.total_paise - invoice.amount_paid_paise), 0);
  const property = propertyResult.data;
  const depositLedger = depositResult.data ?? [];
  const signedAgreementDeposit = (agreementResult.data ?? []).find((agreement) => agreement.status === "signed")?.security_deposit_paise ?? 0;
  const exitDepositBasis = depositLedger.length
    ? depositLedger.reduce((total, deposit) => total + Math.max(0, deposit.amount_paise - deposit.refunded_paise), 0)
    : student.security_deposit_paise || signedAgreementDeposit;

  return (
    <main className="min-h-screen bg-[#f7f9f7]">
      <SessionExpiry redirectTo="/student/login" />
      <StudentHeader email={student.email ?? user.email} />
      <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[#167354]">Student portal</p><Link href="/student/profile" className="text-sm font-medium text-[#167354] hover:underline">Edit profile</Link></div><h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[#17241f] sm:text-4xl">Welcome, {firstName}.</h1><p className="mt-3 text-base text-[#718078]">Your stay information and updates from {property?.name ?? "your PG"}.</p></div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce9e1] bg-white px-3 py-1.5 text-sm text-[#5b7162]"><ShieldCheck size={15} className="text-[#167354]" /> Private resident account</div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={<Building2 size={18} />} label="Your PG" value={property?.name ?? "Property unavailable"} detail={[property?.locality, property?.city].filter(Boolean).join(" · ")} />
          <SummaryCard icon={<BedDouble size={18} />} label="Room / bed" value={roomLabel} detail={student.status.replaceAll("_", " ")} />
          <SummaryCard icon={<ReceiptText size={18} />} label="Outstanding" value={money(outstanding)} detail={`Rent due day ${student.rent_due_day}`} />
          <SummaryCard icon={<MapPin size={18} />} label="Monthly rent" value={money(student.monthly_rent_paise)} detail="Contact your PG owner for changes" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <StudentInvoiceList invoices={invoices} items={invoiceItems ?? []} pendingCashInvoiceIds={(pendingCashResult.data ?? []).map((payment) => payment.invoice_id).filter((id): id is string => Boolean(id))} propertyName={property?.name ?? "Your PG"} residentName={student.full_name} onlinePaymentsEnabled={Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)} />

          <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#24332b]">Recent payments</h2><p className="mt-1 text-sm text-[#718078]">Payments recorded by your PG.</p></div><ReceiptText size={19} className="text-[#167354]" /></div>
            {paymentResult.data?.length ? <div className="mt-4 divide-y divide-[#edf0ed]">{paymentResult.data.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium capitalize text-[#34443a]">{payment.method.replaceAll("_", " ")} · {payment.status}</p><p className="mt-1 text-sm text-[#718078]">{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-IN")}{payment.invoice_id ? ` · ${invoices.find((invoice) => invoice.id === payment.invoice_id)?.invoice_number ?? "Invoice"}` : ""}</p><p className="mt-1 text-xs text-[#89948d]">{payment.receipt_number ? `Receipt ${payment.receipt_number}` : payment.external_reference ? `Reference ${payment.external_reference}` : payment.notes ?? ""}</p></div><p className="text-sm font-semibold text-[#24332b]">{money(payment.amount_paise)}</p></div>)}</div> : <EmptyState text="No payments have been recorded yet." />}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <StudentTicketForm studentId={student.id} ownerId={student.owner_id} propertyId={student.property_id} />
          <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#24332b]">My help requests</h2><p className="mt-1 text-sm text-[#718078]">Track issues sent to the PG team.</p></div><Wrench size={19} className="text-[#167354]" /></div>
            <StudentTicketUpdates tickets={ticketResult.data ?? []} userId={user.id} />
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#24332b]">PG announcements</h2>{announcementResult.data?.length ? <div className="mt-3 space-y-4">{announcementResult.data.map((item) => <article key={item.id} className="border-t border-[#edf0ed] pt-3"><h3 className="text-sm font-semibold text-[#34443a]">{item.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#718078]">{item.body}</p><p className="mt-2 text-xs text-[#89948d]">{new Date(item.publish_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></article>)}</div> : <EmptyState text="There are no current announcements for your property." />}</section>
          <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#24332b]">Today’s meal menu</h2><p className="mt-1 text-sm text-[#718078]">{date(todayMenuDate)} · {new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date())}</p><div className="mt-3 divide-y divide-[#edf0ed]">{(["breakfast", "lunch", "dinner"] as const).map((meal) => { const item = menuResult.data?.find((menu) => menu.meal_type === meal && menu.week_of_month === 0); return <div key={meal} className="py-3"><p className="text-sm font-semibold capitalize text-[#34443a]">{meal}</p><p className="mt-1 whitespace-pre-line text-sm text-[#718078]">{item?.items.join("\n") || "Menu not posted yet"}</p></div>; })}{todayDayOfWeek === 7 && <div className="py-3"><p className="text-sm font-semibold text-[#34443a]">Sunday sweet · {sundayWeek}{sundayWeek === 1 ? "st" : sundayWeek === 2 ? "nd" : sundayWeek === 3 ? "rd" : "th"} Sunday</p><p className="mt-1 whitespace-pre-line text-sm text-[#718078]">{menuResult.data?.find((menu) => menu.meal_type === "sweets" && menu.week_of_month === sundayWeek)?.items.join("\n") || "Sweet not posted yet"}</p></div>}</div></section>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><StudentExitRequest securityDepositPaise={exitDepositBasis} notices={exitNoticeResult.data ?? []} /><section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6"><div className="mb-4"><h2 className="text-lg font-semibold text-[#24332b]">Stay agreements</h2><p className="mt-1 text-sm text-[#718078]">Review, sign, and keep a copy of your PG agreements.</p></div><StudentAgreements agreements={agreementResult.data ?? []} propertyName={property?.name ?? "your PG"} profileName={student.full_name} /></section></div>
        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-[#78857d]"><CircleHelp size={16} className="mt-0.5 shrink-0" />Update your personal details from My profile. Contact your PG owner for room assignments, rent, agreement, or status changes.</p>
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="min-w-0 rounded-xl border border-[#e4ebe5] bg-white p-4"><div className="flex items-start gap-2 text-sm text-[#718078]"><span className="mt-0.5 shrink-0 text-[#167354]">{icon}</span><span>{label}</span></div><p className="mt-3 whitespace-normal break-words text-lg font-semibold leading-6 text-[#24332b]">{value}</p><p className="mt-1 whitespace-normal break-words text-sm capitalize leading-5 text-[#89948d]">{detail || "—"}</p></article>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-4 rounded-lg bg-[#f7faf7] px-4 py-4 text-sm leading-6 text-[#718078]">{text}</p>;
}
