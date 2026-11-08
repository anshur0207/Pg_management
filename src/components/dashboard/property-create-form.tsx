"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function PropertyCreateForm({ ownerId }: { ownerId: string }) {
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
      const client = createClient();
      const name = String(values.get("name") ?? "").trim();
      const enteredCode = String(values.get("code") ?? "").trim().toUpperCase();
      const { data: insertedProperty, error: propertyError } = await client.from("properties").insert({
        owner_id: ownerId,
        name,
        code: enteredCode || `PG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        address: String(values.get("address") ?? "").trim(),
        locality: String(values.get("locality") ?? "").trim() || null,
        city: String(values.get("city") ?? "").trim(),
        gender_policy: String(values.get("genderPolicy") ?? "unspecified"),
        state: String(values.get("state") ?? "").trim(),
        pin_code: String(values.get("pinCode") ?? "").trim(),
        maps_url: String(values.get("mapsUrl") ?? "").trim() || null,
        contact_phone: String(values.get("contactPhone") ?? "").trim() || null,
        manager_name: String(values.get("managerName") ?? "").trim() || null,
        manager_phone: String(values.get("managerPhone") ?? "").trim() || null,
        amenities: String(values.get("amenities") ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        public_description: String(values.get("publicDescription") ?? "").trim() || null,
        marketplace_enabled: values.get("marketplaceEnabled") === "on",
      }).select("id").single();
      if (propertyError) throw propertyError;

      const { data: floorId, error: floorError } = await client.rpc("create_owner_floor", {
        target_property_id: insertedProperty.id,
        target_floor_name: "Ground Floor",
        target_floor_number: 1,
      });
      if (floorError) throw floorError;
      if (!floorId) throw new Error("The property was created but its default floor could not be prepared.");

      const { error: roomError } = await client.rpc("create_owner_room", {
        target_property_id: insertedProperty.id,
        target_floor_id: floorId,
        target_room_number: "101",
        target_capacity: 1,
        target_monthly_rent_paise: null,
      });
      if (roomError) throw roomError;

      setNotice({ kind: "success", text: `${name} was added with a default room and bed ready for use.` });
      form.reset();
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to add this property. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return (
    <section className="mt-8 rounded-2xl border border-[#e4ebe5] bg-white p-6 sm:p-8">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eff7f1] text-[#167354]"><Building2 size={20} /></span><div><h2 className="text-xl font-semibold text-[#24332b]">Add a property</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Create a property record before inviting residents.</p></div></div>
      <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium text-[#38473e]">Property / PG name<input required minLength={2} name="name" className={inputClass} placeholder="e.g. Green House Living" /></label>
        <label className="text-sm font-medium text-[#38473e]">Property code<input name="code" className={inputClass} placeholder="Leave blank to generate one" /></label>
        <label className="text-sm font-medium text-[#38473e]">Street address<input required minLength={5} name="address" className={inputClass} placeholder="Building and street" /></label>
        <label className="text-sm font-medium text-[#38473e]">Area / locality<input name="locality" className={inputClass} placeholder="Area or neighbourhood" /></label>
        <label className="text-sm font-medium text-[#38473e]">City<input required name="city" className={inputClass} placeholder="City" /></label>
        <label className="text-sm font-medium text-[#38473e]">PG type<select name="genderPolicy" defaultValue="unspecified" className={inputClass}><option value="unspecified">Not specified</option><option value="female_only">Female residents only</option><option value="male_only">Male residents only</option><option value="all_genders">All genders</option></select></label>
        <label className="text-sm font-medium text-[#38473e]">State<input required name="state" className={inputClass} placeholder="State" /></label>
        <label className="text-sm font-medium text-[#38473e]">PIN / postal code<input required name="pinCode" inputMode="numeric" maxLength={10} className={inputClass} placeholder="Postal code" /></label>
        <label className="text-sm font-medium text-[#38473e]">Google Maps link<input type="url" name="mapsUrl" className={inputClass} placeholder="https://maps.google.com/..." /></label>
        <label className="text-sm font-medium text-[#38473e]">Property contact number<input type="tel" name="contactPhone" className={inputClass} placeholder="Phone number" /></label>
        <label className="text-sm font-medium text-[#38473e]">Property manager name<input name="managerName" className={inputClass} placeholder="Manager name" /></label>
        <label className="text-sm font-medium text-[#38473e]">Property manager phone<input type="tel" name="managerPhone" className={inputClass} placeholder="Manager phone" /></label>
        <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Amenities<textarea name="amenities" rows={3} className={inputClass} placeholder="Wi-Fi, meals, laundry — separate with commas or new lines" /></label>
        <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Public listing description<textarea name="publicDescription" rows={4} maxLength={3000} className={inputClass} placeholder="Describe the rooms, atmosphere, location, and what makes this PG a good place to stay." /></label>
        <label className="flex items-start gap-3 rounded-xl border border-[#dce9e1] bg-[#f7faf7] p-4 text-sm text-[#34443a] sm:col-span-2"><input type="checkbox" name="marketplaceEnabled" className="mt-0.5 size-4 accent-[#167354]" /><span><span className="font-semibold">Show this PG in public listings</span><span className="mt-1 block text-xs leading-5 text-[#718078]">Your listing will include its name, public address, contact number, photos, amenities, description, rent range, and number of open beds. You can turn this on later.</span></span></label>
        <div className="sm:col-span-2"><p className="text-xs text-[#89948d]">Rooms, beds, and floor count are calculated from the layout you add after creating the property. Add property photos from Edit details.</p><Button type="submit" disabled={isSubmitting} className="mt-3 py-3 text-base">{isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Building2 size={18} />}Add property</Button></div>
      </form>
      {notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
    </section>
  );
}
