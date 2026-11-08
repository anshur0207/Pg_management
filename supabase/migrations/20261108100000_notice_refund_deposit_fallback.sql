begin;

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
  deposit_basis bigint;
  ledger_count bigint;
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

  select count(*), coalesce(sum(greatest(d.amount_paise - d.refunded_paise, 0)), 0)
    into ledger_count, deposit_basis
  from public.security_deposits d
  where d.student_id = resident.id and d.owner_id = resident.owner_id;

  if ledger_count = 0 then
    select coalesce(
      nullif(resident.security_deposit_paise, 0),
      (select a.security_deposit_paise from public.rental_agreements a
       where a.student_id = resident.id and a.owner_id = resident.owner_id and a.status = 'signed'
       order by a.signed_at desc nulls last, a.created_at desc limit 1),
      0
    ) into deposit_basis;
  end if;

  insert into public.notice_requests(
    owner_id, student_id, expected_checkout, reason, status, expected_deposit_refund_paise
  ) values (
    resident.owner_id, resident.id, target_expected_checkout, nullif(btrim(target_reason), ''), 'pending',
    floor(greatest(deposit_basis, 0)::numeric / 2)::bigint
  ) returning id into created_notice_id;

  if resident.status = 'active' then
    update public.students set status = 'notice_period' where id = resident.id;
  end if;
  return created_notice_id;
end;
$$;

revoke all on function public.resident_request_exit_notice(date, text) from public, anon;
grant execute on function public.resident_request_exit_notice(date, text) to authenticated;

commit;
