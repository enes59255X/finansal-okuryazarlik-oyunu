-- Faz 2 / 0005 — Piyasa motoru, görevler, para transferi, admin
-- Tüm yazma işlemleri SECURITY DEFINER RPC'lerde; tablolar istemciye salt-okunur.

-- ---------------------------------------------------------------------------
-- 1) Varlık kategorilerine "fund" ekle
-- ---------------------------------------------------------------------------
alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets
  add constraint assets_category_check
  check (category in ('stock', 'index', 'commodity', 'bond', 'crypto', 'fund'));

-- ---------------------------------------------------------------------------
-- 2) Haber alanları
-- ---------------------------------------------------------------------------
alter table public.news
  add column if not exists kind text not null default 'macro'
    check (kind in ('macro', 'stock', 'index', 'commodity', 'bond', 'crypto', 'fund')),
  add column if not exists related_symbols text[] not null default '{}',
  add column if not exists source text;

create index if not exists news_published_idx on public.news (published_at desc);

-- ---------------------------------------------------------------------------
-- 3) Oyun durumu (tek satır) — gerçek zaman + admin hız çarpanı
-- ---------------------------------------------------------------------------
create table if not exists public.game_state (
  id          boolean primary key default true check (id),
  time_scale  numeric(8, 2) not null default 1 check (time_scale between 1 and 1440),
  tick_seconds integer not null default 60 check (tick_seconds between 10 and 3600),
  last_tick_at timestamptz not null default now(),
  game_started_at timestamptz not null default now(),
  trading_open boolean not null default true,
  updated_at  timestamptz not null default now()
);

insert into public.game_state (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) Nakit hareketleri defteri (denetim izi)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(15, 2) not null check (amount <> 0),
  kind       text not null check (kind in ('transfer_in', 'transfer_out', 'mission_reward', 'admin_grant')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists ledger_user_idx on public.ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Oyuncular arası transfer
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(15, 2) not null check (amount > 0),
  note       text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists transfers_from_idx on public.transfers (from_user, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) Görevler
-- ---------------------------------------------------------------------------
create table if not exists public.missions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  title       text not null,
  description text not null,
  reward      numeric(15, 2) not null check (reward > 0 and reward <= 1000),
  kind        text not null check (kind in ('trade', 'diversify', 'profit', 'crisis')),
  target      integer not null default 1 check (target > 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create table if not exists public.player_missions (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  mission_id   uuid not null references public.missions (id) on delete cascade,
  progress     integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at   timestamptz,
  primary key (user_id, mission_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.game_state      enable row level security;
alter table public.ledger          enable row level security;
alter table public.transfers       enable row level security;
alter table public.missions        enable row level security;
alter table public.player_missions enable row level security;

drop policy if exists "game_state_read" on public.game_state;
create policy "game_state_read" on public.game_state
  for select to authenticated using (true);

drop policy if exists "ledger_select_own" on public.ledger;
create policy "ledger_select_own" on public.ledger
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "transfers_select_own" on public.transfers;
create policy "transfers_select_own" on public.transfers
  for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));

drop policy if exists "missions_read" on public.missions;
create policy "missions_read" on public.missions
  for select to authenticated using (true);

drop policy if exists "player_missions_select_own" on public.player_missions;
create policy "player_missions_select_own" on public.player_missions
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.game_state, public.ledger, public.transfers,
  public.missions, public.player_missions from anon, authenticated;

grant select on public.game_state, public.ledger, public.transfers,
  public.missions, public.player_missions to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Piyasa motoru
-- ---------------------------------------------------------------------------
create or replace function public.tick_market(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state    public.game_state;
  v_elapsed  numeric;
  v_ticks    integer;
  v_asset    record;
  v_price    numeric;
  v_step     numeric;
  v_i        integer;
  v_day_ago  interval;
begin
  if coalesce(p_force, false) and not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select * into v_state from public.game_state where id for update;

  v_elapsed := extract(epoch from (now() - v_state.last_tick_at));
  v_ticks := floor(v_elapsed / v_state.tick_seconds)::integer;

  if not coalesce(p_force, false) and v_ticks < 1 then
    return 0;
  end if;

  v_ticks := least(greatest(v_ticks, 1), 30);
  v_day_ago := make_interval(secs => (86400.0 / v_state.time_scale)::double precision);

  for v_asset in
    select id, current_price, volatility
    from public.assets
    where is_active
    for update
  loop
    v_price := v_asset.current_price;

    for v_i in 1..v_ticks loop
      -- yaklaşık normal dağılım: 3 uniform toplamı
      v_step := v_asset.volatility * 0.25 * sqrt(v_state.time_scale)
                * ((random() + random() + random() - 1.5) / 1.5);
      v_price := v_price * (1 + v_step);
      if v_price < 0.01 then
        v_price := 0.01;
      end if;
    end loop;

    update public.assets
    set current_price = round(v_price, 2),
        previous_close = coalesce(
          (select ph.price
             from public.price_history ph
            where ph.asset_id = v_asset.id
              and ph.recorded_at <= now() - v_day_ago
            order by ph.recorded_at desc
            limit 1),
          previous_close),
        updated_at = now()
    where id = v_asset.id;

    insert into public.price_history (asset_id, price)
    values (v_asset.id, round(v_price, 2));
  end loop;

  update public.game_state
  set last_tick_at = last_tick_at + make_interval(secs => v_ticks * v_state.tick_seconds),
      updated_at = now()
  where id;

  return v_ticks;
end;
$$;

-- Oyun saati: başlangıçtan bu yana geçen gerçek süre * hız çarpanı
create or replace function public.current_game_time()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select gs.game_started_at
         + (now() - gs.game_started_at) * (gs.time_scale::double precision)
  from public.game_state gs
  where gs.id;
$$;

-- ---------------------------------------------------------------------------
-- 8) Görev değerlendirme (idempotent, sunucu tarafı)
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_missions()
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_mission record;
  v_progress integer;
  v_done    boolean;
begin
  if v_uid is null then
    return;
  end if;

  for v_mission in
    select * from public.missions where is_active order by sort_order
  loop
    if v_mission.code = 'first_trade' then
      select count(*) into v_progress from public.transactions where user_id = v_uid;

    elsif v_mission.code = 'diversify_3' then
      select count(distinct a.category) into v_progress
      from public.portfolios p
      join public.assets a on a.id = p.asset_id
      where p.user_id = v_uid and p.shares > 0;

    elsif v_mission.code = 'holdings_5' then
      select count(*) into v_progress
      from public.portfolios where user_id = v_uid and shares > 0;

    elsif v_mission.code = 'profit_sell' then
      select count(*) into v_progress
      from public.transactions
      where user_id = v_uid and side = 'sell' and realized_pnl > 0;

    elsif v_mission.code = 'crisis_trade' then
      select count(*) into v_progress
      from public.transactions t
      where t.user_id = v_uid
        and exists (
          select 1 from public.scenarios s
          where s.triggered_at is not null and t.created_at >= s.triggered_at
        );

    else
      v_progress := 0;
    end if;

    insert into public.player_missions (user_id, mission_id, progress)
    values (v_uid, v_mission.id, v_progress)
    on conflict (user_id, mission_id) do update
      set progress = greatest(public.player_missions.progress, excluded.progress);

    v_done := false;

    update public.player_missions pm
       set completed_at = now(), claimed_at = now()
     where pm.user_id = v_uid
       and pm.mission_id = v_mission.id
       and pm.completed_at is null
       and v_progress >= v_mission.target
    returning true into v_done;

    if coalesce(v_done, false) then
      update public.profiles
         set cash_balance = cash_balance + v_mission.reward
       where id = v_uid;

      insert into public.ledger (user_id, amount, kind, note)
      values (v_uid, v_mission.reward, 'mission_reward', 'Görev: ' || v_mission.title);

      return next v_mission.code;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) Para transferi
-- ---------------------------------------------------------------------------
create or replace function public.transfer_cash(
  p_to_username text,
  p_amount      numeric,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from  uuid := (select auth.uid());
  v_to    uuid;
  v_amt   numeric(15, 2) := round(p_amount, 2);
  v_cash  numeric(15, 2);
  v_daily numeric(15, 2);
  v_from_name text;
begin
  if v_from is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if v_amt is null or v_amt < 1 then
    raise exception 'Tutar en az 1 ₺ olmalıdır.';
  end if;

  if v_amt > 5000 then
    raise exception 'Tek işlemde en fazla 5.000 ₺ gönderilebilir.';
  end if;

  select id into v_to
  from public.profiles
  where lower(username) = lower(trim(p_to_username));

  if v_to is null then
    raise exception 'Alıcı bulunamadı.';
  end if;

  if v_to = v_from then
    raise exception 'Kendine para gönderemezsin.';
  end if;

  select coalesce(sum(amount), 0) into v_daily
  from public.transfers
  where from_user = v_from and created_at > now() - interval '1 day';

  if v_daily + v_amt > 20000 then
    raise exception 'Günlük gönderim limiti (20.000 ₺) aşıldı.';
  end if;

  -- Deadlock önleme: kilitleri sabit sırayla al
  perform 1 from public.profiles
  where id in (v_from, v_to)
  order by id
  for update;

  select cash_balance, username into v_cash, v_from_name
  from public.profiles where id = v_from;

  if v_cash < v_amt then
    raise exception 'Yetersiz bakiye.';
  end if;

  update public.profiles set cash_balance = cash_balance - v_amt where id = v_from;
  update public.profiles set cash_balance = cash_balance + v_amt where id = v_to;

  insert into public.transfers (from_user, to_user, amount, note)
  values (v_from, v_to, v_amt, nullif(trim(p_note), ''));

  insert into public.ledger (user_id, amount, kind, note)
  values (v_from, -v_amt, 'transfer_out', 'Alıcı: ' || p_to_username);

  insert into public.ledger (user_id, amount, kind, note)
  values (v_to, v_amt, 'transfer_in', 'Gönderen: ' || v_from_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) Admin RPC'leri (her biri is_admin() kontrolü yapar)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_time_scale(p_scale numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;
  if p_scale is null or p_scale < 1 or p_scale > 1440 then
    raise exception 'Hız çarpanı 1 ile 1440 arasında olmalıdır.';
  end if;

  update public.game_state
     set time_scale = round(p_scale, 2), updated_at = now()
   where id;
end;
$$;

create or replace function public.admin_tick_now()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;
  return public.tick_market(true);
end;
$$;

create or replace function public.admin_set_price(p_symbol text, p_price numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  if p_price is null or p_price <= 0 or p_price > 100000000 then
    raise exception 'Geçersiz fiyat.';
  end if;

  update public.assets
     set current_price = round(p_price, 2), updated_at = now()
   where upper(symbol) = upper(trim(p_symbol))
  returning id into v_id;

  if v_id is null then
    raise exception 'Varlık bulunamadı.';
  end if;

  insert into public.price_history (asset_id, price)
  values (v_id, round(p_price, 2));
end;
$$;

create or replace function public.admin_publish_news(
  p_headline text,
  p_body     text default null,
  p_severity text default 'info',
  p_kind     text default 'macro',
  p_symbols  text[] default '{}',
  p_source   text default 'Piyasa Akademi'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  if p_headline is null or char_length(trim(p_headline)) < 5 then
    raise exception 'Başlık en az 5 karakter olmalıdır.';
  end if;

  p_severity := coalesce(p_severity, 'info');
  p_kind := coalesce(p_kind, 'macro');

  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Geçersiz önem derecesi.';
  end if;

  if p_kind not in ('macro', 'stock', 'index', 'commodity', 'bond', 'crypto', 'fund') then
    raise exception 'Geçersiz haber türü.';
  end if;

  insert into public.news (headline, body, severity, kind, related_symbols, source, published_by)
  values (trim(p_headline), nullif(trim(p_body), ''), p_severity, p_kind,
          coalesce(p_symbols, '{}'), nullif(trim(p_source), ''), (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_trigger_scenario(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_effects jsonb;
  v_title   text;
  v_desc    text;
  v_asset   record;
  v_pct     numeric;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select effects, title, description into v_effects, v_title, v_desc
  from public.scenarios
  where code = p_code and is_active;

  if v_effects is null then
    raise exception 'Senaryo bulunamadı.';
  end if;

  for v_asset in
    select id, symbol, category, current_price
    from public.assets
    where is_active
    for update
  loop
    v_pct := coalesce((v_effects ->> v_asset.symbol)::numeric, 0)
           + coalesce((v_effects ->> ('cat:' || v_asset.category))::numeric, 0);

    if v_pct <> 0 then
      update public.assets
         set current_price = greatest(round(current_price * (1 + v_pct), 2), 0.01),
             updated_at = now()
       where id = v_asset.id;

      insert into public.price_history (asset_id, price)
      select id, current_price from public.assets where id = v_asset.id;
    end if;
  end loop;

  update public.scenarios
     set triggered_at = now(), triggered_by = (select auth.uid())
   where code = p_code;

  insert into public.news (headline, body, severity, kind, related_symbols, source, published_by)
  values (v_title, v_desc, 'critical', 'macro', '{}', 'Kriz Masası', (select auth.uid()));
end;
$$;

create or replace function public.admin_grant_cash(
  p_username text,
  p_amount   numeric,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid;
  v_amt  numeric(15, 2) := round(p_amount, 2);
  v_cash numeric(15, 2);
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  if v_amt is null or v_amt = 0 or abs(v_amt) > 100000 then
    raise exception 'Geçersiz tutar.';
  end if;

  select id into v_uid from public.profiles where lower(username) = lower(trim(p_username));

  if v_uid is null then
    raise exception 'Oyuncu bulunamadı.';
  end if;

  select cash_balance into v_cash from public.profiles where id = v_uid for update;

  if v_cash + v_amt < 0 then
    raise exception 'Bakiye negatife düşemez.';
  end if;

  update public.profiles set cash_balance = cash_balance + v_amt where id = v_uid;

  insert into public.ledger (user_id, amount, kind, note)
  values (v_uid, v_amt, 'admin_grant', coalesce(nullif(trim(p_note), ''), 'Admin düzenlemesi'));
end;
$$;

create or replace function public.admin_reset_player(p_username text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select id into v_uid from public.profiles where lower(username) = lower(trim(p_username));

  if v_uid is null then
    raise exception 'Oyuncu bulunamadı.';
  end if;

  update public.profiles set cash_balance = 10000.00 where id = v_uid;
  delete from public.portfolios where user_id = v_uid;
  delete from public.transactions where user_id = v_uid;
  delete from public.player_missions where user_id = v_uid;

  insert into public.ledger (user_id, amount, kind, note)
  values (v_uid, 10000.00, 'admin_grant', 'Hesap sıfırlandı');
end;
$$;

create or replace function public.admin_players()
returns table (
  user_id      uuid,
  username     text,
  cash_balance numeric,
  invested     numeric,
  equity       numeric,
  role         text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.username,
         p.cash_balance,
         round(coalesce(sum(pt.shares * a.current_price), 0), 2),
         round(p.cash_balance + coalesce(sum(pt.shares * a.current_price), 0), 2),
         p.role,
         p.created_at
  from public.profiles p
  left join public.portfolios pt on pt.user_id = p.id
  left join public.assets a on a.id = pt.asset_id
  where public.is_admin()
  group by p.id
  order by p.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 11) Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.tick_market(boolean)          from public, anon;
revoke execute on function public.current_game_time()            from public, anon;
revoke execute on function public.evaluate_missions()            from public, anon;
revoke execute on function public.transfer_cash(text, numeric, text) from public, anon;
revoke execute on function public.admin_set_time_scale(numeric)  from public, anon;
revoke execute on function public.admin_tick_now()               from public, anon;
revoke execute on function public.admin_set_price(text, numeric) from public, anon;
revoke execute on function public.admin_publish_news(text, text, text, text, text[], text) from public, anon;
revoke execute on function public.admin_trigger_scenario(text)   from public, anon;
revoke execute on function public.admin_grant_cash(text, numeric, text) from public, anon;
revoke execute on function public.admin_reset_player(text)       from public, anon;
revoke execute on function public.admin_players()                from public, anon;

grant execute on function public.tick_market(boolean)          to authenticated;
grant execute on function public.current_game_time()            to authenticated;
grant execute on function public.evaluate_missions()            to authenticated;
grant execute on function public.transfer_cash(text, numeric, text) to authenticated;
grant execute on function public.admin_set_time_scale(numeric)  to authenticated;
grant execute on function public.admin_tick_now()               to authenticated;
grant execute on function public.admin_set_price(text, numeric) to authenticated;
grant execute on function public.admin_publish_news(text, text, text, text, text[], text) to authenticated;
grant execute on function public.admin_trigger_scenario(text)   to authenticated;
grant execute on function public.admin_grant_cash(text, numeric, text) to authenticated;
grant execute on function public.admin_reset_player(text)       to authenticated;
grant execute on function public.admin_players()                to authenticated;

-- ---------------------------------------------------------------------------
-- 12) Görev tanımları
-- ---------------------------------------------------------------------------
insert into public.missions (code, title, description, reward, kind, target, sort_order)
values
  ('first_trade',  'İlk Adım',        'İlk alımını yap ve piyasaya adım at.',                        50,  'trade',     1, 10),
  ('diversify_3',  'Sepet Yap',       'Farklı 3 kategoriden varlık tut (hisse, emtia, kripto…).',    120, 'diversify', 3, 20),
  ('holdings_5',   'Risk Dağıt',      'Portföyünde 5 farklı varlık bulundur.',                       150, 'diversify', 5, 30),
  ('profit_sell',  'Kâr Realize Et',  'Kârla bir satış gerçekleştir.',                               100, 'profit',    1, 40),
  ('crisis_trade', 'Kriz Avcısı',     'Bir kriz tetiklendikten sonra işlem yap.',                    200, 'crisis',    1, 50)
on conflict (code) do nothing;
