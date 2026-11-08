begin;

create or replace function public.owner_delete_empty_property(target_property_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
begin
  select p.owner_id into target_owner_id
  from public.properties p
  where p.id = target_property_id
  for update;

  if target_owner_id is null or not public.has_owner_access(target_owner_id) then
    raise exception 'Property not found or access denied';
  end if;

  if exists (select 1 from public.students s where s.owner_id = target_owner_id and s.property_id = target_property_id)
    or exists (select 1 from public.invoices i where i.owner_id = target_owner_id and i.property_id = target_property_id)
    or exists (select 1 from public.tickets t where t.owner_id = target_owner_id and t.property_id = target_property_id)
    or exists (select 1 from public.expenses e where e.owner_id = target_owner_id and e.property_id = target_property_id)
    or exists (select 1 from public.staff_tasks st where st.owner_id = target_owner_id and st.property_id = target_property_id)
    or exists (select 1 from public.visitors v where v.owner_id = target_owner_id and v.property_id = target_property_id)
    or exists (select 1 from public.food_menus fm where fm.owner_id = target_owner_id and fm.property_id = target_property_id)
    or exists (select 1 from public.documents d where d.owner_id = target_owner_id and d.property_id = target_property_id)
    or exists (select 1 from public.announcements a where a.owner_id = target_owner_id and a.property_id = target_property_id)
    or exists (select 1 from public.marketplace_listings ml where ml.owner_id = target_owner_id and ml.property_id = target_property_id)
    or exists (select 1 from public.rental_agreements ra where ra.owner_id = target_owner_id and ra.property_id = target_property_id)
    or exists (select 1 from public.weekly_meal_menus wm where wm.owner_id = target_owner_id and wm.property_id = target_property_id)
    or exists (
      select 1 from public.occupancies o
      join public.beds b on b.id = o.bed_id
      join public.rooms r on r.id = b.room_id
      where r.owner_id = target_owner_id and r.property_id = target_property_id
    )
    or exists (
      select 1 from public.reservations rs
      join public.beds b on b.id = rs.bed_id
      join public.rooms r on r.id = b.room_id
      where r.owner_id = target_owner_id and r.property_id = target_property_id
    ) then
    raise exception 'This property has resident, billing, or activity records. Archive it to preserve that history.';
  end if;

  delete from public.property_staff ps
  where ps.owner_id = target_owner_id and ps.property_id = target_property_id;

  delete from public.beds b
  using public.rooms r
  where b.room_id = r.id and r.owner_id = target_owner_id and r.property_id = target_property_id;

  delete from public.rooms r
  where r.owner_id = target_owner_id and r.property_id = target_property_id;

  delete from public.floors f
  where f.owner_id = target_owner_id and f.property_id = target_property_id;

  delete from public.properties p
  where p.owner_id = target_owner_id and p.id = target_property_id;
end;
$$;

revoke all on function public.owner_delete_empty_property(uuid) from public, anon;
grant execute on function public.owner_delete_empty_property(uuid) to authenticated;

commit;
