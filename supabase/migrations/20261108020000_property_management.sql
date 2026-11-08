begin;

alter table public.properties
  add column if not exists maps_url text,
  add column if not exists manager_name text,
  add column if not exists manager_phone text;

create table if not exists public.property_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  check_in_time time not null default '14:00',
  check_out_time time not null default '11:00',
  visitor_policy text not null default '',
  house_rules text not null default '',
  emergency_contact text,
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete cascade,
  unique (property_id)
);

create table if not exists public.property_staff_directory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  full_name text not null,
  role text not null,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete cascade
);

alter table public.property_settings enable row level security;
create policy property_settings_owner_access on public.property_settings
  for all to authenticated using (public.has_owner_access(owner_id))
  with check (public.has_owner_access(owner_id));
grant select, insert, update, delete on public.property_settings to authenticated;

alter table public.property_staff_directory enable row level security;
create policy property_staff_directory_owner_access on public.property_staff_directory
  for all to authenticated using (public.has_owner_access(owner_id))
  with check (public.has_owner_access(owner_id));
grant select, insert, update, delete on public.property_staff_directory to authenticated;

commit;
