-- Safe bootstrap data only: no demo properties, tenants, residents, or payments.
-- This is intentionally global catalog content, not customer business data.
insert into public.subscription_plans (
  code, name, description, price_monthly_paise, price_annual_paise,
  property_limit, student_limit, features, is_active
)
values (
  'starter',
  'Starter',
  'Starter plan catalog entry; subscription billing is not enabled yet.',
  0,
  0,
  1,
  50,
  '{"properties": 1, "students": 50}'::jsonb,
  true
)
on conflict (code) do nothing;
