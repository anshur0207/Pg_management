import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CircleHelp, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { SessionExpiry } from "@/components/dashboard/session-expiry";
import { PropertyCreateDisclosure } from "@/components/dashboard/property-create-disclosure";
import { StudentInviteForm } from "@/components/dashboard/student-invite-form";
import { ResidentManagement } from "@/components/dashboard/resident-management";
import { OwnerSidebar } from "@/components/dashboard/owner-sidebar";
import { OwnerTicketManager } from "@/components/dashboard/owner-ticket-manager";
import { PropertyRoomManager } from "@/components/dashboard/property-room-manager";
import { PropertyManagementCard } from "@/components/dashboard/property-management-card";
import { OwnerMealMenuManager } from "@/components/dashboard/owner-meal-menu-manager";
import { OwnerAgreementManager } from "@/components/dashboard/owner-agreement-manager";
import { OwnerAnnouncementManager } from "@/components/dashboard/owner-announcement-manager";
import { OwnerInvoiceManager } from "@/components/dashboard/owner-invoice-manager";
import { OwnerNoticeManager } from "@/components/dashboard/owner-notice-manager";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (paise: number | null | undefined) => currency.format((paise ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

type OwnerResident = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  permanent_address: string | null;
  property_id: string;
  monthly_rent_paise: number;
  security_deposit_paise: number;
  rent_due_day: number;
  joined_on: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  government_id_type: string | null;
  government_id_last4: string | null;
  agreement_start: string | null;
  agreement_end: string | null;
  status: string;
  archived_at: string | null;
  email_verified: boolean;
  invitation_expires_at: string | null;
};

type OwnerResidentVerification = {
  id: string;
  email_verified: boolean;
  invitation_expires_at: string | null;
};

const dashboardSections = new Set(["overview", "properties", "layout", "residents", "payments", "invoices", "expenses", "tickets", "notices", "announcements", "meals", "agreements"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  const requestedSection = params.section ?? "overview";
  const activeSection = dashboardSections.has(requestedSection) ? requestedSection : "overview";

  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name, phone").eq("id", user.id).maybeSingle();
  if (profile?.role === "STUDENT") redirect("/student/dashboard");

  const { data: owner } = await supabase.from("owners").select("id, business_name, business_address, phone").eq("user_id", user.id).maybeSingle();
  if (!owner) redirect("/login?error=owner-profile");
  const [propertyResult, residentResult, residentDetailsResult, floorResult, roomResult, bedResult, occupancyResult, occupancyHistoryResult, reservationResult, paymentResult, invoiceResult, ticketResult, openTicketCountResult, noticeResult, pendingNoticeCountResult, announcementResult, expenseResult, mealMenuResult, agreementResult] = await Promise.all([
    supabase.from("properties").select("id, owner_id, name, code, city, locality, gender_policy, address, state, pin_code, latitude, longitude, maps_url, contact_phone, manager_name, manager_phone, amenities, image_paths, public_description, marketplace_enabled, floor_count, status").eq("owner_id", owner.id).order("name"),
    supabase.rpc("owner_list_residents"),
    supabase.from("students").select("id, full_name, email, phone, permanent_address, property_id, monthly_rent_paise, security_deposit_paise, rent_due_day, joined_on, emergency_contact_name, emergency_contact_phone, government_id_type, government_id_last4, agreement_start, agreement_end, status, archived_at").eq("owner_id", owner.id).order("full_name"),
    supabase.from("floors").select("id, property_id, name, floor_number").eq("owner_id", owner.id).order("floor_number", { ascending: true, nullsFirst: false }).order("name"),
    supabase.from("rooms").select("id, property_id, floor_id, room_number, capacity, status, monthly_rent_paise").eq("owner_id", owner.id).order("room_number"),
    supabase.from("beds").select("id, room_id, bed_number, status").eq("owner_id", owner.id).order("bed_number"),
    supabase.from("occupancies").select("student_id, bed_id, monthly_rent_paise, check_in").eq("owner_id", owner.id).eq("status", "active").is("checked_out_at", null),
    supabase.from("occupancies").select("student_id, bed_id, monthly_rent_paise, check_in, expected_check_out, checked_out_at, status").eq("owner_id", owner.id).order("check_in", { ascending: false }),
    supabase.from("reservations").select("bed_id, status, reserved_until").eq("owner_id", owner.id).eq("status", "active"),
    supabase.from("payments").select("id, student_id, invoice_id, amount_paise, method, status, paid_at, created_at, receipt_number, external_reference, notes").eq("owner_id", owner.id).order("paid_at", { ascending: false, nullsFirst: false }).limit(200),
    supabase.from("invoices").select("id, property_id, student_id, invoice_number, billing_period_start, billing_period_end, issued_at, due_date, total_paise, amount_paid_paise, status, notes").eq("owner_id", owner.id).order("due_date", { ascending: false }),
    supabase.from("tickets").select("id, student_id, property_id, ticket_number, title, description, category, priority, status, created_at").eq("owner_id", owner.id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("owner_id", owner.id).not("status", "in", "(resolved,closed)"),
    supabase.from("notice_requests").select("id, student_id, expected_checkout, submitted_at, status, reason, owner_response, expected_deposit_refund_paise").eq("owner_id", owner.id).order("submitted_at", { ascending: false }).limit(100),
    supabase.from("notice_requests").select("id", { count: "exact", head: true }).eq("owner_id", owner.id).eq("status", "pending"),
    supabase.from("announcements").select("id, property_id, title, body, status, publish_at, expires_at, created_at").eq("owner_id", owner.id).order("publish_at", { ascending: false }).limit(100),
    supabase.from("expenses").select("id, property_id, description, amount_paise, expense_date, payment_method, vendor_name").eq("owner_id", owner.id).order("expense_date", { ascending: false }).limit(50),
    supabase.from("weekly_meal_menus").select("id, property_id, day_of_week, meal_type, week_of_month, items").eq("owner_id", owner.id).order("day_of_week").order("meal_type").order("week_of_month"),
    supabase.from("rental_agreements").select("id, agreement_number, student_id, property_id, monthly_rent_paise, security_deposit_paise, starts_on, ends_on, owner_terms, status, student_signature_name, signed_at, created_at").eq("owner_id", owner.id).order("created_at", { ascending: false }),
  ]);

  const properties = propertyResult.data ?? [];
  const residentVerificationRows = (residentResult.data ?? []) as OwnerResidentVerification[];
  const residentVerification = new Map<string, OwnerResidentVerification>(residentVerificationRows.map((resident) => [resident.id, resident]));
  const residents = (residentDetailsResult.data ?? []).map((resident) => ({
    ...resident,
    email_verified: residentVerification.get(resident.id)?.email_verified ?? false,
    invitation_expires_at: residentVerification.get(resident.id)?.invitation_expires_at ?? null,
  })) as OwnerResident[];
  const floors = floorResult.data ?? [];
  const rooms = roomResult.data ?? [];
  const beds = bedResult.data ?? [];
  const activeOccupancies = occupancyResult.data ?? [];
  const occupancyHistory = occupancyHistoryResult.data ?? [];
  const reservations = reservationResult.data ?? [];
  const payments = paymentResult.data ?? [];
  const invoices = invoiceResult.data ?? [];
  const tickets = ticketResult.data ?? [];
  const announcements = announcementResult.data ?? [];
  const expenses = expenseResult.data ?? [];
  const mealMenus = mealMenuResult.data ?? [];
  const agreements = agreementResult.data ?? [];
  const { data: pendingCashPayments } = await supabase.from("payments")
    .select("id, student_id, invoice_id, amount_paise, method, status, created_at")
    .eq("owner_id", owner.id).eq("method", "cash").eq("status", "pending").order("created_at", { ascending: false });
  const bedsById = new Map(beds.map((bed) => [bed.id, bed]));
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const residentNames = new Map<string, string>(residents.map((resident) => [resident.id, resident.full_name]));
  const propertyNames = new Map(properties.map((property) => [property.id, property.name]));
  const residentAgreementStays = activeOccupancies.flatMap((occupancy) => {
    const bed = bedsById.get(occupancy.bed_id);
    const room = bed ? roomsById.get(bed.room_id) : undefined;
    return room ? [{ student_id: occupancy.student_id, check_in: occupancy.check_in, room_number: room.room_number, bed_number: bed?.bed_number ?? "" }] : [];
  });
  const noticeRequests = (noticeResult.data ?? []).map((notice) => {
    const occupancy = activeOccupancies.find((item) => item.student_id === notice.student_id);
    const bed = occupancy ? bedsById.get(occupancy.bed_id) : undefined;
    const room = bed ? roomsById.get(bed.room_id) : undefined;
    const floor = room ? floors.find((item) => item.id === room.floor_id) : undefined;
    return {
      ...notice,
      resident_name: residentNames.get(notice.student_id) ?? "Resident",
      property_name: propertyNames.get(residents.find((item) => item.id === notice.student_id)?.property_id ?? "") ?? "Property",
      floor_name: floor?.name ?? "Floor unavailable",
      room_number: room?.room_number ?? "—",
      bed_number: bed?.bed_number ?? "—",
    };
  });
  const activeOccupancyStudentIds = Array.from(new Set(activeOccupancies.map((occupancy) => occupancy.student_id)));
  const openTicketCount = openTicketCountResult.count ?? tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
  const propertyBedStats = new Map<string, { vacant: number; reserved: number }>(properties.map((property) => [property.id, { vacant: 0, reserved: 0 }]));
  const occupiedBedIds = new Set(activeOccupancies.map((occupancy) => occupancy.bed_id));
  const currentDate = new Date().toISOString().slice(0, 10);
  const reservedBedIds = new Set(reservations.filter((reservation) => !reservation.reserved_until || reservation.reserved_until >= currentDate).map((reservation) => reservation.bed_id));
  beds.forEach((bed) => {
    const room = roomsById.get(bed.room_id);
    if (!room || room.status !== "active") return;
    const stats = propertyBedStats.get(room.property_id);
    if (!stats) return;
    if (bed.status === "occupied" || occupiedBedIds.has(bed.id) || bed.status === "reserved" || reservedBedIds.has(bed.id)) stats.reserved += 1;
    else if (bed.status === "available" && !occupiedBedIds.has(bed.id)) stats.vacant += 1;
  });
  const outstandingTotal = invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).reduce((total, invoice) => total + Math.max(0, invoice.total_paise - invoice.amount_paid_paise), 0);

  const fullName = user.user_metadata?.full_name;
  const firstName = typeof fullName === "string" ? fullName.trim().split(" ")[0] : "there";

  return (
    <main className="min-h-screen bg-[#f7f9f7]">
      <SessionExpiry />
      <header className="flex h-[68px] items-center justify-between border-b border-[#e7ece8] bg-white px-5 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight text-[#23332a]"><span className="grid size-8 place-items-center rounded-lg bg-[#167354] text-white"><Building2 size={17} /></span><span>pg<span className="text-[#167354]">manager</span></span></Link>
        <div className="flex items-center gap-3"><span className="hidden text-sm text-[#76827a] sm:inline">{user.email}</span><SignOutButton /></div>
      </header>
      <div className="flex min-h-[calc(100vh-68px)] flex-col lg:flex-row">
        <OwnerSidebar openTicketCount={openTicketCount} pendingNoticeCount={pendingNoticeCountResult.count ?? 0} />
        <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[1180px]">
            {activeSection === "overview" && <section id="overview" className="scroll-mt-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#167354]">Owner workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[#17241f] sm:text-4xl">Good to see you, {firstName || "there"}.</h1><p className="mt-3 text-sm text-[#718078]">Your properties, residents, payments, and day-to-day operations.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce9e1] bg-white px-3 py-1.5 text-xs text-[#5b7162]"><ShieldCheck size={14} className="text-[#167354]" /> Account verified</div></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Properties" value={properties.length.toString()} detail="Across your workspace" />
                <SummaryCard label="Residents" value={residents.filter((resident) => resident.email_verified && !["checked_out", "inactive"].includes(resident.status)).length.toString()} detail="Verified and active" />
                <SummaryCard label="Outstanding" value={money(outstandingTotal)} detail="Across unpaid invoices" />
                <SummaryCard label="Open tickets" value={openTicketCount.toString()} detail="Need attention" />
              </div>
            </section>}

            {(activeSection === "overview" || activeSection === "properties") && <section id="properties" className="mt-9 scroll-mt-8">
              <SectionHeading title="All properties" detail="Properties registered to your owner account." />
              <DataPanel>
                {properties.length ? <div className="space-y-4">{properties.map((property) => {
                  const propertyRooms = rooms.filter((room) => room.property_id === property.id);
                  const propertyBeds = beds.filter((bed) => propertyRooms.some((room) => room.id === bed.room_id));
                  const occupancyBedIds = new Set(activeOccupancies.map((occupancy) => occupancy.bed_id));
                  const occupied = propertyBeds.filter((bed) => bed.status === "occupied" || occupancyBedIds.has(bed.id)).length;
                  const propertyInvoices = invoices.filter((invoice) => invoice.property_id === property.id);
                  const outstanding = propertyInvoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + Math.max(0, invoice.total_paise - invoice.amount_paid_paise), 0);
                  const collected = propertyInvoices.reduce((sum, invoice) => sum + invoice.amount_paid_paise, 0);
                  const bedStats = propertyBedStats.get(property.id) ?? { vacant: 0, reserved: 0 };
                  return <div key={property.id}><PropertyManagementCard ownerId={owner.id} property={property} stats={{ floors: floors.filter((floor) => floor.property_id === property.id).length, rooms: propertyRooms.length, beds: propertyBeds.length, occupied, residents: residents.filter((resident) => resident.property_id === property.id && !["inactive", "checked_out"].includes(resident.status)).length, outstanding_paise: outstanding, collected_paise: collected }} /><div className="mt-2 flex gap-2 pl-1 text-xs text-[#718078]"><span>{bedStats.vacant} vacant beds</span><span>·</span><span>{bedStats.reserved} reserved or occupied beds</span></div></div>;
                })}</div> : <EmptyState text="No properties added yet. Create your first property below." />}
              </DataPanel>
              <PropertyCreateDisclosure ownerId={owner.id} />
            </section>}

            {activeSection === "residents" && <section id="residents" className="mt-9 scroll-mt-8">
              <SectionHeading title="Residents" detail="Residents connected to your properties." />
              <DataPanel>
                <ResidentManagement ownerId={owner.id} residents={residents} propertyNames={propertyNames} properties={properties.map(({ id, name }) => ({ id, name }))} floors={floors} rooms={rooms} beds={beds} activeOccupancies={activeOccupancies} occupancyHistory={occupancyHistory} reservations={reservations.filter((reservation) => !reservation.reserved_until || reservation.reserved_until >= currentDate)} agreements={agreements} />
                <div className="mt-6 border-t border-[#edf0ed] pt-1"><StudentInviteForm properties={properties.filter((property) => property.status === "active").map(({ id, name, city, locality }) => ({ id, name, city, locality }))} /></div>
              </DataPanel>
            </section>}

            {activeSection === "agreements" && <section id="agreements" className="mt-9 scroll-mt-8">
              <OwnerAgreementManager ownerId={owner.id} userId={user.id} ownerDetails={{ name: profile?.full_name || owner.business_name, phone: owner.phone || profile?.phone || "", address: owner.business_address ?? "" }} residents={residents} properties={properties.map(({ id, name, address, locality, city, state, pin_code, contact_phone }) => ({ id, name, address: [address, locality, city, state, pin_code].filter(Boolean).join(", "), contact_phone: contact_phone ?? "" }))} residentStays={residentAgreementStays} agreements={agreements} />
            </section>}

            {activeSection === "payments" && <section id="payments" className="mt-9 scroll-mt-8">
              <SectionHeading title="Payments" detail="Recent payments recorded for your residents." />
              <DataPanel>{payments.length ? <TableWrap><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide text-[#89948d]"><th className="pb-3 pr-4 font-medium">Resident / invoice</th><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Method</th><th className="pb-3 pr-4 font-medium">Receipt / reference</th><th className="pb-3 pr-4 font-medium">Status</th><th className="pb-3 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{payments.map((payment) => { const invoice = invoices.find((item) => item.id === payment.invoice_id); return <tr key={payment.id}><td className="py-3 pr-4 font-medium text-[#34443a]">{residentNames.get(payment.student_id) ?? "Resident"}<p className="mt-1 text-xs font-normal text-[#718078]">{invoice?.invoice_number ?? "No linked invoice"}</p></td><td className="py-3 pr-4 text-[#526058]">{date(payment.paid_at ?? payment.created_at)}</td><td className="py-3 pr-4 capitalize text-[#526058]">{payment.method.replaceAll("_", " ")}</td><td className="py-3 pr-4 text-[#526058]">{payment.receipt_number || payment.external_reference || "—"}{payment.notes && <p className="mt-1 max-w-[220px] truncate text-xs text-[#718078]" title={payment.notes}>{payment.notes}</p>}</td><td className="py-3 pr-4 capitalize text-[#526058]">{payment.status}</td><td className="py-3 text-right font-semibold text-[#24332b]">{money(payment.amount_paise)}</td></tr>; })}</tbody></table></TableWrap> : <EmptyState text="No payments have been recorded yet." />}</DataPanel>
            </section>}

            {activeSection === "invoices" && <section id="invoices" className="mt-9 scroll-mt-8">
              <DataPanel><OwnerInvoiceManager properties={properties} residents={residents} activeStudentIds={activeOccupancyStudentIds} invoices={invoices} payments={pendingCashPayments ?? []} /></DataPanel>
            </section>}

            {activeSection === "tickets" && <section id="tickets" className="mt-9 scroll-mt-8">
              <SectionHeading title="Maintenance tickets" detail="Resident issues and maintenance requests." />
              <DataPanel><OwnerTicketManager ownerId={owner.id} userId={user.id} tickets={tickets.map((ticket) => ({ ...ticket, resident_name: residentNames.get(ticket.student_id) ?? "Resident", property_name: propertyNames.get(ticket.property_id) ?? "Property" }))} /></DataPanel>
            </section>}

            {activeSection === "notices" && <section id="notices" className="mt-9 scroll-mt-8">
              <DataPanel><OwnerNoticeManager notices={noticeRequests} /></DataPanel>
            </section>}

            {activeSection === "announcements" && <section id="announcements" className="mt-9 scroll-mt-8">
              <DataPanel><OwnerAnnouncementManager ownerId={owner.id} userId={user.id} properties={properties.map(({ id, name, status }) => ({ id, name, status }))} announcements={announcements} /></DataPanel>
            </section>}

            {activeSection === "meals" && <section id="meals" className="mt-9 scroll-mt-8">
              <SectionHeading title="Food menu" detail="Plan breakfast, lunch, and dinner for each PG and date." />
              <OwnerMealMenuManager ownerId={owner.id} userId={user.id} properties={properties.filter((property) => property.status === "active").map(({ id, name }) => ({ id, name }))} menus={mealMenus} />
            </section>}

            {activeSection === "expenses" && <section id="expenses" className="mt-9 scroll-mt-8">
              <SectionHeading title="Expenses" detail="Recent expenses recorded across your properties." />
              <DataPanel>{expenses.length ? <TableWrap><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide text-[#89948d]"><th className="pb-3 pr-4 font-medium">Description</th><th className="pb-3 pr-4 font-medium">Property</th><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Method</th><th className="pb-3 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{expenses.map((expense) => <tr key={expense.id}><td className="py-3 pr-4"><p className="font-medium text-[#34443a]">{expense.description}</p><p className="mt-0.5 text-xs text-[#89948d]">{expense.vendor_name || "No vendor"}</p></td><td className="py-3 pr-4 text-[#526058]">{propertyNames.get(expense.property_id) ?? "—"}</td><td className="py-3 pr-4 text-[#526058]">{date(expense.expense_date)}</td><td className="py-3 pr-4 capitalize text-[#526058]">{expense.payment_method.replaceAll("_", " ")}</td><td className="py-3 text-right font-semibold text-[#24332b]">{money(expense.amount_paise)}</td></tr>)}</tbody></table></TableWrap> : <EmptyState text="No expenses have been recorded." />}</DataPanel>
            </section>}

            {(activeSection === "overview" || activeSection === "layout") && <section id="layout" className="mt-9 scroll-mt-8">
              <SectionHeading title="Floors, rooms & beds" detail="Choose a PG to manage its floors, room capacity, and vacant beds." />
              <PropertyRoomManager ownerId={owner.id} properties={properties.filter((property) => property.status === "active").map(({ id, name, city }) => ({ id, name, city }))} floors={floors} rooms={rooms} beds={beds} residents={residents} payments={payments} agreements={agreements} occupiedBeds={activeOccupancies.map((occupancy) => ({ bed_id: occupancy.bed_id, student_id: occupancy.student_id, student_name: residentNames.get(occupancy.student_id) ?? "Resident", monthly_rent_paise: occupancy.monthly_rent_paise, check_in: occupancy.check_in }))} />
            </section>}

            <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#e4ebe5] bg-white px-4 py-4 text-sm leading-6 text-[#748078]"><CircleHelp size={17} className="mt-0.5 shrink-0 text-[#87958c]"/><p>All dashboard lists are restricted to your owner account. Residents are linked through private, email-bound invitations.</p><Link href="/" className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-[#167354] hover:underline">Home <ArrowRight size={14} /></Link></div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-[#e4ebe5] bg-white p-4"><p className="text-sm text-[#718078]">{label}</p><p className="mt-2 truncate text-2xl font-semibold text-[#24332b]">{value}</p><p className="mt-1 text-xs text-[#89948d]">{detail}</p></article>;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="mb-4"><h2 className="text-xl font-semibold tracking-[-.02em] text-[#24332b]">{title}</h2><p className="mt-1 text-sm text-[#718078]">{detail}</p></div>;
}

function DataPanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#e4ebe5] bg-white p-5 shadow-[0_6px_24px_-20px_rgba(27,65,41,.2)] sm:p-6">{children}</div>;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm leading-6 text-[#718078]">{text}</p>;
}
