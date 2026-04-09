-- Право CRM — обновленная схема для Supabase
-- Вставьте этот SQL целиком в Supabase SQL Editor и нажмите Run.
-- Файл можно выполнять повторно.

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
  workspace_key text,
  full_name text not null,
  case_title text,
  phone text,
  email text,
  messenger text,
  address text,
  notes text,
  contract_number text,
  contract_date date,
  contract_city text,
  contract_payment_days integer,
  customer_birth_date date,
  registration_address text,
  passport_number text,
  passport_issued_by text,
  passport_division_code text,
  service_description text,
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
  workspace_key text,
  client_id uuid not null references public.clients(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  payment_channel text not null default 'cashless' check (payment_channel in ('cash', 'cashless')),
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  client_id uuid not null references public.clients(id) on delete cascade,
  expense_date date not null default current_date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  payment_channel text not null default 'cashless' check (payment_channel in ('cash', 'cashless')),
  category text,
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  client_id uuid not null references public.clients(id) on delete cascade,
  due_date date not null,
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  status text not null default 'planned' check (status in ('planned', 'completed', 'overdue')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  event_date date not null,
  event_time time,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  lender_name text not null,
  loan_title text,
  issue_date date not null default current_date,
  due_date date,
  principal_amount numeric(12,2) not null default 0 check (principal_amount >= 0),
  received_account_type text not null default 'cashless' check (received_account_type in ('cash', 'cashless')),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  entry_date date not null default current_date,
  flow_type text not null check (flow_type in ('income', 'expense')),
  account_type text not null default 'cashless' check (account_type in ('cash', 'cashless')),
  purpose text not null default 'other' check (purpose in ('other', 'loan_repayment')),
  related_loan_id uuid,
  category text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  workspace_key text,
  record_date date not null default current_date,
  person_name text not null check (person_name in ('Ильвар', 'Рустам')),
  record_type text not null check (record_type in ('spent_personal', 'reimbursed_from_company', 'took_from_company', 'returned_to_company')),
  account_type text check (account_type in ('cash', 'cashless')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.clients add column if not exists workspace_key text;
alter table public.clients add column if not exists contract_number text;
alter table public.clients add column if not exists contract_date date;
alter table public.clients add column if not exists contract_city text;
alter table public.clients add column if not exists contract_payment_days integer;
alter table public.clients add column if not exists customer_birth_date date;
alter table public.clients add column if not exists registration_address text;
alter table public.clients add column if not exists passport_number text;
alter table public.clients add column if not exists passport_issued_by text;
alter table public.clients add column if not exists passport_division_code text;
alter table public.clients add column if not exists service_description text;
alter table public.payments add column if not exists workspace_key text;
alter table public.payments add column if not exists payment_channel text default 'cashless';
alter table public.expenses add column if not exists workspace_key text;
alter table public.expenses add column if not exists payment_channel text default 'cashless';
alter table public.payment_schedules add column if not exists workspace_key text;
alter table public.events add column if not exists workspace_key text;
alter table public.cash_transactions add column if not exists workspace_key text;
alter table public.cash_transactions add column if not exists entry_date date default current_date;
alter table public.cash_transactions add column if not exists flow_type text;
alter table public.cash_transactions add column if not exists account_type text default 'cashless';
alter table public.cash_transactions add column if not exists purpose text default 'other';
alter table public.cash_transactions add column if not exists related_loan_id uuid;
alter table public.cash_transactions add column if not exists category text;
alter table public.cash_transactions add column if not exists amount numeric(12,2) default 0;
alter table public.cash_transactions add column if not exists description text;
alter table public.cash_transactions add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.loans add column if not exists workspace_key text;
alter table public.personal_records add column if not exists workspace_key text;

update public.payments set payment_channel = coalesce(payment_channel, 'cashless');
update public.expenses set payment_channel = coalesce(payment_channel, 'cashless');
update public.cash_transactions set account_type = coalesce(account_type, 'cashless');
update public.cash_transactions set purpose = coalesce(purpose, 'other');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_transactions_related_loan_id_fkey'
      AND table_name = 'cash_transactions'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.cash_transactions
      ADD CONSTRAINT cash_transactions_related_loan_id_fkey
      FOREIGN KEY (related_loan_id) REFERENCES public.loans(id) ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists idx_clients_workspace_key on public.clients(workspace_key);
create index if not exists idx_payments_workspace_key on public.payments(workspace_key);
create index if not exists idx_expenses_workspace_key on public.expenses(workspace_key);
create index if not exists idx_payment_schedules_workspace_key on public.payment_schedules(workspace_key);
create index if not exists idx_events_workspace_key on public.events(workspace_key);
create index if not exists idx_cash_transactions_workspace_key on public.cash_transactions(workspace_key);
create index if not exists idx_loans_workspace_key on public.loans(workspace_key);
create index if not exists idx_personal_records_workspace_key on public.personal_records(workspace_key);

create index if not exists idx_clients_status on public.clients(case_status);
create index if not exists idx_clients_deadline on public.clients(payment_deadline);
create index if not exists idx_payments_client_id on public.payments(client_id);
create index if not exists idx_payments_channel on public.payments(payment_channel);
create index if not exists idx_expenses_client_id on public.expenses(client_id);
create index if not exists idx_expenses_channel on public.expenses(payment_channel);
create index if not exists idx_payment_schedules_client_id on public.payment_schedules(client_id);
create index if not exists idx_events_event_date on public.events(event_date);
create index if not exists idx_events_client_id on public.events(client_id);
create index if not exists idx_cash_transactions_entry_date on public.cash_transactions(entry_date);
create index if not exists idx_cash_transactions_flow_type on public.cash_transactions(flow_type);
create index if not exists idx_cash_transactions_account_type on public.cash_transactions(account_type);
create index if not exists idx_cash_transactions_related_loan on public.cash_transactions(related_loan_id);
create index if not exists idx_loans_issue_date on public.loans(issue_date);
create index if not exists idx_personal_records_person on public.personal_records(person_name);
create index if not exists idx_personal_records_date on public.personal_records(record_date);

DROP TRIGGER IF EXISTS trg_clients_set_updated_at ON public.clients;
create trigger trg_clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.events enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.loans enable row level security;
alter table public.personal_records enable row level security;

-- ВАЖНО:
-- Эти политики открывают таблицы для роли anon, потому что приложение работает как статический сайт на GitHub Pages
-- без полноценной авторизации. Это удобно для запуска, но НЕ является надежной защитой данных.
-- Для реальной защиты позже лучше перейти на Supabase Auth и закрытые RLS-политики.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clients' and policyname = 'anon full access clients'
  ) then
    create policy "anon full access clients" on public.clients
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'anon full access payments'
  ) then
    create policy "anon full access payments" on public.payments
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses' and policyname = 'anon full access expenses'
  ) then
    create policy "anon full access expenses" on public.expenses
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_schedules' and policyname = 'anon full access payment_schedules'
  ) then
    create policy "anon full access payment_schedules" on public.payment_schedules
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'anon full access events'
  ) then
    create policy "anon full access events" on public.events
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cash_transactions' and policyname = 'anon full access cash_transactions'
  ) then
    create policy "anon full access cash_transactions" on public.cash_transactions
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'loans' and policyname = 'anon full access loans'
  ) then
    create policy "anon full access loans" on public.loans
    for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'personal_records' and policyname = 'anon full access personal_records'
  ) then
    create policy "anon full access personal_records" on public.personal_records
    for all to anon using (true) with check (true);
  end if;
end $$;
