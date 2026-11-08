begin;

-- Expose email verification state to the owning PG only. Auth user records are
-- never granted directly to browser clients.
create or replace function public.owner_list_residents()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  property_id uuid,
  monthly_rent_paise bigint,
  status text,
  email_verified boolean,
  invitation_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.full_name,
    s.email,
    s.phone,
    s.property_id,
    s.monthly_rent_paise,
    s.status,
    coalesce(u.email_confirmed_at is not null, false) as email_verified,
    invitation.expires_at as invitation_expires_at
  from public.students s
  left join auth.users u on u.id = s.auth_user_id
  left join lateral (
    select i.expires_at
    from public.student_invitations i
    where i.student_id = s.id
      and i.accepted_at is null
      and i.expires_at > now()
    order by i.created_at desc
    limit 1
  ) invitation on true
  where public.has_owner_access(s.owner_id)
  order by s.full_name;
$$;

revoke all on function public.owner_list_residents() from public, anon;
grant execute on function public.owner_list_residents() to authenticated;

commit;
