-- Faz 1 / 0002 — Row Level Security
-- Temel ilke: istemci SADECE okur. Tüm yazma işlemleri SECURITY DEFINER RPC'lerden geçer.
-- profiles.cash_balance istemci tarafından hiçbir koşulda güncellenemez (kolon yetkisi).

alter table public.profiles      enable row level security;
alter table public.assets        enable row level security;
alter table public.portfolios    enable row level security;
alter table public.transactions  enable row level security;
alter table public.price_history enable row level security;
alter table public.news          enable row level security;
alter table public.scenarios     enable row level security;
alter table public.seasons       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_own_username" on public.profiles;
create policy "profiles_update_own_username"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Kolon düzeyi yetki: sadece username güncellenebilir.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- assets / price_history / news / scenarios / seasons — herkese açık okuma
-- ---------------------------------------------------------------------------
drop policy if exists "assets_read_all" on public.assets;
create policy "assets_read_all"
  on public.assets for select
  to authenticated
  using (true);

drop policy if exists "price_history_read_all" on public.price_history;
create policy "price_history_read_all"
  on public.price_history for select
  to authenticated
  using (true);

drop policy if exists "news_read_all" on public.news;
create policy "news_read_all"
  on public.news for select
  to authenticated
  using (true);

drop policy if exists "scenarios_read_all" on public.scenarios;
create policy "scenarios_read_all"
  on public.scenarios for select
  to authenticated
  using (true);

drop policy if exists "seasons_read_all" on public.seasons;
create policy "seasons_read_all"
  on public.seasons for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- portfolios / transactions — sadece kendi satırları, sadece okuma
-- ---------------------------------------------------------------------------
drop policy if exists "portfolios_select_own" on public.portfolios;
create policy "portfolios_select_own"
  on public.portfolios for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.portfolios  from anon, authenticated;
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.assets       from anon, authenticated;
revoke insert, update, delete on public.price_history from anon, authenticated;
revoke insert, update, delete on public.news         from anon, authenticated;
revoke insert, update, delete on public.scenarios    from anon, authenticated;
revoke insert, update, delete on public.seasons      from anon, authenticated;

-- anon rolü hiçbir oyun verisini okumaz.
revoke all on public.profiles, public.assets, public.portfolios, public.transactions,
  public.price_history, public.news, public.scenarios, public.seasons from anon;

grant select on public.profiles, public.assets, public.portfolios, public.transactions,
  public.price_history, public.news, public.scenarios, public.seasons to authenticated;
