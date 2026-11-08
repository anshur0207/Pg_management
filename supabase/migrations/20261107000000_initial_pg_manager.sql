-- PG Manager initial schema
-- Public owner registration creates a tenant; admin-invited auth users are students.
-- The browser never supplies owner IDs for authorization decisions: RLS checks auth.uid().

begin;

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.app_role as enum ('SUPER_ADMIN', 'PG_OWNER', 'PROPERTY_MANAGER', 'STAFF', 'STUDENT');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'STUDENT',
  full_name text not null default '',
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  business_name text not null,
  business_address text,
  phone text,
  property_count_estimate integer check (property_count_estimate is null or property_count_estimate >= 0),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Do not read a role from user-editable metadata. Only non-invited signups become
-- PG owners; Supabase-authenticated invitations are created as students.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
  owner_business_name text;
begin
  assigned_role := case when new.invited_at is null then 'PG_OWNER'::public.app_role else 'STUDENT'::public.app_role end;
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    assigned_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  if new.invited_at is null then
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

drop trigger if exists on_auth_user_created_pg_manager on auth.users;
create trigger on_auth_user_created_pg_manager
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_monthly_paise bigint not null default 0 check (price_monthly_paise >= 0),
  price_annual_paise bigint not null default 0 check (price_annual_paise >= 0),
  property_limit integer check (property_limit is null or property_limit > 0),
  student_limit integer check (student_limit is null or student_limit > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  starts_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  code text not null,
  address text not null,
  locality text,
  city text not null,
  state text not null,
  pin_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  contact_phone text,
  floor_count integer not null default 0 check (floor_count >= 0),
  amenities text[] not null default '{}',
  image_paths text[] not null default '{}',
  manager_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  marketplace_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (owner_id, code),
  unique (owner_id, id)
);

create table public.property_staff (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  staff_type text not null check (staff_type in ('manager', 'cleaner', 'electrician', 'plumber', 'security', 'maintenance', 'other')),
  permission_role public.app_role not null default 'STAFF' check (permission_role in ('PROPERTY_MANAGER', 'STAFF')),
  is_active boolean not null default true,
  joined_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  unique (property_id, user_id)
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  name text not null,
  floor_number integer,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  unique (property_id, name),
  unique (owner_id, property_id, id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  floor_id uuid not null,
  room_number text not null,
  room_type text not null default 'shared' check (room_type in ('single', 'double', 'triple', 'shared', 'dormitory', 'other')),
  capacity integer not null default 1 check (capacity > 0),
  has_ac boolean not null default false,
  bathroom_type text not null default 'common' check (bathroom_type in ('attached', 'common', 'none')),
  monthly_rent_paise bigint check (monthly_rent_paise is null or monthly_rent_paise >= 0),
  security_deposit_paise bigint not null default 0 check (security_deposit_paise >= 0),
  amenities text[] not null default '{}',
  image_paths text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, property_id, floor_id) references public.floors(owner_id, property_id, id) on delete restrict,
  unique (property_id, room_number),
  unique (owner_id, id)
);

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  room_id uuid not null,
  bed_number text not null,
  status text not null default 'available' check (status in ('available', 'occupied', 'reserved', 'maintenance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, room_id) references public.rooms(owner_id, id) on delete restrict,
  unique (room_id, bed_number),
  unique (owner_id, id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  property_id uuid not null,
  full_name text not null,
  email text,
  phone text not null,
  gender text check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  date_of_birth date,
  profile_path text,
  emergency_contact_name text,
  emergency_contact_phone text,
  permanent_address text,
  government_id_type text,
  government_id_last4 text,
  joined_on date not null default current_date,
  monthly_rent_paise bigint not null default 0 check (monthly_rent_paise >= 0),
  security_deposit_paise bigint not null default 0 check (security_deposit_paise >= 0),
  rent_due_day smallint not null default 1 check (rent_due_day between 1 and 28),
  agreement_start date,
  agreement_end date,
  status text not null default 'active' check (status in ('active', 'notice_period', 'checkout_pending', 'checked_out', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  unique (owner_id, id)
);

create table public.occupancies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  bed_id uuid not null,
  check_in date not null,
  expected_check_out date,
  checked_out_at timestamptz,
  monthly_rent_paise bigint not null check (monthly_rent_paise >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, bed_id) references public.beds(owner_id, id) on delete restrict,
  unique (owner_id, id),
  check (expected_check_out is null or expected_check_out >= check_in),
  check ((status = 'completed' and checked_out_at is not null) or (status <> 'completed'))
);
create unique index occupancies_one_active_per_bed on public.occupancies(bed_id) where status = 'active' and checked_out_at is null;
create unique index occupancies_one_active_per_student on public.occupancies(student_id) where status = 'active' and checked_out_at is null;
create index occupancies_student_history on public.occupancies(student_id, check_in desc);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  bed_id uuid not null,
  student_id uuid,
  applicant_name text not null,
  applicant_phone text,
  applicant_email text,
  reserved_from date not null default current_date,
  reserved_until date,
  status text not null default 'active' check (status in ('active', 'converted', 'cancelled', 'expired')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, bed_id) references public.beds(owner_id, id) on delete restrict,
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  check (reserved_until is null or reserved_until >= reserved_from)
);
create unique index reservations_one_active_per_bed on public.reservations(bed_id) where status = 'active';

create table public.rent_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  name text not null default 'Monthly rent',
  rent_paise bigint not null check (rent_paise >= 0),
  due_day smallint not null default 1 check (due_day between 1 and 28),
  late_fee_paise bigint not null default 0 check (late_fee_paise >= 0),
  late_fee_grace_days smallint not null default 0 check (late_fee_grace_days between 0 and 31),
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  property_id uuid not null,
  invoice_number text not null,
  billing_period_start date not null,
  billing_period_end date not null,
  issued_at date not null default current_date,
  due_date date not null,
  subtotal_paise bigint not null default 0 check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  total_paise bigint not null default 0 check (total_paise >= 0),
  amount_paid_paise bigint not null default 0 check (amount_paid_paise >= 0),
  status text not null default 'pending' check (status in ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  unique (owner_id, invoice_number),
  unique (owner_id, id),
  unique (owner_id, student_id, billing_period_start, billing_period_end),
  check (billing_period_end >= billing_period_start),
  check (discount_paise <= subtotal_paise),
  check (amount_paid_paise <= total_paise)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  invoice_id uuid not null,
  description text not null,
  category text not null default 'rent' check (category in ('rent', 'electricity', 'food', 'laundry', 'maintenance', 'late_fee', 'discount', 'other')),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount_paise bigint not null check (unit_amount_paise >= 0),
  amount_paise bigint not null check (amount_paise >= 0),
  created_at timestamptz not null default now(),
  foreign key (owner_id, invoice_id) references public.invoices(owner_id, id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  invoice_id uuid,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR',
  method text not null check (method in ('upi', 'cash', 'bank_transfer', 'razorpay', 'other')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  paid_at timestamptz,
  external_reference text,
  idempotency_key text,
  receipt_number text,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, invoice_id) references public.invoices(owner_id, id) on delete restrict,
  unique (owner_id, id),
  unique (owner_id, idempotency_key),
  unique (owner_id, external_reference)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  created_at timestamptz not null default now(),
  foreign key (owner_id, payment_id) references public.payments(owner_id, id) on delete restrict,
  foreign key (owner_id, invoice_id) references public.invoices(owner_id, id) on delete restrict,
  unique (payment_id, invoice_id)
);

create table public.security_deposits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  amount_paise bigint not null check (amount_paise >= 0),
  refunded_paise bigint not null default 0 check (refunded_paise >= 0),
  received_at date,
  refunded_at date,
  payment_id uuid,
  status text not null default 'held' check (status in ('held', 'partially_refunded', 'refunded', 'forfeited')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, payment_id) references public.payments(owner_id, id) on delete restrict,
  check (refunded_paise <= amount_paise)
);

create table public.notice_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  submitted_at timestamptz not null default now(),
  expected_checkout date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'completed')),
  owner_response text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict
);

create table public.checkout_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  occupancy_id uuid not null,
  scheduled_checkout date,
  actual_checkout_at timestamptz,
  pending_rent_paise bigint not null default 0 check (pending_rent_paise >= 0),
  outstanding_charges_paise bigint not null default 0 check (outstanding_charges_paise >= 0),
  deposit_refund_paise bigint not null default 0 check (deposit_refund_paise >= 0),
  damage_notes text,
  inspection_notes text,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'settled', 'disputed')),
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, occupancy_id) references public.occupancies(owner_id, id) on delete restrict,
  unique (occupancy_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  student_id uuid not null,
  ticket_number text not null,
  category text not null check (category in ('wifi', 'housekeeping', 'cleaning', 'plumbing', 'electrical', 'water', 'food', 'laundry', 'furniture', 'security', 'other')),
  title text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'waiting_for_student', 'resolved', 'closed', 'reopened')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  resolution_notes text,
  resolved_at timestamptz,
  student_rating smallint check (student_rating is null or student_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  unique (owner_id, ticket_number),
  unique (owner_id, id)
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  ticket_id uuid not null,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (owner_id, ticket_id) references public.tickets(owner_id, id) on delete cascade
);

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  ticket_id uuid not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  foreign key (owner_id, ticket_id) references public.tickets(owner_id, id) on delete cascade,
  unique (storage_path)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (owner_id, id)
);

create or replace function public.seed_owner_expense_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_categories (owner_id, name) values
    (new.id, 'Electricity'), (new.id, 'Water'), (new.id, 'Internet'),
    (new.id, 'Food'), (new.id, 'Staff salaries'), (new.id, 'Housekeeping'),
    (new.id, 'Repairs'), (new.id, 'Maintenance'), (new.id, 'Property lease'), (new.id, 'Other')
  on conflict (owner_id, name) do nothing;
  return new;
end;
$$;
create trigger seed_expense_categories_for_owner
after insert on public.owners
for each row execute function public.seed_owner_expense_categories();
insert into public.expense_categories (owner_id, name)
select o.id, category.name
from public.owners o
cross join unnest(array['Electricity', 'Water', 'Internet', 'Food', 'Staff salaries', 'Housekeeping', 'Repairs', 'Maintenance', 'Property lease', 'Other']) as category(name)
on conflict (owner_id, name) do nothing;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  category_id uuid,
  description text not null,
  amount_paise bigint not null check (amount_paise > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'other' check (payment_method in ('upi', 'cash', 'bank_transfer', 'razorpay', 'other')),
  receipt_path text,
  vendor_name text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, category_id) references public.expense_categories(owner_id, id) on delete restrict
);

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict
);

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  student_id uuid,
  visitor_name text not null,
  mobile_number text,
  purpose text,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'denied')),
  remarks text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  check (exit_at is null or exit_at >= entry_at)
);

create table public.food_menus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  menu_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  items text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  unique (property_id, menu_date, meal_type)
);

create table public.meal_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid not null,
  starts_on date not null,
  ends_on date,
  meals text[] not null default '{breakfast,lunch,dinner}',
  monthly_charge_paise bigint not null default 0 check (monthly_charge_paise >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid,
  property_id uuid,
  document_type text not null check (document_type in ('identity', 'address_proof', 'rental_agreement', 'payment_receipt', 'deposit_receipt', 'photograph', 'other')),
  file_name text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  expires_on date,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  check (student_id is not null or property_id is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  user_id uuid references auth.users(id) on delete cascade,
  student_id uuid,
  event_type text not null,
  title text not null,
  body text not null,
  action_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete cascade
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp', 'push')),
  event_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, channel, event_type)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid,
  title text not null,
  body text not null,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  check (expires_at is null or expires_at > publish_at)
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  event_type text not null,
  language_code text not null default 'en',
  body text not null,
  provider_template_name text,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name, language_code),
  unique (owner_id, id)
);

create table public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  student_id uuid,
  template_id uuid,
  recipient_phone text not null,
  event_type text not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered')),
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, template_id) references public.whatsapp_templates(owner_id, id) on delete restrict
);

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  provider text not null check (provider in ('whatsapp', 'razorpay', 'fcm', 'resend')),
  enabled boolean not null default false,
  provider_account_id text,
  secret_reference text,
  settings jsonb not null default '{}'::jsonb,
  configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider)
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id uuid not null,
  bed_id uuid,
  title text not null,
  description text,
  monthly_rent_paise bigint not null check (monthly_rent_paise >= 0),
  available_from date not null default current_date,
  amenities text[] not null default '{}',
  room_type text,
  has_ac boolean not null default false,
  food_available boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'rented', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, property_id) references public.properties(owner_id, id) on delete restrict,
  foreign key (owner_id, bed_id) references public.beds(owner_id, id) on delete restrict,
  unique (owner_id, id)
);

create table public.booking_inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  listing_id uuid not null,
  name text not null,
  phone text not null,
  email text,
  message text,
  visit_requested_at timestamptz,
  status text not null default 'new' check (status in ('new', 'contacted', 'visit_scheduled', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, listing_id) references public.marketplace_listings(owner_id, id) on delete restrict
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  owner_id uuid references public.owners(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  owner_id uuid references public.owners(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0 check (records_processed >= 0),
  error_details jsonb,
  created_at timestamptz not null default now()
);

-- Tenant authorization: owner access derives from the authenticated user linked
-- to owners. Staff support is property-scoped and is intentionally not granted
-- tenant-wide access by this helper.
create or replace function public.has_owner_access(target_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.owners o
    where o.id = target_owner_id and o.user_id = auth.uid() and o.status = 'active' and o.archived_at is null
  );
$$;

create or replace function public.has_property_access(target_owner_id uuid, target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_owner_access(target_owner_id) or exists (
    select 1 from public.property_staff ps
    where ps.owner_id = target_owner_id
      and ps.property_id = target_property_id
      and ps.user_id = auth.uid()
      and ps.is_active
      and ps.ended_at is null
  );
$$;

create or replace function public.owns_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.students s where s.id = target_student_id and s.auth_user_id = auth.uid()
  );
$$;

create or replace function public.owns_ticket(target_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.tickets t join public.students s on s.id = t.student_id
    where t.id = target_ticket_id and s.auth_user_id = auth.uid()
  );
$$;

create or replace function public.can_access_document_object(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = target_path
      and (public.has_owner_access(d.owner_id) or public.owns_student(d.student_id))
  );
$$;

-- Index frequently used tenant, relation, and date columns.
create index properties_owner_status on public.properties(owner_id, status);
create index property_staff_user_active on public.property_staff(user_id, is_active, property_id);
create index floors_property_order on public.floors(property_id, sort_order);
create index rooms_property_floor on public.rooms(property_id, floor_id);
create index beds_room_status on public.beds(room_id, status);
create index students_owner_status on public.students(owner_id, status);
create index students_property on public.students(property_id);
create index invoices_owner_due_status on public.invoices(owner_id, due_date, status);
create index invoices_student_period on public.invoices(student_id, billing_period_start desc);
create index payments_student_paid_at on public.payments(student_id, paid_at desc);
create index payments_owner_created_at on public.payments(owner_id, created_at desc);
create index tickets_owner_status_created on public.tickets(owner_id, status, created_at desc);
create index tickets_student_created on public.tickets(student_id, created_at desc);
create index expenses_owner_date on public.expenses(owner_id, expense_date desc);
create index visitors_property_entry on public.visitors(property_id, entry_at desc);
create index documents_student_type on public.documents(student_id, document_type);
create index notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;
create index whatsapp_logs_owner_created on public.whatsapp_logs(owner_id, created_at desc);
create index audit_logs_owner_created on public.audit_logs(owner_id, created_at desc);

-- updated_at maintenance.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'owners', 'subscription_plans', 'subscriptions', 'properties', 'property_staff',
    'floors', 'rooms', 'beds', 'students', 'occupancies', 'reservations', 'rent_plans',
    'invoices', 'payments', 'security_deposits', 'notice_requests', 'checkout_records', 'tickets',
    'expenses', 'staff_tasks', 'food_menus', 'meal_subscriptions', 'documents', 'announcements',
    'whatsapp_templates', 'integration_settings', 'marketplace_listings', 'booking_inquiries', 'notification_preferences'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

-- RLS defaults to deny. Owners receive tenant-scoped CRUD; student policies below
-- add only the required resident-facing reads and ticket actions.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subscriptions', 'properties', 'property_staff', 'floors', 'rooms', 'beds', 'students',
    'occupancies', 'reservations', 'rent_plans', 'invoices', 'invoice_items',
    'security_deposits', 'notice_requests', 'checkout_records', 'tickets',
    'ticket_comments', 'ticket_attachments', 'expense_categories', 'expenses', 'staff_tasks',
    'visitors', 'food_menus', 'meal_subscriptions', 'documents', 'notifications',
    'notification_preferences', 'announcements', 'whatsapp_templates',
    'integration_settings', 'marketplace_listings', 'booking_inquiries'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy owner_tenant_access on public.%I for all to authenticated using (public.has_owner_access(owner_id)) with check (public.has_owner_access(owner_id))', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- Financial receipts and audit/message logs are append-only for tenant users;
-- only trusted backend jobs may reconcile, redact, or update provider statuses.
alter table public.payments enable row level security;
create policy payment_owner_read on public.payments for select to authenticated using (public.has_owner_access(owner_id));
create policy payment_owner_create on public.payments for insert to authenticated with check (public.has_owner_access(owner_id));
grant select, insert on public.payments to authenticated;
alter table public.payment_allocations enable row level security;
create policy allocation_owner_read on public.payment_allocations for select to authenticated using (public.has_owner_access(owner_id));
create policy allocation_owner_create on public.payment_allocations for insert to authenticated with check (public.has_owner_access(owner_id));
grant select, insert on public.payment_allocations to authenticated;

alter table public.audit_logs enable row level security;
create policy audit_read_owner on public.audit_logs for select to authenticated using (owner_id is not null and public.has_owner_access(owner_id));
grant select on public.audit_logs to authenticated;
alter table public.whatsapp_logs enable row level security;
create policy whatsapp_log_read_owner on public.whatsapp_logs for select to authenticated using (public.has_owner_access(owner_id));
grant select on public.whatsapp_logs to authenticated;

grant all on all tables in schema public to service_role;

alter table public.profiles enable row level security;
create policy profile_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profile_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on public.profiles to authenticated;
revoke insert, delete, update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path, updated_at) on public.profiles to authenticated;

alter table public.owners enable row level security;
create policy owner_read_self on public.owners for select to authenticated using (public.has_owner_access(id));
create policy owner_update_self on public.owners for update to authenticated using (public.has_owner_access(id)) with check (public.has_owner_access(id));
grant select on public.owners to authenticated;
revoke insert, delete, update on public.owners from authenticated;
grant update (business_name, business_address, phone, property_count_estimate, updated_at) on public.owners to authenticated;

-- Resident-owned reads. Residents cannot update financial amounts, bed assignments,
-- or other administrative fields directly.
create policy student_read_own_profile on public.students for select to authenticated using (public.owns_student(id));
create policy property_read_current_student on public.properties for select to authenticated using (
  exists (select 1 from public.students s where s.auth_user_id = auth.uid() and s.property_id = properties.id)
);
create policy floor_read_current_student on public.floors for select to authenticated using (
  exists (
    select 1 from public.students s
    join public.occupancies o on o.student_id = s.id and o.status = 'active' and o.checked_out_at is null
    join public.beds b on b.id = o.bed_id
    join public.rooms r on r.id = b.room_id
    where s.auth_user_id = auth.uid() and r.floor_id = floors.id
  )
);
create policy room_read_current_student on public.rooms for select to authenticated using (
  exists (
    select 1 from public.students s
    join public.occupancies o on o.student_id = s.id and o.status = 'active' and o.checked_out_at is null
    join public.beds b on b.id = o.bed_id
    where s.auth_user_id = auth.uid() and b.room_id = rooms.id
  )
);
create policy bed_read_current_student on public.beds for select to authenticated using (
  exists (
    select 1 from public.occupancies o
    where o.bed_id = beds.id and o.status = 'active' and o.checked_out_at is null
      and public.owns_student(o.student_id)
  )
);
create policy occupancy_read_own_history on public.occupancies for select to authenticated using (public.owns_student(student_id));
create policy invoice_read_own on public.invoices for select to authenticated using (public.owns_student(student_id));
create policy invoice_items_read_own on public.invoice_items for select to authenticated using (
  exists (select 1 from public.invoices i where i.id = invoice_id and public.owns_student(i.student_id))
);
create policy payment_read_own on public.payments for select to authenticated using (public.owns_student(student_id));
create policy payment_allocation_read_own on public.payment_allocations for select to authenticated using (
  exists (select 1 from public.payments p where p.id = payment_id and public.owns_student(p.student_id))
);
create policy deposit_read_own on public.security_deposits for select to authenticated using (public.owns_student(student_id));
create policy notice_read_own on public.notice_requests for select to authenticated using (public.owns_student(student_id));
create policy notice_create_own on public.notice_requests for insert to authenticated with check (public.owns_student(student_id));
create policy checkout_read_own on public.checkout_records for select to authenticated using (public.owns_student(student_id));
create policy ticket_read_own on public.tickets for select to authenticated using (public.owns_student(student_id));
create policy ticket_create_own on public.tickets for insert to authenticated with check (public.owns_student(student_id));
create policy ticket_comment_read_own on public.ticket_comments for select to authenticated using (
  not is_internal and public.owns_ticket(ticket_id)
);
create policy ticket_comment_create_own on public.ticket_comments for insert to authenticated with check (
  not is_internal and public.owns_ticket(ticket_id) and author_user_id = auth.uid()
);
create policy ticket_attachment_read_own on public.ticket_attachments for select to authenticated using (public.owns_ticket(ticket_id));
create policy document_read_own on public.documents for select to authenticated using (public.owns_student(student_id));
create policy notification_read_own on public.notifications for select to authenticated using (user_id = auth.uid() or public.owns_student(student_id));
create policy notification_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_preference_read_own on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notification_preference_manage_own on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy announcement_read_student on public.announcements for select to authenticated using (
  status = 'published'
  and publish_at <= now()
  and (expires_at is null or expires_at > now())
  and exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid() and s.owner_id = announcements.owner_id
      and (announcements.property_id is null or announcements.property_id = s.property_id)
  )
);
create policy food_menu_read_student on public.food_menus for select to authenticated using (
  exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid() and s.owner_id = food_menus.owner_id and s.property_id = food_menus.property_id
  )
);
create policy meal_subscription_read_own on public.meal_subscriptions for select to authenticated using (public.owns_student(student_id));

-- Authenticated users get no direct access to provider credentials, audit writes,
-- platform plans, or job history. Server-only service-role jobs should write these.
alter table public.subscription_plans enable row level security;
create policy active_plans_read on public.subscription_plans for select to authenticated using (is_active);
grant select on public.subscription_plans to authenticated;
alter table public.job_runs enable row level security;
grant select, insert, update, delete on public.job_runs to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on function public.has_owner_access(uuid) to authenticated;
grant execute on function public.has_property_access(uuid, uuid) to authenticated;
grant execute on function public.owns_student(uuid) to authenticated;
grant execute on function public.owns_ticket(uuid) to authenticated;
grant execute on function public.can_access_document_object(text) to authenticated;

-- Private bucket: never publish identity documents or agreements.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pg-documents', 'pg-documents', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy pg_documents_owner_read on storage.objects for select to authenticated
using (bucket_id = 'pg-documents' and public.can_access_document_object(name));
create policy pg_documents_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'pg-documents' and public.has_owner_access(((storage.foldername(name))[1])::uuid));
create policy pg_documents_owner_update on storage.objects for update to authenticated
using (bucket_id = 'pg-documents' and public.has_owner_access(((storage.foldername(name))[1])::uuid))
with check (bucket_id = 'pg-documents' and public.has_owner_access(((storage.foldername(name))[1])::uuid));
create policy pg_documents_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'pg-documents' and public.has_owner_access(((storage.foldername(name))[1])::uuid));

commit;
