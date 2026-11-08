"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, LoaderCircle, MapPin, Phone, RotateCcw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyEditButton, type EditableProperty } from "@/components/dashboard/property-edit-button";
import { createClient } from "@/lib/supabase/client";

type Property = EditableProperty & {
  status: string;
  floor_count: number;
  latitude: number | null;
  longitude: number | null;
};
type Stats = { floors: number; rooms: number; beds: number; occupied: number; residents: number; outstanding_paise: number; collected_paise: number };

export function PropertyManagementCard({ ownerId, property, stats }: { ownerId: string; property: Property; stats: Stats }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const currency = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const archived = property.status === "archived";

  async function setArchived() {
    const nextStatus = archived ? "active" : "archived";
    if (!archived && !window.confirm(`Archive ${property.name}? It will no longer be available for new resident assignments.`)) return;
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().from("properties").update({ status: nextStatus, archived_at: archived ? null : new Date().toISOString() }).eq("id", property.id).eq("owner_id", ownerId);
    if (error) setNotice(error.message);
    else router.refresh();
    setBusy(false);
  }

  async function deleteProperty() {
    if (!window.confirm(`Permanently delete ${property.name}? Its empty floors, rooms, and beds will also be deleted. Properties with resident, billing, or activity history must be archived instead.`)) return;
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().rpc("owner_delete_empty_property", { target_property_id: property.id });
    if (error) setNotice(error.message);
    else router.refresh();
    setBusy(false);
  }

  return <article className="rounded-xl border border-[#e8ede8] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-[#24332b]">{property.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${archived ? "bg-[#f0f1f2] text-[#687078]" : property.status === "active" ? "bg-[#eff7f1] text-[#26714f]" : "bg-[#fff5df] text-[#8a6825]"}`}>{property.status}</span></div><p className="mt-1 text-sm text-[#718078]">{property.code} · {[property.locality, property.city, property.state].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm text-[#89948d]">{property.address} · PIN {property.pin_code}</p></div><div className="flex flex-wrap gap-2"><PropertyEditButton property={property} /><Button type="button" variant="outline" disabled={busy} onClick={setArchived} className="py-2 text-sm">{busy ? <LoaderCircle size={15} className="animate-spin" /> : archived ? <RotateCcw size={15} /> : <Archive size={15} />}{archived ? "Restore" : "Archive"}</Button><Button type="button" variant="outline" disabled={busy} onClick={deleteProperty} className="py-2 text-sm text-[#9b413c] hover:bg-[#fff7f6]">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}Delete listing</Button></div></div>
    {notice && <p role="alert" className="mt-3 text-sm text-[#9b413c]">{notice}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{[
      ["Floors", stats.floors], ["Rooms", stats.rooms], ["Beds", stats.beds], ["Occupied", `${stats.occupied}/${stats.beds}`], ["Residents", stats.residents], ["Outstanding", currency(stats.outstanding_paise)], ["Collected", currency(stats.collected_paise)],
    ].map(([label, value]) => <div key={label} className="rounded-lg bg-[#f7faf7] px-3 py-2.5"><p className="text-[11px] text-[#89948d]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#34443a]">{value}</p></div>)}</div>
    <details className="mt-4 border-t border-[#edf0ed] pt-3"><summary className="cursor-pointer text-sm font-medium text-[#167354]">View details, staff, settings and reports</summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section><h4 className="font-semibold text-[#34443a]">Property details</h4><div className="mt-3 space-y-2 text-sm text-[#526058]">{property.manager_name && <p><Users size={14} className="mr-1.5 inline text-[#167354]" />Manager: {property.manager_name}{property.manager_phone ? ` · ${property.manager_phone}` : ""}</p>}{property.contact_phone && <p><Phone size={14} className="mr-1.5 inline text-[#167354]" />{property.contact_phone}</p>}{(property.maps_url || (property.latitude !== null && property.longitude !== null)) && <a className="inline-flex items-center gap-1 text-[#167354] hover:underline" href={property.maps_url ?? `https://maps.google.com/?q=${property.latitude},${property.longitude}`} target="_blank" rel="noreferrer"><MapPin size={14} />Open in Google Maps <ExternalLink size={13} /></a>}<p><strong>Amenities:</strong> {property.amenities.length ? property.amenities.join(" · ") : "Not added"}</p></div><PropertyPhotos propertyId={property.id} imagePaths={property.image_paths} /><PropertySettingsManager ownerId={ownerId} propertyId={property.id} /></section>
        <PropertyStaffManager ownerId={ownerId} propertyId={property.id} />
      </div>
      <section className="mt-5 border-t border-[#edf0ed] pt-4"><h4 className="font-semibold text-[#34443a]">Property report</h4><p className="mt-1 text-sm text-[#718078]">{stats.occupied} of {stats.beds} beds occupied · {Math.max(0, stats.beds - stats.occupied)} beds available · {stats.residents} residents · {currency(stats.collected_paise)} collected on invoices · {currency(stats.outstanding_paise)} unpaid invoice balance.</p></section>
    </details>
  </article>;
}

function PropertyPhotos({ propertyId, imagePaths }: { propertyId: string; imagePaths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    async function load() {
      const client = createClient();
      const signed = await Promise.all(imagePaths.map(async (path) => {
        const { data } = await client.storage.from("pg-documents").createSignedUrl(path, 3600);
        return data?.signedUrl ?? null;
      }));
      if (active) setUrls(signed.filter((url): url is string => Boolean(url)));
    }
    void load();
    return () => { active = false; };
  }, [propertyId, imagePaths]);
  return urls.length ? <div className="mt-3 grid grid-cols-3 gap-2">{urls.map((url, index) => <img key={`${propertyId}-${index}`} src={url} alt={`Property photo ${index + 1}`} className="h-20 w-full rounded-lg object-cover" />)}</div> : null;
}

function PropertySettingsManager({ ownerId, propertyId }: { ownerId: string; propertyId: string }) {
  const [settings, setSettings] = useState<{ check_in_time: string; check_out_time: string; visitor_policy: string; house_rules: string; emergency_contact: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function loadSettings() {
      const { data } = await createClient().from("property_settings").select("check_in_time, check_out_time, visitor_policy, house_rules, emergency_contact").eq("property_id", propertyId).maybeSingle();
      if (active) setSettings(data ?? { check_in_time: "14:00:00", check_out_time: "11:00:00", visitor_policy: "", house_rules: "", emergency_contact: "" });
    }
    void loadSettings();
    return () => { active = false; };
  }, [propertyId]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    const { error } = await createClient().from("property_settings").upsert({ owner_id: ownerId, property_id: propertyId, check_in_time: String(values.get("checkIn") ?? "14:00"), check_out_time: String(values.get("checkOut") ?? "11:00"), visitor_policy: String(values.get("visitorPolicy") ?? ""), house_rules: String(values.get("houseRules") ?? ""), emergency_contact: String(values.get("emergencyContact") ?? "").trim() || null }, { onConflict: "property_id" });
    setNotice(error ? error.message : "Property settings saved.");
    setBusy(false);
  }
  if (!settings) return <p className="mt-4 text-xs text-[#718078]">Loading property settings…</p>;
  const input = "mt-1 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#63a888]";
  return <details className="mt-5 border-t border-[#edf0ed] pt-4"><summary className="cursor-pointer font-semibold text-[#34443a]">Property-specific settings</summary><form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-[#526058]">Check-in time<input type="time" name="checkIn" defaultValue={settings.check_in_time.slice(0, 5)} className={input} /></label><label className="text-xs font-medium text-[#526058]">Check-out time<input type="time" name="checkOut" defaultValue={settings.check_out_time.slice(0, 5)} className={input} /></label><label className="text-xs font-medium text-[#526058] sm:col-span-2">Visitor policy<textarea name="visitorPolicy" rows={2} defaultValue={settings.visitor_policy} className={input} /></label><label className="text-xs font-medium text-[#526058] sm:col-span-2">House rules<textarea name="houseRules" rows={3} defaultValue={settings.house_rules} className={input} /></label><label className="text-xs font-medium text-[#526058] sm:col-span-2">Emergency contact<input name="emergencyContact" defaultValue={settings.emergency_contact} className={input} /></label><div className="sm:col-span-2"><Button type="submit" disabled={busy} variant="outline" className="py-2">{busy && <LoaderCircle size={14} className="animate-spin" />}Save settings</Button>{notice && <p role="status" className="mt-2 text-xs text-[#26714f]">{notice}</p>}</div></form></details>;
}

function PropertyStaffManager({ ownerId, propertyId }: { ownerId: string; propertyId: string }) {
  const [staff, setStaff] = useState<{ id: string; full_name: string; role: string; phone: string | null; email: string | null; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const client = useMemo(() => createClient(), []);
  const load = useCallback(async () => {
    const { data, error } = await client.from("property_staff_directory").select("id, full_name, role, phone, email, is_active").eq("property_id", propertyId).order("full_name");
    if (!error) setStaff(data ?? []);
    setLoading(false);
  }, [client, propertyId]);
  useEffect(() => { void load(); }, [load]);
  async function addStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    const { error } = await client.from("property_staff_directory").insert({ owner_id: ownerId, property_id: propertyId, full_name: String(values.get("name") ?? "").trim(), role: String(values.get("role") ?? "").trim(), phone: String(values.get("phone") ?? "").trim() || null, email: String(values.get("email") ?? "").trim() || null });
    if (error) setNotice(error.message);
    else { form.reset(); setNotice("Staff member added."); await load(); }
    setBusy(false);
  }
  async function toggleStaff(member: (typeof staff)[number]) {
    const { error } = await client.from("property_staff_directory").update({ is_active: !member.is_active }).eq("id", member.id);
    if (error) setNotice(error.message); else await load();
  }
  const input = "mt-1 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#63a888]";
  return <section><h4 className="font-semibold text-[#34443a]">Property staff</h4><p className="mt-1 text-xs text-[#718078]">Keep property-specific manager and staff contacts here.</p>{loading ? <p className="mt-3 text-sm text-[#718078]">Loading staff…</p> : staff.length ? <div className="mt-3 divide-y divide-[#edf0ed] rounded-xl border border-[#e8ede8] px-3">{staff.map((member) => <div key={member.id} className="flex items-center justify-between gap-2 py-3"><div><p className="text-sm font-medium text-[#34443a]">{member.full_name} <span className="font-normal capitalize text-[#718078]">· {member.role}</span></p><p className="mt-1 text-xs text-[#89948d]">{[member.phone, member.email].filter(Boolean).join(" · ") || "No contact details"}</p></div><button type="button" onClick={() => toggleStaff(member)} className={`rounded-full px-2.5 py-1 text-xs ${member.is_active ? "bg-[#eff7f1] text-[#26714f]" : "bg-[#f0f1f2] text-[#687078]"}`}>{member.is_active ? "Active" : "Inactive"}</button></div>)}</div> : <p className="mt-3 text-sm text-[#718078]">No staff added.</p>}
    <form onSubmit={addStaff} className="mt-4 grid gap-2 sm:grid-cols-2"><label className="text-xs font-medium text-[#526058]">Name<input required name="name" className={input} /></label><label className="text-xs font-medium text-[#526058]">Role<input required name="role" placeholder="Manager, cook, cleaner…" className={input} /></label><label className="text-xs font-medium text-[#526058]">Phone<input type="tel" name="phone" className={input} /></label><label className="text-xs font-medium text-[#526058]">Email<input type="email" name="email" className={input} /></label><div className="sm:col-span-2"><Button type="submit" disabled={busy} variant="outline" className="py-2">{busy && <LoaderCircle size={14} className="animate-spin" />}Add staff contact</Button>{notice && <p role="status" className="mt-2 text-xs text-[#718078]">{notice}</p>}</div></form>
  </section>;
}
