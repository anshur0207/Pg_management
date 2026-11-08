begin;

create or replace function public.create_owner_floor(
  target_property_id uuid,
  target_floor_name text,
  target_floor_number integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
  created_floor_id uuid;
begin
  select p.owner_id into target_owner_id
  from public.properties p
  where p.id = target_property_id
    and p.status = 'active'
    and public.has_owner_access(p.owner_id);

  if target_owner_id is null then
    raise exception 'Property not found or access denied';
  end if;
  if nullif(btrim(target_floor_name), '') is null then
    raise exception 'Floor name is required';
  end if;
  if target_floor_number is not null and target_floor_number < 0 then
    raise exception 'Floor number cannot be negative';
  end if;

  insert into public.floors(owner_id, property_id, name, floor_number)
  values (target_owner_id, target_property_id, btrim(target_floor_name), target_floor_number)
  returning id into created_floor_id;

  update public.properties p
  set floor_count = (select count(*)::integer from public.floors f where f.property_id = p.id)
  where p.id = target_property_id;

  return created_floor_id;
end;
$$;

create or replace function public.create_owner_room(
  target_property_id uuid,
  target_floor_id uuid,
  target_room_number text,
  target_capacity integer,
  target_monthly_rent_paise bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
  created_room_id uuid;
  bed_index integer;
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
  if nullif(btrim(target_room_number), '') is null then
    raise exception 'Room number is required';
  end if;
  if target_capacity is null or target_capacity < 1 or target_capacity > 100 then
    raise exception 'Room capacity must be between 1 and 100';
  end if;
  if target_monthly_rent_paise is not null and target_monthly_rent_paise < 0 then
    raise exception 'Monthly rent cannot be negative';
  end if;

  insert into public.rooms(owner_id, property_id, floor_id, room_number, capacity, monthly_rent_paise)
  values (target_owner_id, target_property_id, target_floor_id, btrim(target_room_number), target_capacity, target_monthly_rent_paise)
  returning id into created_room_id;

  for bed_index in 1..target_capacity loop
    insert into public.beds(owner_id, room_id, bed_number, status)
    values (target_owner_id, created_room_id, 'B' || bed_index::text, 'available');
  end loop;

  return created_room_id;
end;
$$;

create or replace function public.assign_student_to_bed(
  target_student_id uuid,
  target_bed_id uuid,
  target_check_in date default current_date,
  target_monthly_rent_paise bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resident public.students%rowtype;
  target_bed public.beds%rowtype;
  target_room public.rooms%rowtype;
  active_occupancy public.occupancies%rowtype;
  assigned_rent bigint;
  created_occupancy_id uuid;
begin
  select * into resident
  from public.students s
  where s.id = target_student_id
    and public.has_owner_access(s.owner_id)
  for update;

  if not found then
    raise exception 'Resident not found or access denied';
  end if;
  if resident.status in ('inactive', 'checked_out') or resident.archived_at is not null then
    raise exception 'Past residents cannot be assigned a bed';
  end if;

  select b.* into target_bed
  from public.beds b
  where b.id = target_bed_id and b.owner_id = resident.owner_id
  for update;
  if not found then
    raise exception 'Bed not found or access denied';
  end if;

  select r.* into target_room
  from public.rooms r
  where r.id = target_bed.room_id
    and r.owner_id = resident.owner_id
    and r.status = 'active'
    and exists (select 1 from public.properties p where p.id = r.property_id and p.status = 'active');
  if not found then
    raise exception 'Room is not active';
  end if;

  select o.* into active_occupancy
  from public.occupancies o
  where o.student_id = resident.id
    and o.status = 'active'
    and o.checked_out_at is null
  for update;

  if target_bed.status <> 'available' and (active_occupancy.id is null or active_occupancy.bed_id <> target_bed.id) then
    raise exception 'This bed is not vacant';
  end if;

  if exists (
    select 1 from public.occupancies o
    where o.bed_id = target_bed.id
      and o.status = 'active'
      and o.checked_out_at is null
      and o.student_id <> resident.id
  ) then
    raise exception 'This bed is already occupied';
  end if;

  assigned_rent := coalesce(target_monthly_rent_paise, target_room.monthly_rent_paise, resident.monthly_rent_paise);
  if assigned_rent < 0 then
    raise exception 'Monthly rent cannot be negative';
  end if;

  if active_occupancy.id is not null and active_occupancy.bed_id = target_bed.id then
    update public.occupancies
    set monthly_rent_paise = assigned_rent
    where id = active_occupancy.id;
    update public.students
    set monthly_rent_paise = assigned_rent, property_id = target_room.property_id
    where id = resident.id;
    update public.beds
    set status = 'occupied'
    where id = target_bed.id;
    return active_occupancy.id;
  end if;

  if active_occupancy.id is not null then
    update public.occupancies
    set status = 'completed', checked_out_at = now()
    where id = active_occupancy.id;
    update public.beds
    set status = 'available'
    where id = active_occupancy.bed_id
      and not exists (
        select 1 from public.occupancies o
        where o.bed_id = public.beds.id and o.status = 'active' and o.checked_out_at is null
      );
  end if;

  insert into public.occupancies(owner_id, student_id, bed_id, check_in, monthly_rent_paise, created_by)
  values (resident.owner_id, resident.id, target_bed.id, coalesce(target_check_in, current_date), assigned_rent, auth.uid())
  returning id into created_occupancy_id;

  update public.beds set status = 'occupied' where id = target_bed.id;
  update public.students set monthly_rent_paise = assigned_rent, property_id = target_room.property_id where id = resident.id;
  return created_occupancy_id;
end;
$$;

revoke all on function public.create_owner_floor(uuid, text, integer) from public, anon;
revoke all on function public.create_owner_room(uuid, uuid, text, integer, bigint) from public, anon;
revoke all on function public.assign_student_to_bed(uuid, uuid, date, bigint) from public, anon;
grant execute on function public.create_owner_floor(uuid, text, integer) to authenticated;
grant execute on function public.create_owner_room(uuid, uuid, text, integer, bigint) to authenticated;
grant execute on function public.assign_student_to_bed(uuid, uuid, date, bigint) to authenticated;

commit;
