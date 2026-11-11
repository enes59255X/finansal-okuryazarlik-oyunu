-- Faz 1 / 0001 — Şema
-- profiles, assets, portfolios, transactions, price_history, news, scenarios, seasons
-- Not: Tüm parasal alanlar NUMERIC(15,2), adetler NUMERIC(15,4).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null check (char_length(username) between 3 and 24),
  cash_balance  numeric(15, 2) not null default 10000.00 check (cash_balance >= 0),
  role          text not null default 'player' check (role in ('player', 'admin')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Varlıklar
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  symbol          text unique not null,
  name            text not null,
  category        text not null check (category in ('stock', 'index', 'commodity', 'bond', 'crypto')),
  current_price   numeric(15, 2) not null check (current_price > 0),
  previous_close  numeric(15, 2) check (previous_close > 0),
  volatility      numeric(7, 4) not null default 0.0150 check (volatility >= 0 and volatility <= 1),
  is_active       boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Portföy
-- ---------------------------------------------------------------------------
create table if not exists public.portfolios (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  asset_id          uuid not null references public.assets (id) on delete restrict,
  shares            numeric(15, 4) not null default 0 check (shares >= 0),
  average_buy_price numeric(15, 2) not null default 0 check (average_buy_price >= 0),
  updated_at        timestamptz not null default now(),
  unique (user_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- İşlem günlüğü (admin hile denetimi + istatistik)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  asset_id     uuid not null references public.assets (id) on delete restrict,
  side         text not null check (side in ('buy', 'sell')),
  shares       numeric(15, 4) not null check (shares > 0),
  price        numeric(15, 2) not null check (price > 0),
  total        numeric(15, 2) not null check (total > 0),
  realized_pnl numeric(15, 2),
  created_at   timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Fiyat geçmişi (grafikler)
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id          bigint generated always as identity primary key,
  asset_id    uuid not null references public.assets (id) on delete cascade,
  price       numeric(15, 2) not null check (price > 0),
  recorded_at timestamptz not null default now()
);

create index if not exists price_history_asset_time_idx
  on public.price_history (asset_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Haber akışı
-- ---------------------------------------------------------------------------
create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  headline     text not null,
  body         text,
  severity     text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Kriz senaryoları (etkiler jsonb: {"SYMBOL": -0.18, "category:stock": -0.10})
-- ---------------------------------------------------------------------------
create table if not exists public.scenarios (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  title        text not null,
  description  text not null,
  effects      jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  triggered_at timestamptz,
  triggered_by uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Sezonlar / ligler
-- ---------------------------------------------------------------------------
create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  status     text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

-- Tek aktif sezon kuralı
create unique index if not exists seasons_single_active_idx
  on public.seasons (status) where status = 'active';

-- ---------------------------------------------------------------------------
-- Yeni kullanıcı -> profil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  if v_username is null then
    v_username := 'oyuncu_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  -- Çakışmada son 4 karakteri ekle
  if exists (select 1 from public.profiles p where p.username = v_username) then
    v_username := v_username || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.profiles (id, username) values (new.id, v_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
