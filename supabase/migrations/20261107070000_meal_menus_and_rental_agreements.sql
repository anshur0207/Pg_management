begin;

create table public.rental_agreements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  student_id uuid not null,
  agreement_number text not null,
  monthly_rent_paise bigint not null check (monthly_rent_paise >= 0),
  security_deposit_paise bigint not null default 0 check (security_deposit_paise >= 0),
  starts_on date not null,
  ends_on date,
  premises_address text not null,
  owner_terms text not null,
  status text not null default 'pending_signature' check (status in ('pending_signature', 'signed', 'cancelled')),
  student_signature_name text,
  student_consented_at timestamptz,
  signed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  unique (owner_id, agreement_number),
  check (ends_on is null or ends_on >= starts_on),
  check (
    (status = 'signed' and student_signature_name is not null and student_consented_at is not null and signed_at is not null)
    or (status <> 'signed')
  )
);

create index rental_agreements_student_status on public.rental_agreements(student_id, status, created_at desc);
create index rental_agreements_owner_status on public.rental_agreements(owner_id, status, created_at desc);
alter table public.rental_agreements enable row level security;
create policy agreement_owner_access on public.rental_agreements for all to authenticated
  using (public.has_owner_access(owner_id))
  with check (public.has_owner_access(owner_id));
create policy agreement_student_read_own on public.rental_agreements for select to authenticated
  using (public.owns_student(student_id));
grant select, insert, update on public.rental_agreements to authenticated;
grant all on public.rental_agreements to service_role;

create or replace function public.sign_rental_agreement(target_agreement_id uuid, typed_signature text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_row public.rental_agreements%rowtype;
  resident_name text;
begin
  select a.* into agreement_row
  from public.rental_agreements a
  where a.id = target_agreement_id
    and public.owns_student(a.student_id)
  for update;

  if not found then
    raise exception 'Agreement not found or access denied';
  end if;
  if agreement_row.status <> 'pending_signature' then
    raise exception 'This agreement is no longer waiting for signature';
  end if;
  if nullif(btrim(typed_signature), '') is null then
    raise exception 'Type your full name to sign';
  end if;

  select s.full_name into resident_name
  from public.students s
  where s.id = agreement_row.student_id;

  if lower(btrim(typed_signature)) <> lower(btrim(resident_name)) then
    raise exception 'The typed signature must match your resident profile name';
  end if;

  update public.rental_agreements
  set status = 'signed',
      student_signature_name = btrim(typed_signature),
      student_consented_at = now(),
      signed_at = now()
  where id = target_agreement_id;
end;
$$;

revoke all on function public.sign_rental_agreement(uuid, text) from public, anon;
grant execute on function public.sign_rental_agreement(uuid, text) to authenticated;

create or replace function public.prevent_signed_agreement_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'signed' then
    raise exception 'Signed agreements are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger rental_agreement_immutable_after_sign
before update on public.rental_agreements
for each row execute function public.prevent_signed_agreement_changes();

commit;
