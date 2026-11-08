begin;

create or replace function public.create_owner_floors(
  target_property_id uuid,
  target_floor_prefix text,
  target_count integer,
  target_start_number integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
  floor_index integer;
  created_count integer := 0;
  floor_label text;
begin
  select p.owner_id into target_owner_id
  from public.properties p
  where p.id = target_property_id
    and p.status = 'active'
    and public.has_owner_access(p.owner_id);

  if target_owner_id is null then
    raise exception 'Property not found or access denied';
  end if;
  if nullif(btrim(target_floor_prefix), '') is null then
    raise exception 'Floor name is required';
  end if;
  if target_count is null or target_count < 1 or target_count > 50 then
    raise exception 'Create between 1 and 50 floors at a time';
  end if;
  if target_start_number is null or target_start_number < 0 then
    raise exception 'Starting floor number cannot be negative';
  end if;

  for floor_index in 0..target_count - 1 loop
    floor_label := btrim(target_floor_prefix) || ' ' || (target_start_number + floor_index)::text;
    insert into public.floors(owner_id, property_id, name, floor_number, sort_order)
    values (target_owner_id, target_property_id, floor_label, target_start_number + floor_index, target_start_number + floor_index);
    created_count := created_count + 1;
  end loop;

  update public.properties p
  set floor_count = (select count(*)::integer from public.floors f where f.property_id = p.id)
  where p.id = target_property_id;

  return created_count;
end;
$$;

create or replace function public.create_owner_rooms(
  target_property_id uuid,
  target_floor_id uuid,
  target_room_prefix text,
  target_start_number integer,
  target_count integer,
  target_capacity integer,
  target_monthly_rent_paise bigint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
  room_index integer;
  bed_index integer;
  created_room_id uuid;
  room_label text;
  prefix text := coalesce(btrim(target_room_prefix), '');
begin
  select p.owner_id into target_owner_id
  from public.properties p
  join public.floors f on f.property_id = p.id and f.owner_id = p.owner_id
  where p.id = target_property_id
    and f.id = target_floor_id
    and p.status = 'active'
    and public.has_owner_access(p.owner_id);

  if target_owner_id is null then
    raise exception 'Property or floor not found, or access denied';
  end if;
  if target_start_number is null or target_start_number < 0 then
    raise exception 'Starting room number cannot be negative';
  end if;
  if target_count is null or target_count < 1 or target_count > 50 then
    raise exception 'Create between 1 and 50 rooms at a time';
  end if;
  if target_capacity is null or target_capacity < 1 or target_capacity > 100 then
    raise exception 'Capacity must be between 1 and 100 residents per room';
  end if;
  if target_monthly_rent_paise is not null and target_monthly_rent_paise < 0 then
    raise exception 'Monthly rent cannot be negative';
  end if;

  for room_index in 0..target_count - 1 loop
    room_label := prefix || (target_start_number + room_index)::text;
    insert into public.rooms(owner_id, property_id, floor_id, room_number, capacity, monthly_rent_paise)
    values (target_owner_id, target_property_id, target_floor_id, room_label, target_capacity, target_monthly_rent_paise)
    returning id into created_room_id;

    for bed_index in 1..target_capacity loop
      insert into public.beds(owner_id, room_id, bed_number, status)
      values (target_owner_id, created_room_id, 'B' || bed_index::text, 'available');
    end loop;
  end loop;

  return target_count;
end;
$$;

create or replace function public.delete_owner_bed(target_bed_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bed public.beds%rowtype;
  target_room public.rooms%rowtype;
begin
  select b.* into target_bed
  from public.beds b
  where b.id = target_bed_id
    and public.has_owner_access(b.owner_id)
  for update;
  if not found then
    raise exception 'Bed not found or access denied';
  end if;

  select r.* into target_room from public.rooms r where r.id = target_bed.room_id for update;
  if target_room.capacity <= 1 then
    raise exception 'A room must keep at least one bed; delete the room instead';
  end if;
  if target_bed.status in ('occupied', 'reserved')
     or exists (select 1 from public.occupancies o where o.bed_id = target_bed.id)
     or exists (select 1 from public.reservations r where r.bed_id = target_bed.id) then
    raise exception 'This bed has an active or historical resident/reservation record and cannot be deleted';
  end if;

  delete from public.beds where id = target_bed.id;
  update public.rooms set capacity = capacity - 1 where id = target_room.id;
end;
$$;

create or replace function public.delete_owner_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
begin
  select r.* into target_room
  from public.rooms r
  where r.id = target_room_id
    and public.has_owner_access(r.owner_id)
  for update;
  if not found then
    raise exception 'Room not found or access denied';
  end if;

  if exists (
    select 1
    from public.beds b
    where b.room_id = target_room.id
      and (b.status in ('occupied', 'reserved')
        or exists (select 1 from public.occupancies o where o.bed_id = b.id)
        or exists (select 1 from public.reservations rs where rs.bed_id = b.id))
  ) then
    raise exception 'This room has current or historical occupancy/reservations and cannot be deleted';
  end if;

  delete from public.beds where room_id = target_room.id;
  delete from public.rooms where id = target_room.id;
end;
$$;

create or replace function public.delete_owner_floor(target_floor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_floor public.floors%rowtype;
begin
  select f.* into target_floor
  from public.floors f
  where f.id = target_floor_id
    and public.has_owner_access(f.owner_id)
  for update;
  if not found then
    raise exception 'Floor not found or access denied';
  end if;

  if exists (
    select 1
    from public.rooms r
    join public.beds b on b.room_id = r.id
    where r.floor_id = target_floor.id
      and (b.status in ('occupied', 'reserved')
        or exists (select 1 from public.occupancies o where o.bed_id = b.id)
        or exists (select 1 from public.reservations rs where rs.bed_id = b.id))
  ) then
    raise exception 'This floor contains rooms with current or historical occupancy/reservations and cannot be deleted';
  end if;

  delete from public.beds b using public.rooms r
  where b.room_id = r.id and r.floor_id = target_floor.id;
  delete from public.rooms where floor_id = target_floor.id;
  delete from public.floors where id = target_floor.id;
  update public.properties p
  set floor_count = (select count(*)::integer from public.floors f where f.property_id = p.id)
  where p.id = target_floor.property_id;
end;
$$;

revoke all on function public.create_owner_floors(uuid, text, integer, integer) from public, anon;
revoke all on function public.create_owner_rooms(uuid, uuid, text, integer, integer, integer, bigint) from public, anon;
revoke all on function public.delete_owner_bed(uuid) from public, anon;
revoke all on function public.delete_owner_room(uuid) from public, anon;
revoke all on function public.delete_owner_floor(uuid) from public, anon;
grant execute on function public.create_owner_floors(uuid, text, integer, integer) to authenticated;
grant execute on function public.create_owner_rooms(uuid, uuid, text, integer, integer, integer, bigint) to authenticated;
grant execute on function public.delete_owner_bed(uuid) to authenticated;
grant execute on function public.delete_owner_room(uuid) to authenticated;
grant execute on function public.delete_owner_floor(uuid) to authenticated;

commit;
