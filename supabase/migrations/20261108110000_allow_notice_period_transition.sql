begin;

create or replace function public.protect_student_self_service_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and old.auth_user_id = auth.uid() then
    if new.owner_id is distinct from old.owner_id
      or new.auth_user_id is distinct from old.auth_user_id
      or new.property_id is distinct from old.property_id
      or new.monthly_rent_paise is distinct from old.monthly_rent_paise
      or new.security_deposit_paise is distinct from old.security_deposit_paise
      or new.rent_due_day is distinct from old.rent_due_day
      or new.joined_on is distinct from old.joined_on
      or new.agreement_start is distinct from old.agreement_start
      or new.agreement_end is distinct from old.agreement_end
      or new.archived_at is distinct from old.archived_at
      or (
        new.status is distinct from old.status
        and not (
          old.status = 'active'
          and new.status = 'notice_period'
          and exists (
            select 1 from public.notice_requests n
            where n.student_id = old.id
              and n.owner_id = old.owner_id
              and n.status = 'pending'
          )
        )
      ) then
      raise exception 'Residents can only update their personal profile details';
    end if;
  end if;
  return new;
end;
$$;

commit;
