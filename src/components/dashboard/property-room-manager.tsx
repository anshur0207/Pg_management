"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Building2, ChevronDown, Layers3, LoaderCircle, MessageCircle, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Property = { id: string; name: string; city: string };
type Floor = { id: string; property_id: string; name: string; floor_number: number | null };
type Room = { id: string; property_id: string; floor_id: string; room_number: string; capacity: number; status: string; monthly_rent_paise: number | null };
type Bed = { id: string; room_id: string; bed_number: string; status: string };
type Resident = { id: string; full_name: string; email: string | null; phone: string; permanent_address: string | null; property_id: string; monthly_rent_paise: number; security_deposit_paise: number; rent_due_day: number; joined_on: string; status: string };
type Payment = { id: string; student_id: string; amount_paise: number; method: string; status: string; paid_at: string | null; created_at: string; receipt_number: string | null };
type OccupiedBed = { bed_id: string; student_id: string; student_name: string; monthly_rent_paise: number; check_in: string };
type ResidentAgreement = { student_id: string; security_deposit_paise: number; status: string; created_at: string };

export function PropertyRoomManager({
	ownerId,
	properties,
	floors,
	rooms,
	beds,
	residents,
	payments,
	occupiedBeds,
	agreements,
}: {
	ownerId: string;
	properties: Property[];
	floors: Floor[];
	rooms: Room[];
	beds: Bed[];
	residents: Resident[];
	payments: Payment[];
	occupiedBeds: OccupiedBed[];
	agreements: ResidentAgreement[];
}) {
	const router = useRouter();
	const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
	const [floorPrefix, setFloorPrefix] = useState("Floor");
	const [floorCount, setFloorCount] = useState("1");
	const [firstFloorNumber, setFirstFloorNumber] = useState("1");
	const [busy, setBusy] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

	const propertyFloors = floors.filter((floor) => floor.property_id === propertyId);
	const propertyRooms = rooms.filter((room) => room.property_id === propertyId);
	const selectedPropertyName = properties.find((item) => item.id === propertyId)?.name ?? "the selected PG";
	const availableBeds = beds.filter((bed) => propertyRooms.some((room) => room.id === bed.room_id) && bed.status === "available" && !occupiedBeds.some((occupancy) => occupancy.bed_id === bed.id)).length;

	async function addFloors(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		const count = Number(floorCount);
		const { error } = await createClient().rpc("create_owner_floors", {
			target_property_id: propertyId,
			target_floor_prefix: floorPrefix.trim(),
			target_count: count,
			target_start_number: Number(firstFloorNumber),
		});
		if (error) setNotice({ kind: "error", text: error.message });
		else {
			setNotice({ kind: "success", text: `${count} floor${count === 1 ? "" : "s"} created for ${selectedPropertyName}.` });
			setFloorCount("1");
			router.refresh();
		}
		setBusy(false);
	}

	async function deleteFloor(floor: Floor) {
		if (!window.confirm(`Delete ${floor.name} and its rooms/beds? This only works if there is no occupancy or reservation history.`)) return;
		setDeletingId(floor.id);
		setNotice(null);
		const { error } = await createClient().rpc("delete_owner_floor", { target_floor_id: floor.id });
		if (error) setNotice({ kind: "error", text: error.message });
		else {
			setNotice({ kind: "success", text: `${floor.name} and its empty room layout were deleted.` });
			router.refresh();
		}
		setDeletingId(null);
	}

	async function deleteRoom(room: Room) {
		if (!window.confirm(`Delete Room ${room.room_number} and its bed slots? Rooms with occupancy or reservation history cannot be deleted.`)) return;
		setDeletingId(room.id);
		setNotice(null);
		const { error } = await createClient().rpc("delete_owner_room", { target_room_id: room.id });
		if (error) setNotice({ kind: "error", text: error.message });
		else {
			setNotice({ kind: "success", text: `Room ${room.room_number} was deleted.` });
			router.refresh();
		}
		setDeletingId(null);
	}

	async function deleteBed(bed: Bed, room: Room) {
		if (!window.confirm(`Delete bed ${bed.bed_number} from Room ${room.room_number}? Beds with occupancy or reservation history cannot be deleted.`)) return;
		setDeletingId(bed.id);
		setNotice(null);
		const { error } = await createClient().rpc("delete_owner_bed", { target_bed_id: bed.id });
		if (error) setNotice({ kind: "error", text: error.message });
		else {
			setNotice({ kind: "success", text: `Bed ${bed.bed_number} was deleted and room capacity updated.` });
			router.refresh();
		}
		setDeletingId(null);
	}

	const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2.5 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

	return (
		<section className="mt-5 rounded-xl border border-[#e8ede8] bg-[#fbfcfb] p-4 sm:p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eff7f1] text-[#167354]"><Layers3 size={17} /></span><div><h3 className="font-semibold text-[#24332b]">Floors, rooms &amp; beds</h3><p className="mt-1 text-sm leading-5 text-[#718078]">Create and manage the layout for a PG.</p></div></div>
				<div className="rounded-lg bg-white px-3 py-2 text-sm text-[#526058]">{propertyRooms.length} rooms · {availableBeds} vacant beds</div>
			</div>

			{properties.length === 0 ? <p className="mt-5 rounded-lg bg-white px-4 py-4 text-sm text-[#718078]">Add an active property before creating floors and rooms.</p> : <>
				<label className="mt-5 block max-w-sm text-sm font-medium text-[#38473e]">Property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className={inputClass}>{properties.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}</select></label>
			<form onSubmit={addFloors} className="mt-4 grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
				<label className="text-sm font-medium text-[#38473e]">Floor name prefix<input required value={floorPrefix} onChange={(event) => setFloorPrefix(event.target.value)} className={inputClass} placeholder="Floor" /></label>
				<label className="text-sm font-medium text-[#38473e]">How many?<input required type="number" min="1" max="50" value={floorCount} onChange={(event) => setFloorCount(event.target.value)} className={inputClass} /></label>
				<label className="text-sm font-medium text-[#38473e]">Starting number<input required type="number" min="0" value={firstFloorNumber} onChange={(event) => setFirstFloorNumber(event.target.value)} className={inputClass} /></label>
				<Button type="submit" disabled={busy} className="py-2.5">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}Create floors</Button>
			</form>
			</>}

			{notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}

			{propertyFloors.length === 0 ? <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm text-[#718078]">No floors yet. Add one or generate several above.</p> : <div className="mt-4 space-y-3">{propertyFloors.map((floor) => {
				const floorRooms = propertyRooms.filter((room) => room.floor_id === floor.id);
				const placeCount = floorRooms.reduce((sum, room) => sum + room.capacity, 0);
				return <article key={floor.id} className="rounded-xl border border-[#e8ede8] bg-white p-4">
							<FloorLayout
								floor={floor}
								floorRooms={floorRooms}
								placeCount={placeCount}
								beds={beds}
								occupiedBeds={occupiedBeds}
								residents={residents}
								onSelectResident={setSelectedResident}
								deletingId={deletingId}
								deleteFloor={deleteFloor}
								deleteRoom={deleteRoom}
								deleteBed={deleteBed}
							>
								<RoomCreator propertyId={propertyId} floorId={floor.id} inputClass={inputClass} onCreated={(roomBatch) => { setNotice({ kind: "success", text: `${roomBatch} and their bed slots were added.` }); router.refresh(); }} onError={(message) => setNotice({ kind: "error", text: message })} />
							</FloorLayout>
				</article>;
			})}</div>}
			{selectedResident && <ResidentBedDialog ownerId={ownerId} resident={selectedResident} agreements={agreements.filter((agreement) => agreement.student_id === selectedResident.id)} initialPayments={payments.filter((payment) => payment.student_id === selectedResident.id)} occupancy={occupiedBeds.find((occupancy) => occupancy.student_id === selectedResident.id)} propertyName={properties.find((property) => property.id === selectedResident.property_id)?.name ?? selectedPropertyName} onClose={() => setSelectedResident(null)} />}
		</section>
	);
}

function ResidentBedDialog({ ownerId, resident, agreements, initialPayments, occupancy, propertyName, onClose }: {
	ownerId: string;
	resident: Resident;
	agreements: ResidentAgreement[];
	initialPayments: Payment[];
	occupancy?: OccupiedBed;
	propertyName: string;
	onClose: () => void;
}) {
	const [payments, setPayments] = useState(initialPayments);
	const [loadingPayments, setLoadingPayments] = useState(true);
	const [paymentError, setPaymentError] = useState<string | null>(null);
	const currentAgreement = agreements.find((agreement) => agreement.status !== "cancelled");
	const securityDepositPaise = resident.security_deposit_paise > 0 ? resident.security_deposit_paise : currentAgreement?.security_deposit_paise ?? 0;
	const number = resident.phone.replace(/\D/g, "");
	const whatsappNumber = number.startsWith("91") && number.length === 12 ? number : number.length === 10 || (number.startsWith("0") && number.length === 11) ? `91${number.replace(/^0/, "")}` : number;
	const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello ${resident.full_name}, this is regarding your stay at ${propertyName}.`)}`;
	const currency = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

	useEffect(() => {
		let active = true;
		async function loadPaymentHistory() {
			setLoadingPayments(true);
			setPaymentError(null);
			const { data, error } = await createClient().from("payments").select("id, student_id, amount_paise, method, status, paid_at, created_at, receipt_number").eq("owner_id", ownerId).eq("student_id", resident.id).order("paid_at", { ascending: false, nullsFirst: false });
			if (!active) return;
			if (error) setPaymentError("Could not load payment history.");
			else setPayments(data ?? []);
			setLoadingPayments(false);
		}
		void loadPaymentHistory();
		return () => { active = false; };
	}, [ownerId, resident.id]);

	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
		}
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);

	return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17241f]/45 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
		<section role="dialog" aria-modal="true" aria-labelledby="bed-resident-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
			<header className="flex items-start justify-between gap-4 border-b border-[#edf0ed] px-5 py-4 sm:px-6"><div><p className="text-xs font-medium uppercase tracking-wide text-[#167354]">{propertyName}</p><h2 id="bed-resident-title" className="mt-1 text-xl font-semibold text-[#24332b]">{resident.full_name}</h2><p className="mt-1 text-sm text-[#718078]">Resident profile · {resident.status.replaceAll("_", " ")}</p></div><button type="button" onClick={onClose} aria-label="Close resident details" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#f2f5f2]"><X size={19} /></button></header>
			<div className="overflow-y-auto px-5 py-5 sm:px-6">
				<div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#e8ede8] p-4"><h3 className="font-semibold text-[#34443a]">Profile</h3><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-[#89948d]">Email</dt><dd className="break-all text-[#34443a]">{resident.email || "Not provided"}</dd></div><div><dt className="text-xs text-[#89948d]">Phone</dt><dd className="text-[#34443a]">{resident.phone}</dd></div><div><dt className="text-xs text-[#89948d]">Address</dt><dd className="text-[#34443a]">{resident.permanent_address || "Not provided"}</dd></div><div><dt className="text-xs text-[#89948d]">Resident since</dt><dd className="text-[#34443a]">{new Date(`${resident.joined_on}T00:00:00`).toLocaleDateString("en-IN")}</dd></div></dl></div>
				<div className="rounded-xl border border-[#e8ede8] p-4"><h3 className="font-semibold text-[#34443a]">Rent details</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-2"><dt className="text-[#718078]">Monthly rent</dt><dd className="font-medium text-[#34443a]">{currency(occupancy?.monthly_rent_paise ?? resident.monthly_rent_paise)}</dd></div><div className="flex justify-between gap-2"><dt className="text-[#718078]">Security deposit</dt><dd className="font-medium text-[#34443a]">{currency(securityDepositPaise)}</dd></div><div className="flex justify-between gap-2"><dt className="text-[#718078]">Rent due day</dt><dd className="font-medium text-[#34443a]">{resident.rent_due_day} of each month</dd></div>{occupancy && <div className="flex justify-between gap-2"><dt className="text-[#718078]">Current stay started</dt><dd className="font-medium text-[#34443a]">{new Date(`${occupancy.check_in}T00:00:00`).toLocaleDateString("en-IN")}</dd></div>}</dl></div></div>
				<a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#16804f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#126b42]"><MessageCircle size={17} />Chat on WhatsApp</a>
				<section className="mt-6 border-t border-[#edf0ed] pt-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-[#34443a]">Payment history</h3><span className="rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs text-[#627068]">{payments.length} records</span></div>
				{loadingPayments ? <p className="mt-3 text-sm text-[#718078]">Loading payments…</p> : paymentError ? <p role="alert" className="mt-3 text-sm text-[#9b413c]">{paymentError}</p> : payments.length ? <div className="mt-3 divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] px-4">{payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-[#34443a]">{currency(payment.amount_paise)} <span className="ml-1 text-xs font-normal capitalize text-[#718078]">· {payment.method.replaceAll("_", " ")}</span></p><p className="mt-1 text-xs text-[#89948d]">{payment.receipt_number ? `Receipt ${payment.receipt_number} · ` : ""}{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-IN")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs capitalize ${payment.status === "completed" ? "bg-[#e8f6ed] text-[#167354]" : "bg-[#f0f1f2] text-[#687078]"}`}>{payment.status}</span></div>)}</div> : <p className="mt-3 rounded-lg bg-[#f7faf7] px-4 py-3 text-sm text-[#718078]">No payments recorded for this resident.</p>}</section>
			</div>
		</section>
	</div>;
}

function FloorLayout({
	floor,
	floorRooms,
	placeCount,
	beds,
	occupiedBeds,
	residents,
	onSelectResident,
	deletingId,
	deleteFloor,
	deleteRoom,
	deleteBed,
	children,
}: {
	floor: Floor;
	floorRooms: Room[];
	placeCount: number;
	beds: Bed[];
	occupiedBeds: OccupiedBed[];
	residents: Resident[];
	onSelectResident: (resident: Resident) => void;
	deletingId: string | null;
	deleteFloor: (floor: Floor) => void;
	deleteRoom: (room: Room) => void;
	deleteBed: (bed: Bed, room: Room) => void;
	children: React.ReactNode;
}) {
	const [isExpanded, setIsExpanded] = useState(true);
	const floorBeds = beds.filter((bed) => floorRooms.some((room) => room.id === bed.room_id));
	const occupiedCount = floorBeds.filter((bed) => bed.status === "occupied" || occupiedBeds.some((entry) => entry.bed_id === bed.id)).length;
	const occupiedPercent = floorBeds.length ? Math.round((occupiedCount / floorBeds.length) * 100) : 0;

	return <>
		<div className="flex flex-wrap items-center justify-between gap-2">
			<button type="button" aria-expanded={isExpanded} onClick={() => setIsExpanded((expanded) => !expanded)} className="inline-flex min-w-0 items-center gap-2 rounded-lg py-1 text-left text-[#34443a] hover:text-[#167354] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167354]">
				<ChevronDown size={17} className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
				<Building2 size={16} className="shrink-0 text-[#167354]" />
				<span className="font-semibold">{floor.name}</span>
				{floor.floor_number !== null && <span className="text-xs text-[#89948d]">Floor {floor.floor_number}</span>}
			</button>
			<div className="flex items-center gap-3"><span className="text-xs text-[#718078]">{floorRooms.length} rooms · {placeCount} places</span><button type="button" disabled={deletingId === floor.id} onClick={() => deleteFloor(floor)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#a84337] hover:bg-[#fff0ed] disabled:opacity-50" aria-label={`Delete ${floor.name}`}>{deletingId === floor.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</button></div>
		</div>
		{isExpanded && <div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><h4 className="text-lg font-semibold text-[#24332b]">{floor.name} – Room Overview</h4><span className="rounded-full bg-[#e8f6ed] px-3 py-1.5 text-sm font-medium text-[#167354]">{occupiedPercent}% occupied</span></div>
			{floorRooms.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{floorRooms.map((room) => {
				const roomBeds = beds.filter((bed) => bed.room_id === room.id);
				return <div key={room.id} className="rounded-xl border border-[#e3e9e4] bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-lg font-semibold text-[#24332b]">Room {room.room_number}</p><p className="mt-1 text-xs text-[#718078]">Capacity {room.capacity} · {room.status}{room.monthly_rent_paise !== null ? ` · ₹${(room.monthly_rent_paise / 100).toLocaleString("en-IN")}/month` : ""}</p></div><div className="flex items-center gap-2"><button type="button" disabled={deletingId === room.id} onClick={() => deleteRoom(room)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#a84337] hover:bg-[#fff0ed] disabled:opacity-50" aria-label={`Delete Room ${room.room_number}`}>{deletingId === room.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</button></div></div><div className="mt-4 space-y-2.5">{roomBeds.map((bed) => {
					const occupant = occupiedBeds.find((entry) => entry.bed_id === bed.id);
					const isOccupied = Boolean(occupant) || bed.status === "occupied";
					const isAvailable = bed.status === "available" && !occupant;
					const isReserved = bed.status === "reserved";
					const resident = occupant ? residents.find((item) => item.id === occupant.student_id) : undefined;
					return <div key={bed.id} title={occupant?.student_name ?? bed.status} className="flex items-center gap-3"><button type="button" disabled={!resident} onClick={() => resident && onSelectResident(resident)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:bg-[#f7faf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167354] disabled:cursor-default"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${isOccupied ? "bg-[#e1f4e8] text-[#16804f]" : "bg-[#eef0f3] text-[#667386]"}`}>{isOccupied ? <UserRound size={19} /> : <BedDouble size={19} />}</span><span className="min-w-0 flex-1 truncate text-sm text-[#34443a]">{occupant?.student_name ?? (isReserved ? `Bed ${bed.bed_number} · Reserved` : isAvailable ? "Available" : `Bed ${bed.bed_number} · ${bed.status}`)}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${isOccupied ? "bg-[#e8f6ed] text-[#167354]" : isReserved ? "bg-[#fff5df] text-[#8a6825]" : "bg-[#f0f1f2] text-[#687078]"}`}>{isOccupied ? "Occupied" : isReserved ? "Reserved" : "Empty"}</span></button><button type="button" disabled={deletingId === bed.id} onClick={() => deleteBed(bed, room)} className="rounded p-1 text-[#a84337] hover:bg-[#fff0ed] disabled:opacity-50" aria-label={`Delete bed ${bed.bed_number}`}>{deletingId === bed.id ? <LoaderCircle size={12} className="animate-spin" /> : <Trash2 size={12} />}</button></div>;
				})}</div></div>;
			})}</div> : <p className="mt-3 text-sm text-[#89948d]">No rooms on this floor yet.</p>}
			<div className="mt-4 flex items-center gap-4 text-sm text-[#718078]"><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#16804f]" />Occupied</span><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#a8afb8]" />Available</span></div>
			{children}
		</div>}
	</>;
}

function RoomCreator({
	propertyId,
	floorId,
	inputClass,
	onCreated,
	onError,
}: {
	propertyId: string;
	floorId: string;
	inputClass: string;
	onCreated: (roomBatch: string) => void;
	onError: (message: string) => void;
}) {
	const [roomPrefix, setRoomPrefix] = useState("");
	const [firstRoomNumber, setFirstRoomNumber] = useState("101");
	const [roomCount, setRoomCount] = useState("1");
	const [capacity, setCapacity] = useState("1");
	const [monthlyRent, setMonthlyRent] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const count = Number(roomCount);
		const firstRoom = `${roomPrefix.trim()}${firstRoomNumber}`;
		setBusy(true);
		const { error } = await createClient().rpc("create_owner_rooms", {
			target_property_id: propertyId,
			target_floor_id: floorId,
			target_room_prefix: roomPrefix.trim(),
			target_start_number: Number(firstRoomNumber),
			target_count: count,
			target_capacity: Number(capacity),
			target_monthly_rent_paise: monthlyRent ? Math.round(Number(monthlyRent) * 100) : null,
		});
		if (error) onError(error.message);
		else {
			onCreated(`${count} rooms starting at ${firstRoom}`);
			setRoomCount("1");
			setFirstRoomNumber(String(Number(firstRoomNumber) + count));
		}
		setBusy(false);
	}

	return <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-[#edf0ed] pt-4 sm:grid-cols-2 lg:grid-cols-[90px_110px_110px_110px_150px_auto] lg:items-end">
		<label className="text-xs font-medium text-[#526058]">Prefix (optional)<input value={roomPrefix} onChange={(event) => setRoomPrefix(event.target.value)} className={inputClass} placeholder="A-" /></label>
		<label className="text-xs font-medium text-[#526058]">First room #<input required type="number" min="0" value={firstRoomNumber} onChange={(event) => setFirstRoomNumber(event.target.value)} className={inputClass} /></label>
		<label className="text-xs font-medium text-[#526058]">How many rooms?<input required type="number" min="1" max="50" value={roomCount} onChange={(event) => setRoomCount(event.target.value)} className={inputClass} /></label>
		<label className="text-xs font-medium text-[#526058]">Resident places<input required type="number" min="1" max="100" value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} /></label>
		<label className="text-xs font-medium text-[#526058]">Monthly rent (₹)<input type="number" min="0" step="0.01" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} className={inputClass} placeholder="Optional" /></label>
		<Button type="submit" disabled={busy} className="py-2.5">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}Create rooms</Button>
	</form>;
}
