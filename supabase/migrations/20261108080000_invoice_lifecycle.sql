begin;

create or replace function public.owner_create_manual_invoice(
  target_property_id uuid,
  target_student_id uuid,
  target_period_start date,
  target_due_date date,
  target_amount_paise bigint,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resident public.students%rowtype;
  period_start date;
  period_end date;
  invoice_id uuid;
  invoice_number text;
begin
  if target_amount_paise <= 0 then raise exception 'Invoice amount must be greater than zero'; end if;
  period_start := date_trunc('month', target_period_start::timestamp)::date;
  if target_period_start <> period_start then raise exception 'Billing period must start on the first day of a month'; end if;
  period_end := (period_start + interval '1 month - 1 day')::date;

  select s.* into resident
  from public.students s
  where s.id = target_student_id
    and s.owner_id = (select p.owner_id from public.properties p where p.id = target_property_id)
    and s.property_id = target_property_id
    and s.status not in ('inactive', 'checked_out')
    and s.archived_at is null
    and public.has_owner_access(s.owner_id)
    and exists (
      select 1 from public.occupancies o
      where o.student_id = s.id and o.status = 'active' and o.checked_out_at is null
    )
  for update;
  if not found then raise exception 'Choose a current resident with an active stay at this property'; end if;
  if not exists (select 1 from public.properties p where p.id = target_property_id and p.status = 'active') then
    raise exception 'Property is not active';
  end if;

  invoice_number := 'INV-' || to_char(period_start, 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invoices (
    owner_id, property_id, student_id, invoice_number, billing_period_start, billing_period_end,
    issued_at, due_date, subtotal_paise, total_paise, notes
  ) values (
    resident.owner_id, target_property_id, resident.id, invoice_number, period_start, period_end,
    current_date, target_due_date, target_amount_paise, target_amount_paise, nullif(btrim(target_notes), '')
  ) returning id into invoice_id;

  insert into public.invoice_items(owner_id, invoice_id, description, category, quantity, unit_amount_paise, amount_paise)
  values (resident.owner_id, invoice_id, coalesce(nullif(btrim(target_notes), ''), 'Resident charge'), 'other', 1, target_amount_paise, target_amount_paise);
  return invoice_id;
end;
$$;

create or replace function public.generate_monthly_rent_invoices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_period_start date := date_trunc('month', current_date::timestamp)::date;
  current_period_end date := (date_trunc('month', current_date::timestamp) + interval '1 month - 1 day')::date;
  resident_row record;
  inserted_id uuid;
  created_count integer := 0;
  invoice_number text;
begin
  for resident_row in
    select s.id as student_id, s.owner_id, s.property_id, s.rent_due_day,
      coalesce(rp.rent_paise, o.monthly_rent_paise, s.monthly_rent_paise) as rent_paise,
      coalesce(rp.due_day, s.rent_due_day)::integer as due_day
    from public.occupancies o
    join public.students s on s.id = o.student_id and s.owner_id = o.owner_id
    join public.properties p on p.id = s.property_id and p.owner_id = s.owner_id
    left join lateral (
      select plan.rent_paise, plan.due_day
      from public.rent_plans plan
      where plan.student_id = s.id and plan.owner_id = s.owner_id and plan.is_active
        and plan.starts_on <= current_period_end
        and (plan.ends_on is null or plan.ends_on >= current_period_start)
      order by plan.starts_on desc
      limit 1
    ) rp on true
    where o.status = 'active' and o.checked_out_at is null
      and s.status not in ('inactive', 'checked_out') and s.archived_at is null
      and p.status = 'active'
      and coalesce(rp.rent_paise, o.monthly_rent_paise, s.monthly_rent_paise) > 0
  loop
    invoice_number := 'INV-' || to_char(current_period_start, 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.invoices (
      owner_id, property_id, student_id, invoice_number, billing_period_start, billing_period_end,
      issued_at, due_date, subtotal_paise, total_paise, notes
    ) values (
      resident_row.owner_id, resident_row.property_id, resident_row.student_id, invoice_number,
      current_period_start, current_period_end, current_date,
      greatest(current_date, current_period_start + (resident_row.due_day - 1)),
      resident_row.rent_paise, resident_row.rent_paise, 'Monthly accommodation rent'
    ) on conflict (owner_id, student_id, billing_period_start, billing_period_end) do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      insert into public.invoice_items(owner_id, invoice_id, description, category, quantity, unit_amount_paise, amount_paise)
      values (resident_row.owner_id, inserted_id, 'Monthly accommodation rent', 'rent', 1, resident_row.rent_paise, resident_row.rent_paise);
      created_count := created_count + 1;
    end if;
    inserted_id := null;
  end loop;
  return created_count;
end;
$$;

create or replace function public.resident_request_cash_invoice_payment(target_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  payment_id uuid;
  outstanding bigint;
begin
  select i.* into invoice_row
  from public.invoices i
  where i.id = target_invoice_id and public.owns_student(i.student_id)
  for update;
  if not found then raise exception 'Invoice not found or access denied'; end if;
  if invoice_row.status in ('paid', 'cancelled') then raise exception 'This invoice cannot accept payment'; end if;
  outstanding := invoice_row.total_paise - invoice_row.amount_paid_paise;
  if outstanding <= 0 then raise exception 'This invoice has no remaining balance'; end if;
  if exists (select 1 from public.payments p where p.invoice_id = invoice_row.id and p.method = 'cash' and p.status = 'pending') then
    raise exception 'A cash payment is already awaiting owner confirmation';
  end if;

  insert into public.payments(owner_id, student_id, invoice_id, amount_paise, method, status, notes)
  values (invoice_row.owner_id, invoice_row.student_id, invoice_row.id, outstanding, 'cash', 'pending', 'Resident reported cash payment; owner confirmation required')
  returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.owner_confirm_cash_invoice_payment(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  invoice_row public.invoices%rowtype;
  next_paid bigint;
  next_status text;
  next_receipt text;
begin
  select p.* into payment_row from public.payments p where p.id = target_payment_id and p.method = 'cash' for update;
  if not found or not public.has_owner_access(payment_row.owner_id) then raise exception 'Cash payment not found or access denied'; end if;
  if payment_row.status <> 'pending' or payment_row.invoice_id is null then raise exception 'Cash payment is no longer awaiting confirmation'; end if;

  select i.* into invoice_row from public.invoices i where i.id = payment_row.invoice_id for update;
  if not found or invoice_row.owner_id <> payment_row.owner_id or invoice_row.student_id <> payment_row.student_id then raise exception 'Invoice/payment mismatch'; end if;
  if payment_row.amount_paise > invoice_row.total_paise - invoice_row.amount_paid_paise then raise exception 'Payment exceeds the invoice balance'; end if;

  next_paid := invoice_row.amount_paid_paise + payment_row.amount_paise;
  next_status := case when next_paid >= invoice_row.total_paise then 'paid' else 'partially_paid' end;
  next_receipt := 'RCT-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  update public.payments set status = 'completed', paid_at = now(), recorded_by = auth.uid(), receipt_number = next_receipt,
    notes = 'Cash receipt confirmed by PG owner' where id = payment_row.id;
  insert into public.payment_allocations(owner_id, payment_id, invoice_id, amount_paise)
  values (payment_row.owner_id, payment_row.id, invoice_row.id, payment_row.amount_paise);
  update public.invoices set amount_paid_paise = next_paid, status = next_status where id = invoice_row.id;
end;
$$;

create or replace function public.owner_reject_cash_invoice_payment(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
begin
  select p.* into payment_row from public.payments p where p.id = target_payment_id and p.method = 'cash' for update;
  if not found or not public.has_owner_access(payment_row.owner_id) then raise exception 'Cash payment not found or access denied'; end if;
  if payment_row.status <> 'pending' then raise exception 'Cash payment is no longer awaiting confirmation'; end if;
  update public.payments set status = 'failed', recorded_by = auth.uid(), notes = 'Cash payment report declined by PG owner' where id = payment_row.id;
end;
$$;

create or replace function public.resident_create_online_invoice_payment(target_invoice_id uuid, target_order_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  payment_id uuid;
  outstanding bigint;
begin
  if nullif(btrim(target_order_id), '') is null then raise exception 'Payment provider order ID is required'; end if;
  select i.* into invoice_row from public.invoices i where i.id = target_invoice_id and public.owns_student(i.student_id) for update;
  if not found then raise exception 'Invoice not found or access denied'; end if;
  if invoice_row.status in ('paid', 'cancelled') then raise exception 'This invoice cannot accept payment'; end if;
  outstanding := invoice_row.total_paise - invoice_row.amount_paid_paise;
  if outstanding <= 0 then raise exception 'This invoice has no remaining balance'; end if;

  update public.payments set status = 'failed', notes = 'Payment order expired before completion'
  where invoice_id = invoice_row.id and method = 'razorpay' and status = 'pending' and created_at < now() - interval '30 minutes';
  if exists (select 1 from public.payments p where p.invoice_id = invoice_row.id and p.method = 'razorpay' and p.status = 'pending') then
    raise exception 'An online payment is already in progress. Try again in 30 minutes if it was abandoned';
  end if;

  insert into public.payments(owner_id, student_id, invoice_id, amount_paise, method, status, external_reference, notes)
  values (invoice_row.owner_id, invoice_row.student_id, invoice_row.id, outstanding, 'razorpay', 'pending', target_order_id, 'Razorpay order awaiting verified capture')
  returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.complete_online_invoice_payment(target_order_id text, target_gateway_payment_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  invoice_row public.invoices%rowtype;
  next_paid bigint;
  next_status text;
  next_receipt text;
begin
  select p.* into payment_row from public.payments p where p.external_reference = target_order_id and p.method = 'razorpay' for update;
  if not found then raise exception 'Payment order not found'; end if;
  if payment_row.status = 'completed' then return; end if;
  if payment_row.status <> 'pending' then raise exception 'Payment is not pending'; end if;
  select i.* into invoice_row from public.invoices i where i.id = payment_row.invoice_id for update;
  if not found or invoice_row.owner_id <> payment_row.owner_id or invoice_row.student_id <> payment_row.student_id then raise exception 'Invoice/payment mismatch'; end if;
  if payment_row.amount_paise > invoice_row.total_paise - invoice_row.amount_paid_paise then raise exception 'Captured payment exceeds remaining invoice balance'; end if;

  next_paid := invoice_row.amount_paid_paise + payment_row.amount_paise;
  next_status := case when next_paid >= invoice_row.total_paise then 'paid' else 'partially_paid' end;
  next_receipt := 'RCT-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.payments set status = 'completed', paid_at = now(), receipt_number = next_receipt,
    notes = 'Razorpay payment ID: ' || target_gateway_payment_id where id = payment_row.id;
  insert into public.payment_allocations(owner_id, payment_id, invoice_id, amount_paise)
  values (payment_row.owner_id, payment_row.id, invoice_row.id, payment_row.amount_paise);
  update public.invoices set amount_paid_paise = next_paid, status = next_status where id = invoice_row.id;
end;
$$;

revoke all on function public.owner_create_manual_invoice(uuid, uuid, date, date, bigint, text) from public, anon;
revoke all on function public.resident_request_cash_invoice_payment(uuid) from public, anon;
revoke all on function public.owner_confirm_cash_invoice_payment(uuid) from public, anon;
revoke all on function public.owner_reject_cash_invoice_payment(uuid) from public, anon;
revoke all on function public.resident_create_online_invoice_payment(uuid, text) from public, anon;
revoke all on function public.complete_online_invoice_payment(text, text) from public, anon, authenticated;
revoke all on function public.generate_monthly_rent_invoices() from public, anon, authenticated;
grant execute on function public.owner_create_manual_invoice(uuid, uuid, date, date, bigint, text) to authenticated;
grant execute on function public.resident_request_cash_invoice_payment(uuid) to authenticated;
grant execute on function public.owner_confirm_cash_invoice_payment(uuid) to authenticated;
grant execute on function public.owner_reject_cash_invoice_payment(uuid) to authenticated;
grant execute on function public.resident_create_online_invoice_payment(uuid, text) to authenticated;
grant execute on function public.complete_online_invoice_payment(text, text) to service_role;
grant execute on function public.generate_monthly_rent_invoices() to postgres, service_role;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'monthly-resident-rent-invoices';
select cron.schedule('monthly-resident-rent-invoices', '0 2 2 * *', 'select public.generate_monthly_rent_invoices();');

commit;
