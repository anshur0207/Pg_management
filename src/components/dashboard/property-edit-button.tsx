"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type EditableProperty = {
  id: string;
  owner_id: string;
  name: string;
  code: string;
  address: string;
  locality: string | null;
  city: string;
  gender_policy: "female_only" | "male_only" | "all_genders" | "unspecified";
  state: string;
  pin_code: string | null;
  maps_url: string | null;
  contact_phone: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  amenities: string[];
  image_paths: string[];
  public_description: string | null;
  marketplace_enabled: boolean;
};

export function PropertyEditButton({ property }: { property: EditableProperty }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImageCount, setSelectedImageCount] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<{ path: string; url: string }[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadPhotos() {
      const client = createClient();
      const signed = await Promise.all(property.image_paths.map(async (path) => {
        const { data } = await client.storage.from("pg-documents").createSignedUrl(path, 3600);
        return data?.signedUrl ? { path, url: data.signedUrl } : null;
      }));
      if (active) {
        setPhotoUrls(signed.filter((photo): photo is { path: string; url: string } => Boolean(photo)));
        setRemovedPaths([]);
      }
    }
    void loadPhotos();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => { active = false; window.removeEventListener("keydown", closeOnEscape); };
  }, [isOpen, property.image_paths]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const images = values.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
    if (images.some((image) => !["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 20 * 1024 * 1024)) {
      setNotice({ kind: "error", text: "Choose JPG, PNG, or WebP image files up to 20 MB each." });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    const client = createClient();
    const uploadedPaths: string[] = [];
    const imagePaths = property.image_paths.filter((path) => !removedPaths.includes(path));
    async function removeUploadedFiles() {
      if (!uploadedPaths.length) return;
      await client.from("documents").delete().eq("owner_id", property.owner_id).in("storage_path", uploadedPaths);
      await client.storage.from("pg-documents").remove(uploadedPaths);
    }
    for (const image of images) {
      const extension = image.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
      const path = `${property.owner_id}/${property.id}/images/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from("pg-documents").upload(path, image, { contentType: image.type, upsert: false });
      if (uploadError) {
        await removeUploadedFiles();
        setNotice({ kind: "error", text: uploadError.message });
        setIsSaving(false);
        return;
      }
      const { error: recordError } = await client.from("documents").insert({ owner_id: property.owner_id, property_id: property.id, document_type: "photograph", file_name: image.name, storage_path: path, content_type: image.type, size_bytes: image.size });
      if (recordError) {
        await client.storage.from("pg-documents").remove([path]);
        await removeUploadedFiles();
        setNotice({ kind: "error", text: recordError.message });
        setIsSaving(false);
        return;
      }
      imagePaths.push(path);
      uploadedPaths.push(path);
    }

    const updates = {
      code: String(values.get("code") ?? "").trim().toUpperCase(),
      name: String(values.get("name") ?? "").trim(),
      address: String(values.get("address") ?? "").trim(),
      locality: String(values.get("locality") ?? "").trim() || null,
      city: String(values.get("city") ?? "").trim(),
      gender_policy: String(values.get("genderPolicy") ?? "unspecified") as EditableProperty["gender_policy"],
      state: String(values.get("state") ?? "").trim(),
      pin_code: String(values.get("pinCode") ?? "").trim(),
      maps_url: String(values.get("mapsUrl") ?? "").trim() || null,
      contact_phone: String(values.get("contactPhone") ?? "").trim() || null,
      manager_name: String(values.get("managerName") ?? "").trim() || null,
      manager_phone: String(values.get("managerPhone") ?? "").trim() || null,
      amenities: String(values.get("amenities") ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      image_paths: imagePaths,
      public_description: String(values.get("publicDescription") ?? "").trim() || null,
      marketplace_enabled: values.get("marketplaceEnabled") === "on",
    };
    const { error } = await client.from("properties").update(updates).eq("id", property.id).eq("owner_id", property.owner_id);
    if (error) {
      await removeUploadedFiles();
      setNotice({ kind: "error", text: error.message });
    }
    else {
      if (removedPaths.length) {
        await client.from("documents").delete().eq("owner_id", property.owner_id).in("storage_path", removedPaths);
        await client.storage.from("pg-documents").remove(removedPaths);
      }
      setNotice({ kind: "success", text: "Property details have been updated." });
      router.refresh();
      window.setTimeout(() => setIsOpen(false), 500);
    }
    setIsSaving(false);
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-base text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return <>
    <Button type="button" variant="outline" onClick={() => { setNotice(null); setSelectedImageCount(0); setIsOpen(true); }} className="py-2 text-sm"><Pencil size={15} />Edit details</Button>
    {isOpen && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" aria-label="Close property editor" className="absolute inset-0 bg-[#17241f]/45" onClick={() => setIsOpen(false)} />
      <section role="dialog" aria-modal="true" aria-labelledby={`edit-property-title-${property.id}`} className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-[#167354]">Property details</p><h2 id={`edit-property-title-${property.id}`} className="mt-1 text-xl font-semibold text-[#24332b]">Edit {property.name}</h2><p className="mt-1 text-sm text-[#718078]">Changes will appear in the owner and resident portals.</p></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#f2f5f2]"><X size={19} /></button></header>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#38473e]">Property code<input required name="code" defaultValue={property.code} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">Property name<input required minLength={2} name="name" defaultValue={property.name} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Street address<input required minLength={5} name="address" defaultValue={property.address} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">Area / locality<input name="locality" defaultValue={property.locality ?? ""} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">City<input required name="city" defaultValue={property.city} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">PG type<select name="genderPolicy" defaultValue={property.gender_policy ?? "unspecified"} className={inputClass}><option value="unspecified">Not specified</option><option value="female_only">Female residents only</option><option value="male_only">Male residents only</option><option value="all_genders">All genders</option></select></label>
          <label className="text-sm font-medium text-[#38473e]">State<input required name="state" defaultValue={property.state} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">PIN / postal code<input required name="pinCode" defaultValue={property.pin_code ?? ""} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">Google Maps link<input type="url" name="mapsUrl" defaultValue={property.maps_url ?? ""} className={inputClass} placeholder="https://maps.google.com/..." /></label>
          <label className="text-sm font-medium text-[#38473e]">Property contact number<input type="tel" name="contactPhone" defaultValue={property.contact_phone ?? ""} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">Property manager name<input name="managerName" defaultValue={property.manager_name ?? ""} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e]">Property manager phone<input type="tel" name="managerPhone" defaultValue={property.manager_phone ?? ""} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Amenities<textarea name="amenities" rows={3} defaultValue={property.amenities.join(", ")} className={inputClass} placeholder="Separate amenities with commas or new lines" /></label>
          <label className="text-sm font-medium text-[#38473e] sm:col-span-2">Public listing description<textarea name="publicDescription" rows={4} maxLength={3000} defaultValue={property.public_description ?? ""} className={inputClass} placeholder="Describe the rooms, atmosphere, location, and what makes this PG a good place to stay." /></label>
          <label className="flex items-start gap-3 rounded-xl border border-[#dce9e1] bg-[#f7faf7] p-4 text-sm text-[#34443a] sm:col-span-2"><input type="checkbox" name="marketplaceEnabled" defaultChecked={property.marketplace_enabled} className="mt-0.5 size-4 accent-[#167354]" /><span><span className="font-semibold">List this PG publicly</span><span className="mt-1 block text-xs leading-5 text-[#718078]">When enabled, the PG name, address, contact number, photos, amenities, description, rent range, open bed count, and published feedback will appear on the homepage.</span></span></label>
          <div className="sm:col-span-2"><p className="text-sm font-medium text-[#38473e]">Property photos</p>{photoUrls.filter((photo) => !removedPaths.includes(photo.path)).length > 0 && <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{photoUrls.filter((photo) => !removedPaths.includes(photo.path)).map((photo, index) => <div key={photo.path} className="relative"><img src={photo.url} alt={`${property.name} photo ${index + 1}`} className="h-24 w-full rounded-lg object-cover" /><button type="button" onClick={() => setRemovedPaths((current) => [...current, photo.path])} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-[#9b413c] shadow">Remove</button></div>)}</div>}<label className="mt-3 block text-sm font-medium text-[#38473e]">Add multiple photos<input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedImageCount(event.target.files?.length ?? 0)} className="mt-1.5 block w-full rounded-lg border border-[#dfe6e1] bg-white p-2 text-sm font-normal text-[#526058] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eff7f1] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#167354]" /></label><span className="mt-1 block text-xs font-normal text-[#89948d]">{selectedImageCount ? `${selectedImageCount} ${selectedImageCount === 1 ? "photo" : "photos"} selected. ` : "Select multiple files at once. "}JPG, PNG, or WebP, up to 20 MB each. Photos appear on the listing only while public listing is enabled.</span></div>
          <div className="flex flex-wrap gap-3 sm:col-span-2"><Button type="submit" disabled={isSaving} className="py-3">{isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Pencil size={15} />}Save changes</Button><Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="py-3">Cancel</Button></div>
        </form>
        {notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
      </section>
    </div>}
  </>;
}
