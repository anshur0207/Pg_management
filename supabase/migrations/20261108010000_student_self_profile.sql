begin;

drop policy if exists student_update_own_profile on public.students;
create policy student_update_own_profile on public.students
  for update to authenticated
  using (public.owns_student(id))
  with check (public.owns_student(id));

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
      or new.status is distinct from old.status
      or new.archived_at is distinct from old.archived_at then
      raise exception 'Residents can only update their personal profile details';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_student_self_service_fields on public.students;
create trigger protect_student_self_service_fields
  before update on public.students
  for each row execute function public.protect_student_self_service_fields();

drop policy if exists documents_student_identity_insert on public.documents;
create policy documents_student_identity_insert on public.documents
  for insert to authenticated
  with check (
    document_type = 'identity'
    and student_id is not null
    and public.owns_student(student_id)
    and exists (
      select 1 from public.students s
      where s.id = documents.student_id and s.owner_id = documents.owner_id
    )
  );

drop policy if exists pg_documents_student_identity_insert on storage.objects;
create policy pg_documents_student_identity_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pg-documents'
    and (storage.foldername(name))[3] = 'identity'
    and public.owns_student(((storage.foldername(name))[2])::uuid)
    and exists (
      select 1 from public.students s
      where s.id = ((storage.foldername(name))[2])::uuid
        and s.owner_id = ((storage.foldername(name))[1])::uuid
    )
  );

grant execute on function public.protect_student_self_service_fields() to authenticated;

commit;
