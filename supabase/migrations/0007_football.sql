-- Faz 3 / 0007 — Futbol katmanı: oyuncu kartları, maç motoru
-- Oyuncular da birer "asset"; fiyatları piyasa motorundan geçer.
-- Tek para birimi: ₺

-- ---------------------------------------------------------------------------
-- 1) Varlık kategorisine "player" ekle
-- ---------------------------------------------------------------------------
alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets
  add constraint assets_category_check
  check (category in ('stock', 'index', 'commodity', 'bond', 'crypto', 'fund', 'player'));

-- ---------------------------------------------------------------------------
-- 1b) Defter türüne maç ödülünü ekle
-- ---------------------------------------------------------------------------
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger
  add constraint ledger_kind_check
  check (kind in ('transfer_in', 'transfer_out', 'mission_reward', 'admin_grant', 'match_reward'));

-- ---------------------------------------------------------------------------
-- 2) Oyuncu istatistikleri
-- ---------------------------------------------------------------------------
create table if not exists public.player_stats (
  asset_id       uuid primary key references public.assets (id) on delete cascade,
  position       text not null,
  position_group text not null check (position_group in ('GK', 'DEF', 'MID', 'FWD')),
  overall        integer not null check (overall between 1 and 99),
  pace           integer check (pace between 1 and 99),
  physical       integer check (physical between 1 and 99),
  dribbling      integer check (dribbling between 1 and 99),
  passing        integer check (passing between 1 and 99),
  shooting       integer check (shooting between 1 and 99),
  defending      integer check (defending between 1 and 99),
  gk_diving      integer check (gk_diving between 1 and 99),
  gk_handling    integer check (gk_handling between 1 and 99),
  gk_kicking     integer check (gk_kicking between 1 and 99),
  gk_reflexes    integer check (gk_reflexes between 1 and 99),
  gk_speed       integer check (gk_speed between 1 and 99),
  gk_positioning integer check (gk_positioning between 1 and 99),
  club           text,
  nationality    text,
  age            integer check (age between 14 and 50),
  matches        integer not null default 0 check (matches >= 0),
  goals          integer not null default 0 check (goals >= 0),
  assists        integer not null default 0 check (assists >= 0),
  rating_sum     numeric(10, 2) not null default 0,
  rating_count   integer not null default 0,
  form           numeric(5, 2) not null default 0,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) Maçlar
-- ---------------------------------------------------------------------------
create table if not exists public.career_matches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  opponent     text not null,
  goals_for    integer not null check (goals_for >= 0),
  goals_against integer not null check (goals_against >= 0),
  result       text not null check (result in ('win', 'draw', 'loss')),
  reward       numeric(15, 2) not null check (reward >= 0),
  squad_size   integer not null default 0,
  squad_rating numeric(4, 2),
  played_at    timestamptz not null default now()
);

create index if not exists career_matches_user_idx
  on public.career_matches (user_id, played_at desc);

create table if not exists public.match_events (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.career_matches (id) on delete cascade,
  minute     integer not null check (minute between 1 and 120),
  event_type text not null check (event_type in ('goal', 'assist', 'save', 'card')),
  asset_id   uuid references public.assets (id) on delete set null,
  player_name text,
  detail     text
);

create index if not exists match_events_match_idx on public.match_events (match_id, minute);

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
alter table public.player_stats    enable row level security;
alter table public.career_matches  enable row level security;
alter table public.match_events    enable row level security;

drop policy if exists "player_stats_read" on public.player_stats;
create policy "player_stats_read" on public.player_stats
  for select to authenticated using (true);

drop policy if exists "career_matches_select_own" on public.career_matches;
create policy "career_matches_select_own" on public.career_matches
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "match_events_select_own" on public.match_events;
create policy "match_events_select_own" on public.match_events
  for select to authenticated
  using (exists (
    select 1 from public.career_matches m
    where m.id = match_events.match_id and m.user_id = (select auth.uid())
  ));

revoke insert, update, delete on public.player_stats, public.career_matches, public.match_events
  from anon, authenticated;

grant select on public.player_stats, public.career_matches, public.match_events to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Maç motoru (sunucu otoritesi)
-- ---------------------------------------------------------------------------
create or replace function public.play_match()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_opponent text;
  v_size     integer;
  v_strength numeric;
  v_gf       integer;
  v_ga       integer;
  v_result   text;
  v_reward   numeric(15, 2);
  v_match    uuid;
  v_rating   numeric(4, 2);
  v_player   record;
  v_pick     record;
  v_events   jsonb := '[]'::jsonb;
  v_goals    jsonb := '[]'::jsonb;
  v_i        integer;
  v_minute   integer;
  v_opponents text[] := array[
    'Kartal SK', 'Boğaziçi United', 'Anadolu FK', 'Ege Spor', 'Karadeniz 1967',
    'Marmara City', 'Toros United', 'Balkan SK', 'Akdeniz FK', 'Başkent Gücü'
  ];
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  select count(*), avg(ps.overall)
    into v_size, v_strength
  from public.portfolios p
  join public.assets a on a.id = p.asset_id
  join public.player_stats ps on ps.asset_id = a.id
  where p.user_id = v_uid and a.category = 'player' and p.shares > 0;

  if coalesce(v_size, 0) < 5 then
    raise exception 'Maça çıkmak için en az 5 oyuncu gerekli.';
  end if;

  v_opponent := v_opponents[1 + floor(random() * array_length(v_opponents, 1))::int];

  -- Basit güç modeli: kadro ortalaması skoru belirler, rastgelelik eklenir
  v_gf := greatest(0, floor((v_strength - 62) / 6.0 + random() * 2.6)::int);
  v_ga := greatest(0, floor((72 - v_strength) / 8.0 + random() * 2.2)::int);
  v_gf := least(v_gf, 7);
  v_ga := least(v_ga, 7);

  if v_gf > v_ga then
    v_result := 'win';
    v_reward := 900;
  elsif v_gf = v_ga then
    v_result := 'draw';
    v_reward := 450;
  else
    v_result := 'loss';
    v_reward := 150;
  end if;

  insert into public.career_matches (user_id, opponent, goals_for, goals_against, result, reward, squad_size, squad_rating)
  values (v_uid, v_opponent, v_gf, v_ga, v_result, v_reward, v_size, round(v_strength, 2))
  returning id into v_match;

  -- Goller: şut yeteneğine göre ağırlıklı oyuncu seçimi
  for v_i in 1..v_gf loop
    select p.asset_id, a.name, a.symbol, ps.shooting, ps.position_group
      into v_pick
    from public.portfolios p
    join public.assets a on a.id = p.asset_id
    join public.player_stats ps on ps.asset_id = a.id
    where p.user_id = v_uid and a.category = 'player' and ps.position_group <> 'GK'
    order by (coalesce(ps.shooting, 50) + random() * 25) desc
    limit 1;

    v_minute := 1 + floor(random() * 90)::int;

    if v_pick is not null then
      insert into public.match_events (match_id, minute, event_type, asset_id, player_name)
      values (v_match, v_minute, 'goal', v_pick.asset_id, v_pick.name);

      v_events := v_events || jsonb_build_object('minute', v_minute, 'type', 'goal', 'player', v_pick.name);
      v_goals := v_goals || jsonb_build_object('player', v_pick.name, 'minute', v_minute);

      update public.player_stats set goals = goals + 1 where asset_id = v_pick.asset_id;
      update public.assets
         set current_price = greatest(round(current_price * 1.012, 2), 0.01),
             updated_at = now()
       where id = v_pick.asset_id;
    end if;
  end loop;

  -- Tüm kadro: maç, reyting, form
  for v_player in
    select p.asset_id, ps.rating_sum, ps.rating_count
    from public.portfolios p
    join public.player_stats ps on ps.asset_id = p.asset_id
    where p.user_id = v_uid
  loop
    v_rating := round(least(9.9, greatest(4.0, 6.2 + random() * 2.4 + (v_gf - v_ga) * 0.12))::numeric, 1);

    update public.player_stats
       set matches = matches + 1,
           rating_sum = rating_sum + v_rating,
           rating_count = rating_count + 1,
           form = round(((rating_sum + v_rating) / (rating_count + 1)) - 6.5, 2),
           updated_at = now()
     where asset_id = v_player.asset_id;
  end loop;

  update public.profiles set cash_balance = cash_balance + v_reward where id = v_uid;

  insert into public.ledger (user_id, amount, kind, note)
  values (v_uid, v_reward, 'match_reward', 'Maç ödülü: ' || v_opponent);

  return jsonb_build_object(
    'match_id', v_match,
    'opponent', v_opponent,
    'goals_for', v_gf,
    'goals_against', v_ga,
    'result', v_result,
    'reward', v_reward,
    'squad_size', v_size,
    'squad_rating', round(v_strength, 2),
    'events', v_events
  );
end;
$$;

revoke execute on function public.play_match() from public, anon;
grant execute on function public.play_match() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Oyuncu kartları (Firebase initial-data.json'dan, ₺ fiyatla)
-- ---------------------------------------------------------------------------
insert into public.assets (symbol, name, category, current_price, previous_close, volatility)
values
  ('TUNA',     'Tuna AS',         'player', 4360.00, 4360.00, 0.0180),
  ('ENES',     'Enes T. E.',      'player', 3520.00, 3520.00, 0.0200),
  ('YAGIZ',    'Yağız E. S.',     'player', 3280.00, 3280.00, 0.0190),
  ('MEHMET',   'Mehmet Ç.',       'player', 3280.00, 3280.00, 0.0190),
  ('AYHAN',    'Ayhan E. B.',     'player', 3400.00, 3400.00, 0.0210),
  ('EGE',      'Ege Çelik',       'player', 3040.00, 3040.00, 0.0200),
  ('SAMI',     'Sami Y. Y.',      'player', 2800.00, 2800.00, 0.0180),
  ('YUSUFC',   'Yusuf Çiçek',     'player', 2320.00, 2320.00, 0.0190),
  ('YUSUFK',   'Yusuf Kıcı',      'player', 2320.00, 2320.00, 0.0190),
  ('FURKAN',   'Furkan Kuru',     'player', 1120.00, 1120.00, 0.0230),
  ('BERKAY',   'Berkay Bulunmaz', 'player', 1840.00, 1840.00, 0.0210),
  ('PUSAT',    'Pusat',           'player', 2800.00, 2800.00, 0.0170),
  ('DALYAN',   'Dalyan',          'player', 2920.00, 2920.00, 0.0170),
  ('SAMET',    'Samet A. Dal',    'player', 2080.00, 2080.00, 0.0180)
on conflict (symbol) do nothing;

insert into public.player_stats (
  asset_id, position, position_group, overall, pace, physical, dribbling, passing, shooting, defending,
  gk_diving, gk_handling, gk_kicking, gk_reflexes, gk_speed, gk_positioning, club, age
)
select a.id, v.position, v.grp, v.overall, v.pace, v.physical, v.dribbling, v.passing, v.shooting, v.defending,
       v.gk_diving, v.gk_handling, v.gk_kicking, v.gk_reflexes, v.gk_speed, v.gk_positioning, '11B FC', v.age
from (values
  ('TUNA',   'STP', 'DEF', 88, 86, 88, 86, 86, 89, 92, null, null, null, null, null, null, 24),
  ('ENES',   'SĞA', 'MID', 81, 90, 68, 87, 85, 84, 70, null, null, null, null, null, null, 22),
  ('YAGIZ',  'DOS', 'MID', 79, 81, 80, 77, 80, 77, 81, null, null, null, null, null, null, 23),
  ('MEHMET', 'SLA', 'MID', 79, 78, 75, 82, 80, 83, 75, null, null, null, null, null, null, 22),
  ('AYHAN',  'SF',  'FWD', 80, 78, 83, 76, 75, 84, 82, null, null, null, null, null, null, 25),
  ('EGE',    'SLK', 'MID', 77, 76, 82, 77, 79, 74, 71, null, null, null, null, null, null, 21),
  ('SAMI',   'STP', 'DEF', 75, 77, 86, 63, 69, 65, 87, null, null, null, null, null, null, 26),
  ('YUSUFC', 'STP', 'DEF', 71, 73, 73, 63, 70, 66, 82, null, null, null, null, null, null, 22),
  ('YUSUFK', 'SF',  'FWD', 71, 78, 80, 55, 70, 64, 79, null, null, null, null, null, null, 23),
  ('FURKAN', 'STP', 'DEF', 61, 70, 60, 55, 58, 60, 60, null, null, null, null, null, null, 20),
  ('BERKAY', 'STP', 'DEF', 67, 71, 81, 42, 65, 68, 76, null, null, null, null, null, null, 21),
  ('PUSAT',  'KLC', 'GK',  75, null, null, null, null, null, null, 75, 75, 75, 75, 75, 75, 27),
  ('DALYAN', 'KLC', 'GK',  76, null, null, null, null, null, null, 75, 76, 77, 80, 78, 69, 25),
  ('SAMET',  'KLC', 'GK',  69, null, null, null, null, null, null, 65, 65, 70, 68, 70, 73, 22)
) as v(symbol, position, grp, overall, pace, physical, dribbling, passing, shooting, defending,
       gk_diving, gk_handling, gk_kicking, gk_reflexes, gk_speed, gk_positioning, age)
join public.assets a on a.symbol = v.symbol
on conflict (asset_id) do nothing;

-- Oyuncu fiyatları için de geçmiş üret
insert into public.price_history (asset_id, price, recorded_at)
select a.id, a.current_price, now() - make_interval(days => i)
from public.assets a
cross join generate_series(0, 14) as i
where a.category = 'player'
  and not exists (
    select 1 from public.price_history ph where ph.asset_id = a.id
  );
