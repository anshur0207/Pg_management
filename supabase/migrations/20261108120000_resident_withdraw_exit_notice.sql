begin;

create or replace function public.resident_withdraw_exit_notice(target_notice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  resident public.students%rowtype;
  notice_row public.notice_requests%rowtype;
begin
  select s.* into resident
  from public.students s
  where s.auth_user_id = auth.uid()
    and s.status not in ('inactive', 'checked_out')
    and s.archived_at is null
  for update;
  if not found then raise exception 'Current resident profile not found'; end if;

  select n.* into notice_row
  from public.notice_requests n
  where n.id = target_notice_id and n.student_id = resident.id and n.owner_id = resident.owner_id
  for update;
  if not found then raise exception 'Exit request not found'; end if;
  if notice_row.status not in ('pending', 'approved') then raise exception 'This exit request can no longer be withdrawn'; end if;

  if exists (
    select 1 from public.checkout_records c
    where c.student_id = resident.id and c.actual_checkout_at is not null
  ) then
    raise exception 'Checkout has already been completed. Contact your PG owner for help.';
  end if;

  update public.notice_requests
  set status = 'withdrawn',
      owner_response = 'Withdrawn by resident',
      reviewed_at = now()
  where id = notice_row.id;

  if resident.status in ('notice_period', 'checkout_pending') then
    update public.students set status = 'active' where id = resident.id;
  end if;
end;
$$;

revoke all on function public.resident_withdraw_exit_notice(uuid) from public, anon;
grant execute on function public.resident_withdraw_exit_notice(uuid) to authenticated;

commit;
