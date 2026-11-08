"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { PropertyImageCarousel } from "@/components/marketplace/property-image-carousel";

type PublicPropertyListing = {
  id: string;
  name: string;
  address: string;
  locality: string | null;
  city: string;
  state: string;
  pin_code: string | null;
  gender_policy: "female_only" | "male_only" | "all_genders" | "unspecified";
  amenities: string[];
  public_description: string | null;
  photoUrls: string[];
  openBeds: number;
  startingRentPaise: number | null;
  averageRating: number | null;
  reviewCount: number;
};

type GenderFilter = "all" | "female" | "male";

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const normalized = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();
const genderLabel: Record<PublicPropertyListing["gender_policy"], string> = {
  female_only: "Female PG",
  male_only: "Male PG",
  all_genders: "All genders",
  unspecified: "PG type not specified",
};

export function PublicPropertyListings({ listings }: { listings: PublicPropertyListing[] }) {
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const cities = useMemo(() => Array.from(new Map(listings.filter((item) => item.city.trim()).map((item) => [normalized(item.city), item.city.trim()])).values()).sort((a, b) => a.localeCompare(b)), [listings]);
  const areas = useMemo(() => {
    const source = city ? listings.filter((item) => normalized(item.city) === normalized(city)) : listings;
    return Array.from(new Map(source.filter((item) => item.locality?.trim()).map((item) => [normalized(item.locality), item.locality!.trim()])).values()).sort((a, b) => a.localeCompare(b));
  }, [city, listings]);
  const filteredListings = useMemo(() => listings.filter((item) => {
    if (city && normalized(item.city) !== normalized(city)) return false;
    if (area && normalized(item.locality) !== normalized(area)) return false;
    if (pinCode.trim() && !normalized(item.pin_code).includes(normalized(pinCode))) return false;
    if (gender === "female" && !["female_only", "all_genders"].includes(item.gender_policy)) return false;
    if (gender === "male" && !["male_only", "all_genders"].includes(item.gender_policy)) return false;
    return true;
  }), [area, city, gender, listings, pinCode]);

  function clearFilters() {
    setCity("");
    setArea("");
    setPinCode("");
    setGender("all");
  }

  const inputClass = "w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm text-[#203028] outline-none focus:border-[#63a888] focus:ring-4 focus:ring-[#167354]/[.08]";

  return <>
    <div className="mt-8 rounded-2xl border border-[#e4ebe5] bg-[#f7faf7] p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-[#526058]">City<select value={city} onChange={(event) => { setCity(event.target.value); setArea(""); }} className={`${inputClass} mt-1.5`}><option value="">All cities</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-xs font-semibold text-[#526058]">Area / locality<select value={area} onChange={(event) => setArea(event.target.value)} className={`${inputClass} mt-1.5`}><option value="">All areas</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-xs font-semibold text-[#526058]">PIN code<input value={pinCode} onChange={(event) => setPinCode(event.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="Enter PIN code" className={`${inputClass} mt-1.5`} /></label>
        <label className="text-xs font-semibold text-[#526058]">PG for<select value={gender} onChange={(event) => setGender(event.target.value as GenderFilter)} className={`${inputClass} mt-1.5`}><option value="all">Any / all PGs</option><option value="female">Female PGs</option><option value="male">Male PGs</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><p aria-live="polite" className="text-[#718078]">Showing <span className="font-semibold text-[#34443a]">{filteredListings.length}</span> of {listings.length} PGs</p>{(city || area || pinCode || gender !== "all") && <button type="button" onClick={clearFilters} className="font-medium text-[#167354] hover:underline">Clear filters</button>}</div>
    </div>

    {filteredListings.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filteredListings.map((property) => (
      <article key={property.id} className="group overflow-hidden rounded-2xl border border-[#e4ebe5] bg-white transition hover:-translate-y-0.5 hover:border-[#bbd9c7] hover:shadow-[0_16px_40px_-28px_rgba(22,115,84,.4)]">
        <div className="relative"><PropertyImageCarousel images={property.photoUrls} label={property.name} className="h-52" /><span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#276d4d] shadow-sm">{property.openBeds} {property.openBeds === 1 ? "bed" : "beds"} open</span></div>
        <Link href={`/pg/${property.id}`} className="block p-5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#167354]"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold tracking-tight text-[#24332b] group-hover:text-[#167354]">{property.name}</h3><ArrowRight size={17} className="mt-1 shrink-0 text-[#8c9a90] transition group-hover:translate-x-0.5 group-hover:text-[#167354]" /></div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#718078]"><MapPin size={14} className="shrink-0" />{[property.locality, property.city, property.state].filter(Boolean).join(", ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs font-medium text-[#526058]">{genderLabel[property.gender_policy]}</span>{property.pin_code && <span className="text-xs text-[#718078]">PIN {property.pin_code}</span>}</div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#6d7a72]">{property.public_description || [property.address, ...(property.amenities ?? []).slice(0, 3)].filter(Boolean).join(" · ")}</p>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#edf0ed] pt-4"><div><p className="text-[11px] uppercase tracking-wide text-[#89948d]">Monthly rent</p><p className="mt-1 text-base font-semibold text-[#24332b]">{property.startingRentPaise !== null ? `From ${rupees(property.startingRentPaise)}` : "Contact for rent"}<span className="text-xs font-normal text-[#718078]">{property.startingRentPaise !== null ? "/mo" : ""}</span></p></div><span className="inline-flex items-center gap-1 text-xs text-[#718078]">{property.averageRating === null ? <span>No feedback</span> : <><Star size={13} className="fill-[#e4a93b] text-[#e4a93b]" /><span className="font-semibold text-[#34443a]">{property.averageRating.toFixed(1)}</span><span>({property.reviewCount})</span></>}</span></div>
        </Link>
      </article>
    ))}</div> : <div className="mt-6 rounded-2xl border border-dashed border-[#dce6de] bg-[#fbfcfb] px-6 py-10 text-center"><p className="text-base font-semibold text-[#34443a]">No PGs match these filters</p><p className="mt-2 text-sm text-[#718078]">Try another city, area, PIN code, or PG type.</p><button type="button" onClick={clearFilters} className="mt-4 text-sm font-medium text-[#167354] hover:underline">Clear filters</button></div>}
  </>;
}
