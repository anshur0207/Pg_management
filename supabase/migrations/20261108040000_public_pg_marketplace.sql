begin;

alter table public.properties add column if not exists public_description text;

create policy property_public_marketplace_read on public.properties
  for select to anon
  using (status = 'active' and marketplace_enabled);
revoke all on public.properties from anon;
grant select (id, name, address, locality, city, state, pin_code, maps_url, contact_phone, amenities, image_paths, floor_count, public_description, marketplace_enabled, latitude, longitude, status)
  on public.properties to anon;

create policy floor_public_marketplace_read on public.floors
  for select to anon
  using (exists (
    select 1 from public.properties p
    where p.id = floors.property_id and p.status = 'active' and p.marketplace_enabled
  ));
revoke all on public.floors from anon;
grant select (id, property_id, name, floor_number) on public.floors to anon;

create policy room_public_marketplace_read on public.rooms
  for select to anon
  using (status = 'active' and exists (
    select 1 from public.properties p
    where p.id = rooms.property_id and p.status = 'active' and p.marketplace_enabled
  ));
revoke all on public.rooms from anon;
grant select (id, property_id, floor_id, room_number, room_type, capacity, has_ac, bathroom_type, monthly_rent_paise, amenities, status)
  on public.rooms to anon;

create policy bed_public_marketplace_read on public.beds
  for select to anon
  using (status = 'available' and exists (
    select 1 from public.rooms r
    join public.properties p on p.id = r.property_id
    where r.id = beds.room_id and r.status = 'active'
      and p.status = 'active' and p.marketplace_enabled
  ));
revoke all on public.beds from anon;
grant select (id, room_id, bed_number, status) on public.beds to anon;

create table public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  student_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  feedback text not null check (char_length(trim(feedback)) between 5 and 2000),
  status text not null default 'published' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete cascade,
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete cascade,
  unique (property_id, student_id)
);

alter table public.property_reviews enable row level security;
create policy property_review_public_read on public.property_reviews
  for select to anon, authenticated
  using (status = 'published' and exists (
    select 1 from public.properties p
    where p.id = property_reviews.property_id and p.status = 'active' and p.marketplace_enabled
  ));
create policy property_review_owner_access on public.property_reviews
  for all to authenticated
  using (public.has_owner_access(owner_id))
  with check (public.has_owner_access(owner_id));
create policy property_review_student_create on public.property_reviews
  for insert to authenticated
  with check (
    status = 'published'
    and public.owns_student(student_id)
    and exists (
      select 1 from public.students s
      where s.id = property_reviews.student_id
        and s.owner_id = property_reviews.owner_id
        and s.property_id = property_reviews.property_id
    )
    and exists (
      select 1 from public.properties p
      where p.id = property_reviews.property_id
        and p.owner_id = property_reviews.owner_id
        and p.status = 'active'
        and p.marketplace_enabled
    )
    and exists (
      select 1 from public.occupancies o
      where o.owner_id = property_reviews.owner_id
        and o.student_id = property_reviews.student_id
        and o.status in ('active', 'completed')
    )
  );
revoke all on public.property_reviews from anon;
revoke all on public.property_reviews from authenticated;
grant select (id, property_id, rating, feedback, status, created_at) on public.property_reviews to anon;
grant select, update, delete on public.property_reviews to authenticated;
grant insert (owner_id, property_id, student_id, rating, feedback) on public.property_reviews to authenticated;

create or replace function public.can_view_marketplace_property_image(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    join public.properties p on p.id = d.property_id and p.owner_id = d.owner_id
    where d.storage_path = target_path
      and d.document_type = 'photograph'
      and p.status = 'active'
      and p.marketplace_enabled
      and target_path = any(p.image_paths)
  );
$$;
grant execute on function public.can_view_marketplace_property_image(text) to anon, authenticated;
grant select on storage.objects to anon;
create policy pg_documents_public_marketplace_image_read on storage.objects
  for select to anon
  using (bucket_id = 'pg-documents' and public.can_view_marketplace_property_image(name));

commit;
