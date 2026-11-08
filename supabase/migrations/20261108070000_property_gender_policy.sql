begin;

alter table public.properties
  add column if not exists gender_policy text not null default 'unspecified'
  check (gender_policy in ('female_only', 'male_only', 'all_genders', 'unspecified'));

-- Keep public policy values readable while preserving private resident gender data.
grant select (gender_policy) on public.properties to anon;
grant select (gender_policy) on public.properties to authenticated;

commit;
