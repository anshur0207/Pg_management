"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, BedDouble, LoaderCircle, MailCheck, MessageCircle, Pencil, UserRound, UserX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { RentalAgreementDocument } from "@/components/dashboard/rental-agreement-document";

type Resident = {
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

type ResidentManagementProps = {
  ownerId: string;
  residents: Resident[];
  propertyNames: Map<string, string>;
  properties: { id: string; name: string }[];
  floors: { id: string; property_id: string; name: string; floor_number: number | null }[];
  rooms: { id: string; property_id: string; floor_id: string; room_number: string; status: string; monthly_rent_paise: number | null }[];
  beds: { id: string; room_id: string; bed_number: string; status: string }[];
  activeOccupancies: { student_id: string; bed_id: string; monthly_rent_paise: number; check_in: string }[];
  occupancyHistory: { student_id: string; bed_id: string; monthly_rent_paise: number; check_in: string; expected_check_out: string | null; checked_out_at: string | null; status: string }[];
  reservations: { bed_id: string; reserved_until: string | null }[];
  agreements: {
    id: string;
    student_id: string;
    agreement_number: string;
    monthly_rent_paise: number;
    security_deposit_paise: number;
    starts_on: string;
    ends_on: string | null;
    owner_terms: string;
    status: string;
    student_signature_name: string | null;
    signed_at: string | null;
  }[];
};

export function ResidentManagement({ ownerId, residents, propertyNames, properties, floors, rooms, beds, activeOccupancies, occupancyHistory, reservations, agreements }: ResidentManagementProps) {
  const router = useRouter();
  const [busyResident, setBusyResident] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
    const [assignmentPropertyId, setAssignmentPropertyId] = useState("");
    const [assignmentFloorId, setAssignmentFloorId] = useState("");
    const [assignmentRoomId, setAssignmentRoomId] = useState("");
    const [assignmentBedId, setAssignmentBedId] = useState("");
  const [busyAction, setBusyAction] = useState<"profile" | "assignment" | "document" | null>(null);
  const [modalNotice, setModalNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const pastResidents = residents.filter((resident) => !resident.archived_at && resident.email_verified && ["inactive", "checked_out"].includes(resident.status));
  const pendingResidents = residents.filter((resident) => !resident.archived_at && !["inactive", "checked_out"].includes(resident.status) && !resident.email_verified);
  const currentResidents = residents.filter((resident) => !resident.archived_at && !["inactive", "checked_out"].includes(resident.status) && resident.email_verified);
  const assignmentProperties = Array.from(new Set(rooms.filter((room) => room.status === "active").map((room) => room.property_id)));
  const assignmentFloors = floors.filter((floor) => floor.property_id === assignmentPropertyId);
  const assignmentRooms = rooms.filter((room) => room.property_id === assignmentPropertyId && room.floor_id === assignmentFloorId && room.status === "active");
  const residentAgreements = selectedResident ? agreements.filter((agreement) => agreement.student_id === selectedResident.id) : [];
  const selectedOccupancy = selectedResident ? activeOccupancies.find((occupancy) => occupancy.student_id === selectedResident.id) : undefined;
  const selectedBed = selectedOccupancy ? beds.find((bed) => bed.id === selectedOccupancy.bed_id) : undefined;
  const selectedRoom = selectedBed ? rooms.find((room) => room.id === selectedBed.room_id) : undefined;
  const selectedFloor = selectedRoom ? floors.find((floor) => floor.id === selectedRoom.floor_id) : undefined;
  const residentStayHistory = selectedResident ? occupancyHistory.filter((occupancy) => occupancy.student_id === selectedResident.id) : [];
  const assignmentBeds = beds.filter((bed) => bed.room_id === assignmentRoomId).filter((bed) => {
    const activeOccupancy = activeOccupancies.find((occupancy) => occupancy.bed_id === bed.id);
    const activeReservation = reservations.some((reservation) => reservation.bed_id === bed.id && (!reservation.reserved_until || reservation.reserved_until >= new Date().toISOString().slice(0, 10)));
    return (bed.status === "available" && !activeOccupancy && !activeReservation) || activeOccupancy?.student_id === selectedResident?.id;
  });

  function residentStatusLabel(status: string) {
    if (status === "active") return "Active";
    if (status === "notice_period") return "Notice Period";
    if (status === "checked_out" || status === "inactive") return "Checked Out";
    if (status === "checkout_pending") return "Checkout Pending";
    return status.replaceAll("_", " ");
  }

  async function moveToPast(resident: Resident) {
    setBusyResident(resident.id);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await createClient()
      .from("students")
      .update({ status: "inactive" })
      .eq("id", resident.id)
      .eq("owner_id", ownerId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(`${resident.full_name} was moved to Past residents. Their records are preserved.`);
      router.refresh();
    }
    setBusyResident(null);
  }

  async function removePendingResident(resident: Resident) {
    setBusyResident(resident.id);
    setError(null);
    setSuccess(null);
    const { data: updatedResident, error: updateError } = await createClient()
      .from("students")
      .update({ status: "inactive", archived_at: new Date().toISOString() })
      .eq("id", resident.id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedResident) {
      setError(updateError?.message ?? "This resident has changed. Refresh the page and try again.");
    } else {
      setSuccess(`${resident.full_name}'s pending invitation was removed.`);
      router.refresh();
    }
    setBusyResident(null);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResident) return;
    setBusyAction("profile");
    setModalNotice(null);
    const values = new FormData(event.currentTarget);
    const monthlyRentPaise = Math.round(Number(values.get("monthlyRent") ?? 0) * 100);
    if (selectedOccupancy) {
      const { error: rentError } = await createClient().rpc("assign_student_to_bed", {
        target_student_id: selectedResident.id,
        target_bed_id: selectedOccupancy.bed_id,
        target_check_in: selectedOccupancy.check_in,
        target_monthly_rent_paise: monthlyRentPaise,
      });
      if (rentError) {
        setModalNotice({ kind: "error", text: rentError.message });
        setBusyAction(null);
        return;
      }
    }
    const { error: updateError } = await createClient().from("students").update({
      full_name: String(values.get("fullName") ?? "").trim(),
      phone: String(values.get("phone") ?? "").trim(),
      email: String(values.get("email") ?? "").trim() || null,
      permanent_address: String(values.get("address") ?? "").trim() || null,
      emergency_contact_name: String(values.get("emergencyContactName") ?? "").trim() || null,
      emergency_contact_phone: String(values.get("emergencyContactPhone") ?? "").trim() || null,
      government_id_type: String(values.get("governmentIdType") ?? "").trim() || null,
      government_id_last4: String(values.get("governmentIdLast4") ?? "").replace(/\D/g, "").slice(-4) || null,
      joined_on: String(values.get("joinedOn") ?? selectedResident.joined_on),
      monthly_rent_paise: monthlyRentPaise,
      security_deposit_paise: Math.round(Number(values.get("securityDeposit") ?? 0) * 100),
      rent_due_day: Number(values.get("rentDueDay") ?? selectedResident.rent_due_day),
      agreement_start: String(values.get("agreementStart") ?? "") || null,
      agreement_end: String(values.get("agreementEnd") ?? "") || null,
    }).eq("id", selectedResident.id).eq("owner_id", ownerId);
    if (updateError) setModalNotice({ kind: "error", text: updateError.message });
    else {
      setSelectedResident({
        ...selectedResident,
        full_name: String(values.get("fullName") ?? "").trim(),
        phone: String(values.get("phone") ?? "").trim(),
        email: String(values.get("email") ?? "").trim() || null,
        permanent_address: String(values.get("address") ?? "").trim() || null,
        emergency_contact_name: String(values.get("emergencyContactName") ?? "").trim() || null,
        emergency_contact_phone: String(values.get("emergencyContactPhone") ?? "").trim() || null,
        government_id_type: String(values.get("governmentIdType") ?? "").trim() || null,
        government_id_last4: String(values.get("governmentIdLast4") ?? "").replace(/\D/g, "").slice(-4) || null,
        joined_on: String(values.get("joinedOn") ?? selectedResident.joined_on),
        monthly_rent_paise: monthlyRentPaise,
        security_deposit_paise: Math.round(Number(values.get("securityDeposit") ?? 0) * 100),
        rent_due_day: Number(values.get("rentDueDay") ?? selectedResident.rent_due_day),
        agreement_start: String(values.get("agreementStart") ?? "") || null,
        agreement_end: String(values.get("agreementEnd") ?? "") || null,
      });
      setModalNotice({ kind: "success", text: "Resident details updated." });
      router.refresh();
    }
    setBusyAction(null);
  }

  async function assignBed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResident) return;
    const values = new FormData(event.currentTarget);
    const bedId = String(values.get("bedId") ?? assignmentBedId);
    if (!bedId) {
      setModalNotice({ kind: "error", text: "Choose a vacant bed first." });
      return;
    }
    setBusyAction("assignment");
    setModalNotice(null);
    const { error: assignmentError } = await createClient().rpc("assign_student_to_bed", {
      target_student_id: selectedResident.id,
      target_bed_id: bedId,
      target_check_in: String(values.get("checkIn") ?? "") || new Date().toISOString().slice(0, 10),
      target_monthly_rent_paise: Math.round(Number(values.get("monthlyRent") ?? 0) * 100),
    });
    if (assignmentError) setModalNotice({ kind: "error", text: assignmentError.message });
    else {
      setModalNotice({ kind: "success", text: "Resident assigned to the bed. Previous occupancy history was retained." });
      router.refresh();
    }
    setBusyAction(null);
  }

  function openResident(resident: Resident) {
    setModalNotice(null);
    const occupancy = activeOccupancies.find((item) => item.student_id === resident.id);
    const assignedBed = occupancy ? beds.find((bed) => bed.id === occupancy.bed_id) : undefined;
    const assignedRoom = assignedBed ? rooms.find((room) => room.id === assignedBed.room_id) : undefined;
    const initialPropertyId = assignedRoom?.property_id ?? resident.property_id;
    const initialFloorId = assignedRoom?.floor_id ?? floors.find((floor) => floor.property_id === initialPropertyId)?.id ?? "";
    const initialRoomId = assignedRoom?.id ?? rooms.find((room) => room.floor_id === initialFloorId && room.status === "active")?.id ?? "";
    const initialBedId = assignedBed?.id ?? beds.find((bed) => bed.room_id === initialRoomId && bed.status === "available" && !activeOccupancies.some((item) => item.bed_id === bed.id))?.id ?? "";
    setAssignmentPropertyId(initialPropertyId);
    setAssignmentFloorId(initialFloorId);
    setAssignmentRoomId(initialRoomId);
    setAssignmentBedId(initialBedId);
    setSelectedResident(resident);
  }

  useEffect(() => {
    if (!selectedResident) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedResident(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedResident]);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg border border-[#f0d7d4] bg-[#fff7f6] px-4 py-3 text-sm text-[#9b413c]">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-[#cfe7d7] bg-[#f2faf4] px-4 py-3 text-sm text-[#286344]">{success}</p>}

      <ResidentGroup
        title="Pending verification"
        detail="Invited residents stay here until they finish signup and verify their email."
        residents={pendingResidents}
        propertyNames={propertyNames}
        emptyText="No residents are waiting for email verification."
        actionLabel="Remove resident"
        actionIcon={<UserX size={15} />}
        busyResident={busyResident}
        onAction={removePendingResident}
        onManage={openResident}
      />

      <ResidentGroup
        title="Current residents"
        detail="Verified residents with an active stay."
        residents={currentResidents}
        propertyNames={propertyNames}
        emptyText="No verified current residents yet."
        actionLabel="Mark as left"
        actionIcon={<Archive size={15} />}
        busyResident={busyResident}
        onAction={moveToPast}
        onManage={openResident}
      />

      <ResidentGroup
        title="Past residents"
        detail="Verified residents who left their PG. Their billing and activity history is retained."
        residents={pastResidents}
        propertyNames={propertyNames}
        emptyText="Verified residents you mark as left will appear here."
        onManage={openResident}
      />

      {selectedResident && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
        <button type="button" aria-label="Close resident details" className="absolute inset-0 bg-[#17241f]/45" onClick={() => setSelectedResident(null)} />
        <section role="dialog" aria-modal="true" aria-labelledby="resident-dialog-title" className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-[#edf0ed] px-5 py-4 sm:px-6"><div><p className="text-xs font-medium uppercase tracking-wide text-[#167354]">{propertyNames.get(selectedResident.property_id) ?? "PG resident"}</p><h2 id="resident-dialog-title" className="mt-1 text-xl font-semibold text-[#24332b]">{selectedResident.full_name}</h2><p className="mt-1 text-sm text-[#718078]">{selectedResident.email || "No email address"} · {selectedResident.email_verified ? "Email verified" : "Pending verification"}</p></div><button type="button" onClick={() => setSelectedResident(null)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#f2f5f2]"><X size={19} /></button></header>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <form onSubmit={saveProfile} className="space-y-4">
              <div><h3 className="font-semibold text-[#34443a]">Student profile</h3><p className="mt-1 text-sm text-[#718078]">View and update this resident’s personal and rental details.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#38473e]">Full name<input required minLength={2} name="fullName" defaultValue={selectedResident.full_name} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Phone number<input required type="tel" name="phone" defaultValue={selectedResident.phone} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Email<input type="email" name="email" defaultValue={selectedResident.email ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Joining date<input type="date" name="joinedOn" defaultValue={selectedResident.joined_on} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Emergency contact name<input name="emergencyContactName" defaultValue={selectedResident.emergency_contact_name ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Emergency contact phone<input type="tel" name="emergencyContactPhone" defaultValue={selectedResident.emergency_contact_phone ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">ID proof type<input name="governmentIdType" defaultValue={selectedResident.government_id_type ?? ""} placeholder="Aadhaar, passport, etc." className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">ID proof last 4 digits<input inputMode="numeric" maxLength={4} name="governmentIdLast4" defaultValue={selectedResident.government_id_last4 ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /><span className="mt-1 block text-xs font-normal text-[#89948d]">Only the last four digits are stored.</span></label>
                <label className="block text-sm font-medium text-[#38473e]">Monthly rent (₹)<input required type="number" min="0" step="0.01" name="monthlyRent" defaultValue={(selectedResident.monthly_rent_paise / 100).toFixed(2)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Security deposit (₹)<input required type="number" min="0" step="0.01" name="securityDeposit" defaultValue={(selectedResident.security_deposit_paise / 100).toFixed(2)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Rent due day<input required type="number" min="1" max="28" name="rentDueDay" defaultValue={selectedResident.rent_due_day} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Agreement start<input type="date" name="agreementStart" defaultValue={selectedResident.agreement_start ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e]">Agreement end<input type="date" name="agreementEnd" defaultValue={selectedResident.agreement_end ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label>
                <label className="block text-sm font-medium text-[#38473e] sm:col-span-2">Permanent address<textarea name="address" rows={2} defaultValue={selectedResident.permanent_address ?? ""} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] px-3.5 py-3 text-base outline-none focus:border-[#63a888]" placeholder="Resident address" /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busyAction === "profile"} className="py-2.5">{busyAction === "profile" ? <LoaderCircle size={16} className="animate-spin" /> : <Pencil size={15} />}Save profile</Button><span className="rounded-full bg-[#f2f5f2] px-3 py-1.5 text-xs text-[#526058]">Status: {residentStatusLabel(selectedResident.status)}</span></div>
            </form>

            <IdentityProofDocuments ownerId={ownerId} studentId={selectedResident.id} />

            <section className="mt-6 border-t border-[#edf0ed] pt-5"><h3 className="font-semibold text-[#34443a]">Assigned stay</h3>{selectedOccupancy && selectedBed && selectedRoom ? <div className="mt-3 grid gap-3 rounded-xl bg-[#f7faf7] p-4 text-sm sm:grid-cols-2"><p><span className="block text-xs text-[#89948d]">Property</span>{properties.find((property) => property.id === selectedRoom.property_id)?.name ?? propertyNames.get(selectedResident.property_id) ?? "—"}</p><p><span className="block text-xs text-[#89948d]">Floor · room · bed</span>{selectedFloor?.name ?? "Floor"} · Room {selectedRoom.room_number} · Bed {selectedBed.bed_number}</p><p><span className="block text-xs text-[#89948d]">Check-in</span>{new Date(`${selectedOccupancy.check_in}T00:00:00`).toLocaleDateString("en-IN")}</p><p><span className="block text-xs text-[#89948d]">Status</span>{residentStatusLabel(selectedResident.status)}</p></div> : <p className="mt-2 text-sm text-[#718078]">No current bed assignment.</p>}
              <h4 className="mt-5 text-sm font-semibold text-[#34443a]">Check-in and check-out history</h4>{residentStayHistory.length ? <div className="mt-2 divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] px-4">{residentStayHistory.map((stay, index) => { const bed = beds.find((item) => item.id === stay.bed_id); const room = bed ? rooms.find((item) => item.id === bed.room_id) : undefined; const floor = room ? floors.find((item) => item.id === room.floor_id) : undefined; return <div key={`${stay.bed_id}-${stay.check_in}-${index}`} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-medium capitalize text-[#34443a]">{stay.status === "active" ? "Current stay" : "Past stay"}</p><p className="mt-1 text-xs text-[#718078]">{properties.find((property) => property.id === room?.property_id)?.name ?? "Property"} · {floor?.name ?? "Floor"} · Room {room?.room_number ?? "—"} · Bed {bed?.bed_number ?? "—"}</p></div><div className="text-right text-xs text-[#718078]">Check-in {new Date(`${stay.check_in}T00:00:00`).toLocaleDateString("en-IN")}<p className="mt-1">{stay.checked_out_at ? `Checked out ${new Date(stay.checked_out_at).toLocaleDateString("en-IN")}` : stay.expected_check_out ? `Expected checkout ${new Date(`${stay.expected_check_out}T00:00:00`).toLocaleDateString("en-IN")}` : stay.status === "active" ? "Currently staying" : "No checkout date recorded"}</p></div></div>; })}</div> : <p className="mt-2 text-sm text-[#718078]">No stay history recorded.</p>}
            </section>

            <ResidentPaymentHistory ownerId={ownerId} studentId={selectedResident.id} />
            {(() => { const digits = selectedResident.phone.replace(/\D/g, ""); const waNumber = digits.length === 10 ? `91${digits}` : digits; return waNumber.length >= 10 ? <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${selectedResident.full_name}, this is regarding your stay at ${propertyNames.get(selectedResident.property_id) ?? "your PG"}.`)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#16804f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#126b42]"><MessageCircle size={17} />Chat on WhatsApp</a> : null; })()}

            {!['inactive', 'checked_out'].includes(selectedResident.status) && <form onSubmit={assignBed} className="mt-6 space-y-4 border-t border-[#edf0ed] pt-5">
              <div><h3 className="font-semibold text-[#34443a]">Room and bed assignment</h3><p className="mt-1 text-sm text-[#718078]">Choose a PG, then narrow down by floor and room. Only vacant beds or this resident’s current bed are shown.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#38473e]">PG<select value={assignmentPropertyId} onChange={(event) => { setAssignmentPropertyId(event.target.value); setAssignmentFloorId(""); setAssignmentRoomId(""); setAssignmentBedId(""); }} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888]"><option value="">Select PG</option>{assignmentProperties.map((propertyId) => <option key={propertyId} value={propertyId}>{propertyNames.get(propertyId) ?? "PG"}</option>)}</select></label>
                <label className="block text-sm font-medium text-[#38473e]">Floor<select value={assignmentFloorId} onChange={(event) => { setAssignmentFloorId(event.target.value); setAssignmentRoomId(""); setAssignmentBedId(""); }} disabled={!assignmentPropertyId} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888] disabled:bg-[#f4f6f4]"><option value="">Select floor</option>{assignmentFloors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label>
                <label className="block text-sm font-medium text-[#38473e]">Room<select value={assignmentRoomId} onChange={(event) => { setAssignmentRoomId(event.target.value); setAssignmentBedId(""); }} disabled={!assignmentFloorId} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888] disabled:bg-[#f4f6f4]"><option value="">Select room</option>{assignmentRooms.map((room) => <option key={room.id} value={room.id}>Room {room.room_number}</option>)}</select></label>
                <label className="block text-sm font-medium text-[#38473e]">Bed<select name="bedId" value={assignmentBedId} onChange={(event) => setAssignmentBedId(event.target.value)} disabled={!assignmentRoomId} required className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888] disabled:bg-[#f4f6f4]"><option value="">Select vacant bed</option>{assignmentBeds.map((bed) => <option key={bed.id} value={bed.id}>Bed {bed.bed_number}{activeOccupancies.some((item) => item.student_id === selectedResident.id && item.bed_id === bed.id) ? " · Current" : " · Vacant"}</option>)}</select></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-[#38473e]">Check-in date<input name="checkIn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label><label className="block text-sm font-medium text-[#38473e]">Monthly rent (₹)<input name="monthlyRent" type="number" min="0" step="0.01" defaultValue={(selectedResident.monthly_rent_paise / 100).toFixed(2)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base outline-none focus:border-[#63a888]" /></label></div>
              <Button type="submit" disabled={busyAction === "assignment" || !assignmentBedId} className="py-2.5">{busyAction === "assignment" ? <LoaderCircle size={16} className="animate-spin" /> : <BedDouble size={16} />}Assign / update bed</Button>
              {assignmentPropertyId && assignmentFloorId && assignmentRoomId && assignmentBeds.length === 0 && <p className="text-sm text-[#9a6b22]">This room has no vacant beds. Choose another room or add bed capacity.</p>}
            </form>}
            <section className="mt-6 border-t border-[#edf0ed] pt-5">
              <h3 className="font-semibold text-[#34443a]">Rental agreements <span className="ml-1 rounded-full bg-[#f2f5f2] px-2 py-0.5 text-xs text-[#627068]">{residentAgreements.length}</span></h3>
              {residentAgreements.length ? <div className="mt-3 space-y-3">{residentAgreements.map((agreement) => <details key={agreement.id} className="rounded-lg border border-[#e8ede8] p-3"><summary className="cursor-pointer text-sm font-medium text-[#34443a]">{agreement.agreement_number} · <span className="capitalize">{agreement.status.replaceAll("_", " ")}</span></summary><div className="mt-3 text-sm leading-6 text-[#526058]"><p>Rent: {(agreement.monthly_rent_paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })} · Deposit: {(agreement.security_deposit_paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p><p>Term: {agreement.starts_on}{agreement.ends_on ? ` to ${agreement.ends_on}` : " · no end date"}</p>{agreement.student_signature_name && <p>Signed by {agreement.student_signature_name}{agreement.signed_at ? ` · ${new Date(agreement.signed_at).toLocaleString("en-IN")}` : ""}</p>}<div className="mt-3"><RentalAgreementDocument terms={agreement.owner_terms} /></div></div></details>)}</div> : <p className="mt-2 text-sm text-[#718078]">No rental agreement has been created for this resident.</p>}
            </section>
            {modalNotice && <p role="status" className={`mt-4 rounded-lg border px-3.5 py-2.5 text-sm ${modalNotice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{modalNotice.text}</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}

export function IdentityProofDocuments({ ownerId, studentId }: { ownerId: string; studentId: string }) {
  const [documents, setDocuments] = useState<{ id: string; file_name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("documents").select("id, file_name, storage_path").eq("owner_id", ownerId).eq("student_id", studentId).eq("document_type", "identity").order("created_at", { ascending: false });
    if (error) {
      setNotice("Could not load identity documents.");
      setDocuments([]);
    } else {
      const signedDocuments = await Promise.all((data ?? []).map(async (document: { id: string; file_name: string; storage_path: string }) => {
        const { data: signed } = await supabase.storage.from("pg-documents").createSignedUrl(document.storage_path, 3600);
        return signed?.signedUrl ? { id: document.id, file_name: document.file_name, url: signed.signedUrl } : null;
      }));
      setDocuments(signedDocuments.filter((document): document is { id: string; file_name: string; url: string } => Boolean(document)));
      setNotice(null);
    }
    setLoading(false);
  }, [ownerId, studentId, supabase]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("identityFile");
    if (!(file instanceof File) || file.size === 0) {
      setNotice("Choose an ID proof file first.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type) || file.size > 20 * 1024 * 1024) {
      setNotice("Upload a JPG, PNG, WebP, or PDF file up to 20 MB.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "file";
    const path = `${ownerId}/${studentId}/identity/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("pg-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setNotice(uploadError.message);
    } else {
      const { error: recordError } = await supabase.from("documents").insert({ owner_id: ownerId, student_id: studentId, document_type: "identity", file_name: file.name, storage_path: path, content_type: file.type, size_bytes: file.size });
      if (recordError) {
        await supabase.storage.from("pg-documents").remove([path]);
        setNotice(recordError.message);
      } else {
        form.reset();
        setNotice("ID proof uploaded.");
        await loadDocuments();
      }
    }
    setBusy(false);
  }

  return <section className="mt-6 border-t border-[#edf0ed] pt-5"><h3 className="font-semibold text-[#34443a]">ID proof documents</h3><p className="mt-1 text-sm text-[#718078]">Private files, shared only with you and your PG owner.</p>
    {loading ? <p className="mt-3 text-sm text-[#718078]">Loading documents…</p> : documents.length ? <div className="mt-3 flex flex-wrap gap-2">{documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[#dfe6e1] px-3 py-2 text-sm font-medium text-[#167354] hover:bg-[#f7faf7]">{document.file_name}</a>)}</div> : <p className="mt-3 text-sm text-[#718078]">No ID proof uploaded yet.</p>}
    <form onSubmit={uploadDocument} className="mt-3 flex flex-wrap items-center gap-2"><input required type="file" name="identityFile" accept="image/jpeg,image/png,image/webp,application/pdf" className="min-w-0 flex-1 text-sm text-[#526058] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eff7f1] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#167354]" /><Button type="submit" disabled={busy} variant="outline" className="py-2">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Pencil size={15} />}Upload ID proof</Button></form>
    {notice && <p role="status" className="mt-2 text-sm text-[#718078]">{notice}</p>}
  </section>;
}

function ResidentPaymentHistory({ ownerId, studentId }: { ownerId: string; studentId: string }) {
  const [payments, setPayments] = useState<{ id: string; amount_paise: number; method: string; status: string; paid_at: string | null; created_at: string; receipt_number: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: queryError } = await createClient().from("payments").select("id, amount_paise, method, status, paid_at, created_at, receipt_number").eq("owner_id", ownerId).eq("student_id", studentId).order("paid_at", { ascending: false, nullsFirst: false });
      if (!active) return;
      setPayments(data ?? []);
      setError(Boolean(queryError));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [ownerId, studentId]);

  return <section className="mt-6 border-t border-[#edf0ed] pt-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-[#34443a]">Payment history</h3><span className="rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs text-[#627068]">{payments.length} records</span></div>
    {loading ? <p className="mt-3 text-sm text-[#718078]">Loading payment history…</p> : error ? <p role="alert" className="mt-3 text-sm text-[#9b413c]">Could not load payment history.</p> : payments.length ? <div className="mt-3 divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] px-4">{payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-[#34443a]">{(payment.amount_paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })} <span className="ml-1 text-xs font-normal capitalize text-[#718078]">· {payment.method.replaceAll("_", " ")}</span></p><p className="mt-1 text-xs text-[#89948d]">{payment.receipt_number ? `Receipt ${payment.receipt_number} · ` : ""}{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-IN")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs capitalize ${payment.status === "completed" ? "bg-[#e8f6ed] text-[#167354]" : "bg-[#f0f1f2] text-[#687078]"}`}>{payment.status}</span></div>)}</div> : <p className="mt-3 rounded-lg bg-[#f7faf7] px-4 py-3 text-sm text-[#718078]">No payments recorded for this resident.</p>}
  </section>;
}

function ResidentGroup({
  title,
  detail,
  residents,
  propertyNames,
  emptyText,
  actionLabel,
  actionIcon,
  busyResident,
  onAction,
  onManage,
}: {
  title: string;
  detail: string;
  residents: Resident[];
  propertyNames: Map<string, string>;
  emptyText: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  busyResident?: string | null;
  onAction?: (resident: Resident) => void;
  onManage: (resident: Resident) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-[#34443a]">{title}<span className="ml-2 rounded-full bg-[#f2f5f2] px-2 py-0.5 text-xs font-medium text-[#627068]">{residents.length}</span></h3><p className="mt-1 text-sm leading-5 text-[#78857d]">{detail}</p></div>
      </div>
      {residents.length === 0 ? <p className="rounded-lg bg-[#f7faf7] px-4 py-3 text-sm text-[#718078]">{emptyText}</p> : <div className="divide-y divide-[#edf0ed]">{residents.map((resident) => <article key={resident.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[#eff7f1] text-[#167354]">{resident.email_verified ? <MailCheck size={17} /> : <UserRound size={17} />}</span>
          <div className="min-w-0"><p className="truncate font-medium text-[#34443a]">{resident.full_name}</p><p className="mt-0.5 truncate text-sm text-[#718078]">{resident.email || "No email"} · {resident.phone}</p><p className="mt-0.5 text-xs capitalize text-[#89948d]">{propertyNames.get(resident.property_id) ?? "Property unavailable"} · {resident.status.replaceAll("_", " ")}</p>{!resident.email_verified && resident.invitation_expires_at && <p className="mt-1 text-xs text-[#9a6b22]">Invite expires {new Date(resident.invitation_expires_at).toLocaleDateString("en-IN")}</p>}</div>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => onManage(resident)} className="py-2 text-sm"><Pencil size={15} />Manage</Button>{actionLabel && onAction && <Button type="button" variant="outline" disabled={busyResident === resident.id} onClick={() => onAction(resident)} className="py-2 text-sm">{busyResident === resident.id ? <LoaderCircle size={15} className="animate-spin" /> : actionIcon}{actionLabel}</Button>}</div>
      </article>)}</div>}
    </section>
  );
}
