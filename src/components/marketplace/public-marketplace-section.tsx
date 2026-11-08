import { createPublicClient } from "@/lib/supabase/public-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PublicPropertyListings } from "@/components/marketplace/public-property-listings";

type PublicProperty = {
  id: string;
  name: string;
  address: string;
  locality: string | null;
  city: string;
  state: string;
  pin_code: string | null;
  gender_policy: "female_only" | "male_only" | "all_genders" | "unspecified";
  contact_phone: string | null;
  amenities: string[];
  image_paths: string[];
  public_description: string | null;
};

export async function PublicMarketplaceSection() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createPublicClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, address, locality, city, state, pin_code, gender_policy, contact_phone, amenities, image_paths, public_description")
    .eq("status", "active")
    .eq("marketplace_enabled", true)
    .order("name");

  const listings = (properties ?? []) as PublicProperty[];
  const propertyIds = listings.map((property) => property.id);
  const [{ data: rooms }, { data: reviews }] = propertyIds.length ? await Promise.all([
    supabase.from("rooms").select("id, property_id, monthly_rent_paise").in("property_id", propertyIds).eq("status", "active"),
    supabase.from("property_reviews").select("property_id, rating").in("property_id", propertyIds).eq("status", "published"),
  ]) : [{ data: [] }, { data: [] }];

  const publicRooms = rooms ?? [];
  const roomIds = publicRooms.map((room) => room.id);
  const { data: openBeds } = roomIds.length
    ? await supabase.from("beds").select("id, room_id").in("room_id", roomIds).eq("status", "available")
    : { data: [] };
  const availableCountByRoom = new Map<string, number>();
  for (const bed of openBeds ?? []) availableCountByRoom.set(bed.room_id, (availableCountByRoom.get(bed.room_id) ?? 0) + 1);

  const roomsByProperty = new Map<string, typeof publicRooms>();
  for (const room of publicRooms) roomsByProperty.set(room.property_id, [...(roomsByProperty.get(room.property_id) ?? []), room]);
  const bedsByProperty = new Map<string, number>();
  for (const room of publicRooms) bedsByProperty.set(room.property_id, (bedsByProperty.get(room.property_id) ?? 0) + (availableCountByRoom.get(room.id) ?? 0));
  const reviewsByProperty = new Map<string, number[]>();
  for (const review of reviews ?? []) reviewsByProperty.set(review.property_id, [...(reviewsByProperty.get(review.property_id) ?? []), Number(review.rating)]);

  const photoUrls = await Promise.all(listings.map(async (property) => {
    const signedImages = await Promise.all((property.image_paths ?? []).map(async (path) => {
      const { data } = await supabase.storage.from("pg-documents").createSignedUrl(path, 1800);
      return data?.signedUrl ?? null;
    }));
    return { id: property.id, urls: signedImages.filter((url): url is string => Boolean(url)) };
  }));
  const photoUrlsByProperty = new Map(photoUrls.map(({ id, urls }) => [id, urls]));
  const marketplaceListings = listings.map((property) => {
    const rents = (roomsByProperty.get(property.id) ?? [])
      .filter((room) => (availableCountByRoom.get(room.id) ?? 0) > 0 && room.monthly_rent_paise != null)
      .map((room) => Number(room.monthly_rent_paise))
      .filter(Number.isFinite);
    const ratings = reviewsByProperty.get(property.id) ?? [];
    return {
      ...property,
      photoUrls: photoUrlsByProperty.get(property.id) ?? [],
      openBeds: bedsByProperty.get(property.id) ?? 0,
      startingRentPaise: rents.length ? Math.min(...rents) : null,
      averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
      reviewCount: ratings.length,
    };
  });

  return (
    <section id="pg-listings" className="border-b border-[#edf0ed] bg-white">
      <div className="mx-auto max-w-[1320px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#167354]">Find your next place</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#17241f] sm:text-4xl">PGs with room for you.</h2><p className="mt-3 leading-7 text-[#69776f]">Explore homes, compare monthly rent, and see how many beds are currently open.</p></div>
          <span className="text-sm text-[#718078]">{listings.length} {listings.length === 1 ? "PG listed" : "PGs listed"}</span>
        </div>
        {marketplaceListings.length ? <PublicPropertyListings listings={marketplaceListings} /> : <div className="mt-9 rounded-2xl border border-dashed border-[#dce6de] bg-[#fbfcfb] px-6 py-10 text-center"><p className="text-base font-semibold text-[#34443a]">No PGs are listed yet</p><p className="mt-2 text-sm text-[#718078]">PG owners can publish a property from its details in the owner dashboard.</p></div>}
      </div>
    </section>
  );
}
