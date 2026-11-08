begin;

create table public.student_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index student_invitations_student_pending
  on public.student_invitations(student_id, expires_at desc)
  where accepted_at is null;

alter table public.student_invitations enable row level security;
revoke all on public.student_invitations from anon, authenticated;

create or replace function public.create_student_invitation(
  target_property_id uuid,
  target_full_name text,
  target_email text,
  target_phone text
)
returns table(student_id uuid, invite_token text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_row public.properties%rowtype;
  created_student_id uuid;
  existing_auth_user_id uuid;
  raw_token text;
  token_expiry timestamptz;
begin
  select * into property_row
  from public.properties
  where id = target_property_id;

  if not found or not public.has_owner_access(property_row.owner_id) or property_row.status <> 'active' then
    raise exception 'Property not found or access denied';
  end if;

  if nullif(btrim(target_full_name), '') is null then
    raise exception 'Student name is required';
  end if;

  if target_email is null or target_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid student email is required';
  end if;

  if nullif(btrim(target_phone), '') is null then
    raise exception 'Student phone number is required';
  end if;

  select id, auth_user_id
    into created_student_id, existing_auth_user_id
  from public.students
  where owner_id = property_row.owner_id
    and property_id = property_row.id
    and lower(email) = lower(btrim(target_email))
    and status not in ('checked_out', 'inactive')
  order by created_at desc
  limit 1
  for update;

  if found then
    if existing_auth_user_id is not null then
      raise exception 'This email is already linked to a resident account';
    end if;
    update public.students
    set full_name = btrim(target_full_name), phone = btrim(target_phone)
    where id = created_student_id;
    update public.student_invitations
    set expires_at = now()
    where student_id = created_student_id and accepted_at is null and expires_at > now();
  else
    insert into public.students (owner_id, property_id, full_name, email, phone)
    values (property_row.owner_id, property_row.id, btrim(target_full_name), lower(btrim(target_email)), btrim(target_phone))
    returning id into created_student_id;
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  token_expiry := now() + interval '7 days';

  insert into public.student_invitations (
    owner_id, student_id, invited_email, token_hash, expires_at, created_by
  ) values (
    property_row.owner_id,
    created_student_id,
    lower(btrim(target_email)),
    encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex'),
    token_expiry,
    auth.uid()
  );

  return query select created_student_id, raw_token, token_expiry;
end;
$$;

revoke all on function public.create_student_invitation(uuid, text, text, text) from public, anon;
grant execute on function public.create_student_invitation(uuid, text, text, text) to authenticated;

-- A valid, email-bound invite is the only public signup path that can become a
-- student. Ordinary public signups continue to create PG owner accounts.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
  owner_business_name text;
  invite_token text;
  matched_invite_id uuid;
  matched_student_id uuid;
begin
  invite_token := nullif(btrim(new.raw_user_meta_data ->> 'student_invite_token'), '');

  if invite_token is not null then
    select i.id, i.student_id
      into matched_invite_id, matched_student_id
    from public.student_invitations i
    join public.students s on s.id = i.student_id
    where i.token_hash = encode(extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256'), 'hex')
      and lower(i.invited_email) = lower(coalesce(new.email, ''))
      and i.accepted_at is null
      and i.expires_at > now()
      and s.auth_user_id is null
    for update of i;

    if matched_invite_id is null then
      raise exception 'Student invitation is invalid, expired, or already used';
    end if;

    update public.student_invitations
    set accepted_at = now(), accepted_by = new.id
    where id = matched_invite_id;

    update public.students
    set auth_user_id = new.id,
        email = lower(new.email),
        full_name = coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), full_name),
        phone = coalesce(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), phone)
    where id = matched_student_id;

    assigned_role := 'STUDENT'::public.app_role;
  elsif new.invited_at is not null then
    assigned_role := 'STUDENT'::public.app_role;
  else
    assigned_role := 'PG_OWNER'::public.app_role;
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    assigned_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  if assigned_role = 'PG_OWNER'::public.app_role then
    owner_business_name := coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'business_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'PG Owner'), '@', 1)
    );
    insert into public.owners (user_id, business_name, business_address, phone)
    values (
      new.id,
      owner_business_name,
      nullif(btrim(new.raw_user_meta_data ->> 'business_address'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop policy if exists ticket_create_own on public.tickets;
create policy ticket_create_own on public.tickets for insert to authenticated
with check (
  public.owns_student(student_id)
  and exists (
    select 1 from public.students s
    where s.id = tickets.student_id
      and s.owner_id = tickets.owner_id
      and s.property_id = tickets.property_id
  )
);

commit;
