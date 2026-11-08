begin;

-- Backfill any legacy property records created before the layout workflow was enforced.
-- Each property without a room gets one default floor and one single-bed room so the
-- dashboard and public PG listings do not show zero availability.
do $$
declare
  property_row record;
  floor_id uuid;
begin
  for property_row in
    select p.id, p.owner_id
    from public.properties p
    left join public.rooms r on r.property_id = p.id
    where r.id is null
      and p.status = 'active'
  loop
    insert into public.floors(owner_id, property_id, name, floor_number, sort_order)
    values (property_row.owner_id, property_row.id, 'Ground Floor', 1, 1)
    returning id into floor_id;

    insert into public.rooms(owner_id, property_id, floor_id, room_number, capacity, monthly_rent_paise, status)
    values (property_row.owner_id, property_row.id, floor_id, '101', 1, null, 'active');

    insert into public.beds(owner_id, room_id, bed_number, status)
    values (property_row.owner_id, (select r.id from public.rooms r where r.property_id = property_row.id and r.room_number = '101' limit 1), 'B1', 'available');
  end loop;
end $$;

commit;
