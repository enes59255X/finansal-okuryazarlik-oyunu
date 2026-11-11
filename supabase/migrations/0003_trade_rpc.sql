-- Faz 1 / 0003 — Hile korumalı alım/satım motoru
-- Tüm fonksiyonlar SECURITY DEFINER + kilitli okuma (FOR UPDATE) kullanır.

-- ---------------------------------------------------------------------------
-- Yardımcı: admin kontrolü (Faz 2'de admin RPC'lerinde kullanılacak)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- ALIM
-- ---------------------------------------------------------------------------
create or replace function public.buy_asset(p_asset_id uuid, p_shares numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_price   numeric(15, 2);
  v_total   numeric(15, 2);
  v_cash    numeric(15, 2);
  v_shares  numeric(15, 4) := round(p_shares, 4);
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if v_shares is null or v_shares <= 0 then
    raise exception 'Adet sıfırdan büyük olmalıdır.';
  end if;

  -- Varlık satırını kilitle: işlem sırasında fiyat değişmesin
  select current_price into v_price
  from public.assets
  where id = p_asset_id and is_active
  for update;

  if v_price is null then
    raise exception 'Varlık bulunamadı veya işleme kapalı.';
  end if;

  v_total := round(v_price * v_shares, 2);

  if v_total <= 0 then
    raise exception 'İşlem tutarı geçersiz.';
  end if;

  -- Bakiyeyi kilitle
  select cash_balance into v_cash
  from public.profiles
  where id = v_user_id
  for update;

  if v_cash is null then
    raise exception 'Profil bulunamadı.';
  end if;

  if v_cash < v_total then
    raise exception 'Yetersiz bakiye. Gereken: %, mevcut: %', v_total, v_cash;
  end if;

  update public.profiles
  set cash_balance = cash_balance - v_total
  where id = v_user_id;

  insert into public.portfolios as p (user_id, asset_id, shares, average_buy_price, updated_at)
  values (v_user_id, p_asset_id, v_shares, v_price, now())
  on conflict (user_id, asset_id) do update
  set average_buy_price = round(
        ((p.shares * p.average_buy_price) + (v_price * v_shares)) / (p.shares + v_shares), 2
      ),
      shares    = p.shares + v_shares,
      updated_at = now();

  insert into public.transactions (user_id, asset_id, side, shares, price, total)
  values (v_user_id, p_asset_id, 'buy', v_shares, v_price, v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- SATIM
-- ---------------------------------------------------------------------------
create or replace function public.sell_asset(p_asset_id uuid, p_shares numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_price   numeric(15, 2);
  v_total   numeric(15, 2);
  v_avg     numeric(15, 2);
  v_owned   numeric(15, 4);
  v_remain  numeric(15, 4);
  v_pnl     numeric(15, 2);
  v_shares  numeric(15, 4) := round(p_shares, 4);
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if v_shares is null or v_shares <= 0 then
    raise exception 'Adet sıfırdan büyük olmalıdır.';
  end if;

  select current_price into v_price
  from public.assets
  where id = p_asset_id and is_active
  for update;

  if v_price is null then
    raise exception 'Varlık bulunamadı veya işleme kapalı.';
  end if;

  select shares, average_buy_price into v_owned, v_avg
  from public.portfolios
  where user_id = v_user_id and asset_id = p_asset_id
  for update;

  if v_owned is null or v_owned <= 0 then
    raise exception 'Bu varlıkta pozisyonunuz yok.';
  end if;

  if v_shares > v_owned then
    raise exception 'Yetersiz adet. Elinizde: %', v_owned;
  end if;

  v_total  := round(v_price * v_shares, 2);
  v_pnl    := round((v_price - v_avg) * v_shares, 2);
  v_remain := round(v_owned - v_shares, 4);

  update public.profiles
  set cash_balance = cash_balance + v_total
  where id = v_user_id;

  if v_remain = 0 then
    delete from public.portfolios where user_id = v_user_id and asset_id = p_asset_id;
  else
    update public.portfolios
    set shares = v_remain, updated_at = now()
    where user_id = v_user_id and asset_id = p_asset_id;
  end if;

  insert into public.transactions (user_id, asset_id, side, shares, price, total, realized_pnl)
  values (v_user_id, p_asset_id, 'sell', v_shares, v_price, v_total, v_pnl);
end;
$$;

-- ---------------------------------------------------------------------------
-- LİDERLİK TABLOSU (profiles satırları sızdırılmadan)
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_limit int default 50)
returns table (
  rank          bigint,
  user_id       uuid,
  username      text,
  cash_balance  numeric,
  invested      numeric,
  equity        numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with holdings as (
    select p.id,
           p.username,
           p.cash_balance,
           coalesce(sum(pt.shares * a.current_price), 0)::numeric as invested
    from public.profiles p
    left join public.portfolios pt on pt.user_id = p.id
    left join public.assets a on a.id = pt.asset_id
    where p.role = 'player'
    group by p.id, p.username, p.cash_balance
  )
  select row_number() over (order by (cash_balance + invested) desc) as rank,
         id,
         username,
         cash_balance,
         round(invested, 2),
         round(cash_balance + invested, 2)
  from holdings
  order by (cash_balance + invested) desc
  limit least(coalesce(p_limit, 50), 200);
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler: sadece giriş yapmış oyuncular
-- ---------------------------------------------------------------------------
revoke execute on function public.buy_asset(uuid, numeric)   from public, anon;
revoke execute on function public.sell_asset(uuid, numeric)  from public, anon;
revoke execute on function public.get_leaderboard(int)       from public, anon;
revoke execute on function public.is_admin()                 from public, anon;

grant execute on function public.buy_asset(uuid, numeric)  to authenticated;
grant execute on function public.sell_asset(uuid, numeric) to authenticated;
grant execute on function public.get_leaderboard(int)      to authenticated;
grant execute on function public.is_admin()                to authenticated;
