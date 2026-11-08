begin;

create table public.weekly_meal_menus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- Monday=1, Sunday=7
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'sweets')),
  week_of_month smallint not null default 0,
  items text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  check (
    (meal_type = 'sweets' and day_of_week = 7 and week_of_month between 1 and 5)
    or (meal_type <> 'sweets' and week_of_month = 0)
  )
);

create unique index weekly_meal_menus_unique_slot
  on public.weekly_meal_menus(property_id, day_of_week, meal_type, week_of_month);
create index weekly_meals_property_day on public.weekly_meal_menus(property_id, day_of_week);

alter table public.weekly_meal_menus enable row level security;
create policy weekly_meal_owner_access on public.weekly_meal_menus for all to authenticated
  using (public.has_owner_access(owner_id))
  with check (public.has_owner_access(owner_id));
create policy weekly_meal_student_read on public.weekly_meal_menus for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.auth_user_id = auth.uid()
        and s.owner_id = weekly_meal_menus.owner_id
        and s.property_id = weekly_meal_menus.property_id
        and s.status not in ('inactive', 'checked_out')
        and s.archived_at is null
    )
  );
grant select, insert, update, delete on public.weekly_meal_menus to authenticated;
grant all on public.weekly_meal_menus to service_role;
create trigger set_updated_at_weekly_meal_menus
  before update on public.weekly_meal_menus
  for each row execute function public.set_updated_at();

commit;
