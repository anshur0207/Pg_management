begin;

alter table public.notice_requests
  add column if not exists expected_deposit_refund_paise bigint not null default 0
  check (expected_deposit_refund_paise >= 0);

with duplicate_open_notices as (
  select ctid, row_number() over (partition by student_id order by submitted_at desc, id desc) as position
  from public.notice_requests
  where status in ('pending', 'approved')
)
update public.notice_requests n
set status = 'rejected', owner_response = coalesce(n.owner_response, 'Closed as duplicate during exit request setup.'), reviewed_at = now()
from duplicate_open_notices d
where n.ctid = d.ctid and d.position > 1;

create unique index if not exists notice_requests_one_open_per_student
  on public.notice_requests(student_id)
  where status in ('pending', 'approved');

-- Residents must use the validated RPC; do not allow direct writes to review fields.
drop policy if exists notice_create_own on public.notice_requests;
revoke insert on public.notice_requests from authenticated;

grant execute on function public.owns_student(uuid) to authenticated;

create or replace function public.resident_request_exit_notice(
  target_expected_checkout date,
  target_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resident public.students%rowtype;
  active_stay public.occupancies%rowtype;
  created_notice_id uuid;
  estimated_refund bigint;
begin
  select s.* into resident
  from public.students s
  where s.auth_user_id = auth.uid()
    and s.status not in ('inactive', 'checked_out')
    and s.archived_at is null
  for update;
  if not found then raise exception 'Current resident profile not found'; end if;
  if target_expected_checkout < current_date then raise exception 'Leaving date cannot be in the past'; end if;

  select o.* into active_stay
  from public.occupancies o
  where o.student_id = resident.id and o.status = 'active' and o.checked_out_at is null
  order by o.check_in desc
  limit 1
  for update;
  if not found then raise exception 'An active stay is required to submit an exit request'; end if;

  if exists (select 1 from public.notice_requests n where n.student_id = resident.id and n.status in ('pending', 'approved')) then
    raise exception 'You already have an exit request awaiting resolution';
  end if;

  estimated_refund := floor(resident.security_deposit_paise::numeric / 2)::bigint;
  insert into public.notice_requests(
    owner_id, student_id, expected_checkout, reason, status, expected_deposit_refund_paise
  ) values (
    resident.owner_id, resident.id, target_expected_checkout, nullif(btrim(target_reason), ''), 'pending', estimated_refund
  ) returning id into created_notice_id;

  if resident.status = 'active' then
    update public.students set status = 'notice_period' where id = resident.id;
  end if;
  return created_notice_id;
end;
$$;

create or replace function public.owner_review_exit_notice(
  target_notice_id uuid,
  target_decision text,
  target_response text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  notice_row public.notice_requests%rowtype;
begin
  if target_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select n.* into notice_row from public.notice_requests n where n.id = target_notice_id for update;
  if not found or not public.has_owner_access(notice_row.owner_id) then raise exception 'Notice request not found or access denied'; end if;
  if notice_row.status <> 'pending' then raise exception 'Only pending notice requests can be reviewed'; end if;

  update public.notice_requests
  set status = target_decision,
      owner_response = nullif(btrim(target_response), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = notice_row.id;

  if target_decision = 'approved' then
    update public.students set status = 'checkout_pending'
    where id = notice_row.student_id and status = 'notice_period';
  else
    update public.students set status = 'active'
    where id = notice_row.student_id and status = 'notice_period';
  end if;
end;
$$;

revoke all on function public.resident_request_exit_notice(date, text) from public, anon;
revoke all on function public.owner_review_exit_notice(uuid, text, text) from public, anon;
grant execute on function public.resident_request_exit_notice(date, text) to authenticated;
grant execute on function public.owner_review_exit_notice(uuid, text, text) to authenticated;

commit;
