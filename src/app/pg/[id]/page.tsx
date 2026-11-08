import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BedDouble, Check, MapPin, MessageCircle, Phone, Snowflake, Star } from "lucide-react";
import { PropertyReviewForm } from "@/components/marketplace/property-review-form";
import { PropertyImageCarousel } from "@/components/marketplace/property-image-carousel";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "PG details" };
export const dynamic = "force-dynamic";

type PropertyPageProps = { params: Promise<{ id: string }> };
type RoomListing = { id: string; floor_id: string; room_number: string; room_type: string; capacity: number; has_ac: boolean; bathroom_type: string; monthly_rent_paise: number | null; amenities: string[] };

const money = (paise: number | null) => paise === null ? "Contact for rent" : `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}/month`;

export default async function PublicPropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();
  const supabase = createPublicClient();
  const authClient = await createClient();
  const { data: property } = await supabase.from("properties")
    .select("id, name, address, locality, city, state, pin_code, gender_policy, maps_url, latitude, longitude, contact_phone, amenities, image_paths, public_description")
    .eq("id", id).eq("status", "active").eq("marketplace_enabled", true).maybeSingle();
  if (!property) notFound();

  const [{ data: floors }, { data: roomRows }, { data: reviewRows }] = await Promise.all([
    supabase.from("floors").select("id, name, floor_number").eq("property_id", id).order("floor_number", { ascending: true, nullsFirst: false }).order("name"),
    supabase.from("rooms").select("id, floor_id, room_number, room_type, capacity, has_ac, bathroom_type, monthly_rent_paise, amenities").eq("property_id", id).eq("status", "active").order("room_number"),
    supabase.from("property_reviews").select("id, rating, feedback, created_at").eq("property_id", id).eq("status", "published").order("created_at", { ascending: false }),
  ]);
  const authResult = await authClient.auth.getUser();
  const rooms = (roomRows ?? []) as RoomListing[];
  const roomIds = rooms.map((room) => room.id);
  const { data: beds } = roomIds.length
    ? await supabase.from("beds").select("id, room_id").in("room_id", roomIds).eq("status", "available")
    : { data: [] };
  const bedCountByRoom = new Map<string, number>();
  for (const bed of beds ?? []) bedCountByRoom.set(bed.room_id, (bedCountByRoom.get(bed.room_id) ?? 0) + 1);
  const roomsByFloor = new Map<string, RoomListing[]>();
  for (const room of rooms) roomsByFloor.set(room.floor_id, [...(roomsByFloor.get(room.floor_id) ?? []), room]);
  const unassignedRooms = rooms.filter((room) => !(floors ?? []).some((floor) => floor.id === room.floor_id));

  const signedImages = await Promise.all((property.image_paths ?? []).map(async (path: string) => {
    const { data } = await supabase.storage.from("pg-documents").createSignedUrl(path, 1800);
    return data?.signedUrl ?? null;
  }));
  const images = signedImages.filter((url): url is string => Boolean(url));
  const reviews = reviewRows ?? [];
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : null;
  const openBedCount = (beds ?? []).length;
  const phoneDigits = (property.contact_phone ?? "").replace(/\D/g, "");
  const mapHref = property.maps_url || (property.latitude !== null && property.longitude !== null ? `https://maps.google.com/?q=${property.latitude},${property.longitude}` : null);
  let resident: { id: string; owner_id: string } | null = null;
  const currentUser = authResult.data.user;
  if (currentUser) {
    const { data } = await authClient.from("students").select("id, owner_id").eq("auth_user_id", currentUser.id).eq("property_id", id).maybeSingle();
    resident = data;
  }
  const fullAddress = [property.address, property.locality, property.city, property.state, property.pin_code].filter(Boolean).join(", ");

  const { data: nearbyProperties } = await supabase
    .from("properties")
    .select("id, name, city, locality, image_paths")
    .eq("status", "active")
    .eq("marketplace_enabled", true)
    .neq("id", id)
    .order("city", { ascending: true })
    .order("locality", { ascending: true, nullsFirst: true })
    .limit(20);

  const nearbyPropertyIds = (nearbyProperties ?? []).map((item) => item.id);
  const nearbyRooms = nearbyPropertyIds.length
    ? (await supabase.from("rooms").select("id, property_id").in("property_id", nearbyPropertyIds).eq("status", "active")).data ?? []
    : [];
  const nearbyRoomIds = nearbyRooms.map((room) => room.id);
  const nearbyBeds = nearbyRoomIds.length
    ? (await supabase.from("beds").select("id, room_id").in("room_id", nearbyRoomIds).eq("status", "available")).data ?? []
    : [];
  const nearbyOpenBedsByProperty = new Map<string, number>();
  for (const bed of nearbyBeds) {
    const room = nearbyRooms.find((item) => item.id === bed.room_id);
    if (!room) continue;
    nearbyOpenBedsByProperty.set(room.property_id, (nearbyOpenBedsByProperty.get(room.property_id) ?? 0) + 1);
  }

  const nearbySuggestions = (nearbyProperties ?? [])
    .map((item) => ({
      ...item,
      openBedCount: nearbyOpenBedsByProperty.get(item.id) ?? 0,
      sameCity: item.city === property.city,
      sameLocality: item.locality === property.locality,
    }))
    .filter((item) => item.openBedCount > 0)
    .sort((a, b) => {
      if (a.sameCity !== b.sameCity) return Number(b.sameCity) - Number(a.sameCity);
      if (a.sameLocality !== b.sameLocality) return Number(b.sameLocality) - Number(a.sameLocality);
      return b.openBedCount - a.openBedCount;
    })
    .slice(0, 4);

  const nearbySuggestionImages = await Promise.all(nearbySuggestions.map(async (item) => {
    const firstPath = item.image_paths?.[0];
    if (!firstPath) return null;
    const { data } = await supabase.storage.from("pg-documents").createSignedUrl(firstPath, 1800);
    return { id: item.id, url: data?.signedUrl ?? null };
  }));
  const nearbySuggestionImageMap = new Map(nearbySuggestionImages.filter((item): item is { id: string; url: string } => Boolean(item)).map((item) => [item.id, item.url]));

  return <main className="min-h-screen bg-[#f7f9f7]">
    <header className="border-b border-[#e7ece8] bg-white"><div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8"><Link href="/#pg-listings" className="inline-flex items-center gap-2 text-sm font-medium text-[#526058] transition hover:text-[#167354]"><ArrowLeft size={16} />All PGs</Link><Link href="/" className="text-sm font-semibold tracking-tight text-[#24332b]">pg<span className="text-[#167354]">manager</span></Link></div></header>
    <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#167354]">PG details</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[#17241f] sm:text-4xl">{property.name}</h1><p className="mt-3 flex items-start gap-2 text-sm leading-6 text-[#718078]"><MapPin size={16} className="mt-1 shrink-0 text-[#167354]" />{fullAddress}</p><p className="mt-2 inline-flex rounded-full bg-[#f2f5f2] px-3 py-1 text-xs font-medium text-[#526058]">{property.gender_policy === "female_only" ? "Female residents only" : property.gender_policy === "male_only" ? "Male residents only" : property.gender_policy === "all_genders" ? "All genders" : "PG type not specified"}</p></div><div className="flex flex-wrap gap-2">{phoneDigits && <><a href={`tel:${property.contact_phone}`} className="inline-flex items-center gap-2 rounded-lg border border-[#dce6de] bg-white px-4 py-2.5 text-sm font-medium text-[#34443a] hover:bg-[#f3f8f4]"><Phone size={15} />Call</a><a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi, I'm interested in ${property.name}.`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#167354] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#105a41]"><MessageCircle size={15} />WhatsApp</a></>}{mapHref && <a href={mapHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#dce6de] bg-white px-4 py-2.5 text-sm font-medium text-[#34443a] hover:bg-[#f3f8f4]"><MapPin size={15} />View map</a>}</div></div>

      <section aria-label="Property photos" className="mt-7"><PropertyImageCarousel images={images} label={property.name} className="h-64 rounded-2xl sm:h-[440px]" /></section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <div className="space-y-5">
          <article className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#24332b]">About this PG</h2><p className="mt-1 text-sm text-[#718078]">A closer look at the place and what it offers.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#eff7f1] px-3 py-1.5 text-sm font-medium text-[#26714f]"><BedDouble size={15} />{openBedCount} {openBedCount === 1 ? "bed" : "beds"} open</span></div><p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#58685e]">{property.public_description || "The owner has not added a description yet."}</p>
            <h3 className="mt-6 text-sm font-semibold text-[#34443a]">Amenities</h3>{property.amenities?.length ? <div className="mt-3 flex flex-wrap gap-2">{property.amenities.map((amenity: string) => <span key={amenity} className="inline-flex items-center gap-1.5 rounded-full border border-[#e4ebe5] bg-[#fbfcfb] px-3 py-1.5 text-xs text-[#526058]"><Check size={13} className="text-[#167354]" />{amenity}</span>)}</div> : <p className="mt-2 text-sm text-[#718078]">Amenities have not been listed.</p>}
          </article>

          <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#24332b]">Resident feedback</h2><p className="mt-1 text-sm text-[#718078]">Reviews from verified current and former residents.</p></div>{averageRating !== null && <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff8e8] px-3 py-1.5 text-sm font-semibold text-[#795c20]"><Star size={15} className="fill-[#e4a93b] text-[#e4a93b]" />{averageRating.toFixed(1)}<span className="font-normal text-[#8a7b57]">({reviews.length})</span></div>}</div>
            {reviews.length ? <div className="mt-4 divide-y divide-[#edf0ed]">{reviews.map((review) => <article key={review.id} className="py-4 first:pt-1"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} className={star <= Number(review.rating) ? "fill-[#e4a93b] text-[#e4a93b]" : "text-[#d4ddd6]"} />)}<span className="ml-2 text-xs font-medium text-[#526058]">Verified resident</span></div><time className="text-xs text-[#89948d]">{new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#58685e]">{review.feedback}</p></article>)}</div> : <p className="mt-4 rounded-xl bg-[#f7faf7] p-4 text-sm text-[#718078]">No feedback has been shared yet.</p>}
            {resident ? <PropertyReviewForm propertyId={property.id} ownerId={resident.owner_id} studentId={resident.id} /> : <p className="mt-5 rounded-xl border border-[#e4ebe5] bg-[#fbfcfb] p-4 text-sm text-[#718078]">A verified resident account is needed to leave feedback. <Link href={`/student/login?next=${encodeURIComponent(`/pg/${property.id}`)}`} className="font-medium text-[#167354] hover:underline">Resident sign in</Link></p>}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-[#e4ebe5] bg-white p-5 sm:p-6 lg:sticky lg:top-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#167354]">Availability</p><p className="mt-3 text-3xl font-semibold tracking-tight text-[#24332b]">{openBedCount}</p><p className="mt-1 text-sm text-[#718078]">open {openBedCount === 1 ? "bed" : "beds"}</p>{phoneDigits && <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi, I'm interested in ${property.name}.`)}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#167354] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#105a41]"><MessageCircle size={16} />Ask about a bed</a>}<p className="mt-3 text-center text-xs text-[#89948d]">Availability is provided by the property owner.</p>
          <div className="mt-6 border-t border-[#edf0ed] pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[.12em] text-[#167354]">More nearby PGs</h3>
            <div className="mt-3 space-y-3">
              {nearbySuggestions.length ? nearbySuggestions.map((item) => (
                <Link key={item.id} href={`/pg/${item.id}`} className="group block rounded-xl border border-[#e4ebe5] bg-[#fbfcfb] p-2.5 transition hover:border-[#bbd9c7] hover:bg-white">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-[#edf2ee]">
                      {nearbySuggestionImageMap.get(item.id) ? <img src={nearbySuggestionImageMap.get(item.id)} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#a5b3aa]"><BedDouble size={18} /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#24332b] group-hover:text-[#167354]">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#718078]">{[item.locality, item.city].filter(Boolean).join(", ")}</p>
                      <p className="mt-1 text-xs font-medium text-[#26714f]">{item.openBedCount} {item.openBedCount === 1 ? "bed" : "beds"} open</p>
                    </div>
                  </div>
                </Link>
              )) : <p className="text-sm text-[#718078]">No nearby open PGs right now.</p>}
            </div>
          </div>
        </aside>
      </section>
    </div>
  </main>;
}

function RoomCard({ room, openBeds }: { room: RoomListing; openBeds: number }) {
  return <article className="rounded-xl border border-[#e4ebe5] bg-[#fcfdfc] p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-[#34443a]">Room {room.room_number}</h4><p className="mt-1 text-xs capitalize text-[#718078]">{room.room_type.replaceAll("_", " ")} · {room.capacity} {room.capacity === 1 ? "bed" : "beds"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${openBeds ? "bg-[#eff7f1] text-[#26714f]" : "bg-[#f0f1f2] text-[#687078]"}`}>{openBeds} open</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0ed] pt-3"><span className="text-sm font-semibold text-[#24332b]">{money(room.monthly_rent_paise)}</span><span className="flex items-center gap-1 text-xs text-[#718078]">{room.has_ac && <><Snowflake size={13} />AC · </>}{room.bathroom_type.replaceAll("_", " ")} bathroom</span></div>{room.amenities?.length > 0 && <p className="mt-2 text-xs text-[#718078]">{room.amenities.join(" · ")}</p>}</article>;
}
