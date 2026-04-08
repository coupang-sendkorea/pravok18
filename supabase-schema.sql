-- Право CRM — схема базы данных для Supabase
-- Вставьте этот SQL целиком в Supabase SQL Editor и нажмите Run.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  case_title text,
  phone text,
  email text,
  messenger text,
  address text,
  notes text,
  contract_amount numeric(12,2) not null default 0,
  payment_type text check (payment_type in ('100% предоплата', 'частями', 'по графику')),
  payment_deadline date,
  payment_reminder_date date,
  case_status text not null default 'active' check (case_status in ('active', 'archived')),
  case_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  expense_date date not null default current_date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  category text,
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  due_date date not null,
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  status text not null default 'planned' check (status in ('planned', 'completed', 'overdue')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  event_date date not null,
  event_time time,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_clients_status on public.clients(case_status);
create index if not exists idx_clients_deadline on public.clients(payment_deadline);
create index if not exists idx_payments_client_id on public.payments(client_id);
create index if not exists idx_expenses_client_id on public.expenses(client_id);
create index if not exists idx_payment_schedules_client_id on public.payment_schedules(client_id);
create index if not exists idx_events_event_date on public.events(event_date);
create index if not exists idx_events_client_id on public.events(client_id);

create or replace trigger trg_clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.events enable row level security;

-- ВАЖНО:
-- Эти политики открывают таблицы для роли anon, потому что приложение работает как статический сайт на GitHub Pages
-- без полноценной авторизации. Это удобно для запуска, но НЕ является надежной защитой данных.
-- Для реальной защиты лучше позже перейти на Supabase Auth и закрытые RLS-политики.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clients' and policyname = 'anon full access clients'
  ) then
    create policy "anon full access clients" on public.clients
    for all to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'anon full access payments'
  ) then
    create policy "anon full access payments" on public.payments
    for all to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses' and policyname = 'anon full access expenses'
  ) then
    create policy "anon full access expenses" on public.expenses
    for all to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_schedules' and policyname = 'anon full access payment_schedules'
  ) then
    create policy "anon full access payment_schedules" on public.payment_schedules
    for all to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'anon full access events'
  ) then
    create policy "anon full access events" on public.events
    for all to anon
    using (true)
    with check (true);
  end if;
end $$;
