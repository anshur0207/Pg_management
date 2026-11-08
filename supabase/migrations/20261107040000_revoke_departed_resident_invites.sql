begin;

create or replace function public.expire_departed_student_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('inactive', 'checked_out') then
    update public.student_invitations
    set expires_at = least(expires_at, now())
    where student_id = new.id
      and accepted_at is null
      and expires_at > now();
  end if;
  return new;
end;
$$;

revoke all on function public.expire_departed_student_invitations() from public, anon, authenticated;

drop trigger if exists expire_invites_when_student_leaves on public.students;
create trigger expire_invites_when_student_leaves
  after update of status on public.students
  for each row
  when (new.status in ('inactive', 'checked_out'))
  execute function public.expire_departed_student_invitations();

commit;
