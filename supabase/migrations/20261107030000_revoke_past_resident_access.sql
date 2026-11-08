begin;

-- Keep former residents' records for the owner, but remove their resident access
-- to property data, invoices, payments, tickets, documents, and notices.
create or replace function public.owns_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.auth_user_id = auth.uid()
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
  );
$$;

create or replace function public.owns_ticket(target_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.tickets t
    join public.students s on s.id = t.student_id
    where t.id = target_ticket_id
      and public.owns_student(s.id)
  );
$$;

drop policy if exists property_read_current_student on public.properties;
create policy property_read_current_student on public.properties for select to authenticated using (
  exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid()
      and s.property_id = properties.id
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
  )
);

drop policy if exists floor_read_current_student on public.floors;
create policy floor_read_current_student on public.floors for select to authenticated using (
  exists (
    select 1 from public.students s
    join public.occupancies o on o.student_id = s.id and o.status = 'active' and o.checked_out_at is null
    join public.beds b on b.id = o.bed_id
    join public.rooms r on r.id = b.room_id
    where s.auth_user_id = auth.uid()
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
      and r.floor_id = floors.id
  )
);

drop policy if exists room_read_current_student on public.rooms;
create policy room_read_current_student on public.rooms for select to authenticated using (
  exists (
    select 1 from public.students s
    join public.occupancies o on o.student_id = s.id and o.status = 'active' and o.checked_out_at is null
    join public.beds b on b.id = o.bed_id
    where s.auth_user_id = auth.uid()
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
      and b.room_id = rooms.id
  )
);

drop policy if exists announcement_read_student on public.announcements;
create policy announcement_read_student on public.announcements for select to authenticated using (
  status = 'published'
  and publish_at <= now()
  and (expires_at is null or expires_at > now())
  and exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid()
      and s.owner_id = announcements.owner_id
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
      and (announcements.property_id is null or announcements.property_id = s.property_id)
  )
);

drop policy if exists food_menu_read_student on public.food_menus;
create policy food_menu_read_student on public.food_menus for select to authenticated using (
  exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid()
      and s.owner_id = food_menus.owner_id
      and s.property_id = food_menus.property_id
      and s.status not in ('inactive', 'checked_out')
      and s.archived_at is null
  )
);

commit;
