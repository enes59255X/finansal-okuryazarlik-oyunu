-- Faz 1 doğrulama senaryosu
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ali@example.com', '{"username":"ali"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'veli@example.com', '{"username":"veli"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'ali@example.com', '{"username":"ali"}'::jsonb);

select '--- profiller ---' as step;
select username, cash_balance, role from public.profiles order by username;

select '--- varlık sayısı / geçmiş ---' as step;
select count(*) as assets from public.assets;
select count(*) as history_rows from public.price_history;

select '--- ali 10 THYAO alıyor ---' as step;
select set_config('test.uid', '00000000-0000-0000-0000-000000000001', false);
select public.buy_asset((select id from public.assets where symbol = 'THYAO'), 10);

select '--- ali 5 THYAO daha alıyor ---' as step;
select public.buy_asset((select id from public.assets where symbol = 'THYAO'), 5);

select '--- ali portföy (ağırlıklı ortalama 285.50 olmalı) ---' as step;
select a.symbol, p.shares, p.average_buy_price from public.portfolios p join public.assets a on a.id = p.asset_id;

select '--- ali bakiyesi (10000 - 15*285.50 = 5717.50) ---' as step;
select cash_balance from public.profiles where username = 'ali';

select '--- tamamını satıyor, pozisyon silinmeli ---' as step;
select public.sell_asset((select id from public.assets where symbol = 'THYAO'), 15);
select count(*) as open_positions from public.portfolios;
select cash_balance from public.profiles where username = 'ali';
select side, shares, price, total, realized_pnl from public.transactions order by created_at;

select '--- veli yetersiz bakiye deniyor (hata bekleniyor) ---' as step;
select set_config('test.uid', '00000000-0000-0000-0000-000000000002', false);
do $$
begin
  perform public.buy_asset((select id from public.assets where symbol = 'BTC'), 1);
  raise exception 'BEKLENEN HATA OLUŞMADI: yetersiz bakiye kontrolü çalışmıyor';
exception
  when others then
    if sqlerrm like 'BEKLENEN HATA%' then raise; end if;
    raise notice 'OK, yetersiz bakiye engellendi: %', sqlerrm;
end;
$$;

select '--- veli olmayan pozisyonu satmaya çalışıyor (hata bekleniyor) ---' as step;
do $$
begin
  perform public.sell_asset((select id from public.assets where symbol = 'THYAO'), 1);
  raise exception 'BEKLENEN HATA OLUŞMADI: pozisyon kontrolü çalışmıyor';
exception
  when others then
    if sqlerrm like 'BEKLENEN HATA%' then raise; end if;
    raise notice 'OK, pozisyon yokluğu engellendi: %', sqlerrm;
end;
$$;

select '--- geçersiz adet (hata bekleniyor) ---' as step;
do $$
begin
  perform public.buy_asset((select id from public.assets where symbol = 'THYAO'), 0);
  raise exception 'BEKLENEN HATA OLUŞMADI: adet kontrolü çalışmıyor';
exception
  when others then
    if sqlerrm like 'BEKLENEN HATA%' then raise; end if;
    raise notice 'OK, sıfır adet engellendi: %', sqlerrm;
end;
$$;

select '--- hile denemesi: istemci bakiyeyi doğrudan güncelliyor ---' as step;
do $$
begin
  set local role authenticated;
  update public.profiles set cash_balance = 999999 where username = 'veli';
  reset role;
  raise exception 'BEKLENEN HATA OLUŞMADI: cash_balance doğrudan güncellenebildi!';
exception
  when insufficient_privilege then
    reset role;
    raise notice 'OK, doğrudan bakiye güncellemesi engellendi.';
  when others then
    reset role;
    if sqlerrm like 'BEKLENEN HATA%' then raise; end if;
    raise notice 'OK, bakiye güncellemesi engellendi: %', sqlerrm;
end;
$$;

select '--- RLS: veli başka oyuncunun profilini/portföyünü göremiyor ---' as step;
select set_config('test.uid', '00000000-0000-0000-0000-000000000001', false);
begin;
set local role authenticated;
select count(*) as visible_profiles from public.profiles;
select count(*) as visible_portfolios from public.portfolios;
select count(*) as visible_transactions from public.transactions;
select count(*) as visible_assets from public.assets;
rollback;

select '--- RLS: veli başkasının portföyüne doğrudan yazamıyor ---' as step;
begin;
set local role authenticated;
do $$
begin
  insert into public.portfolios (user_id, asset_id, shares)
  values ('00000000-0000-0000-0000-000000000001', (select id from public.assets where symbol = 'BTC'), 5);
  raise exception 'BEKLENEN HATA OLUŞMADI: portföye doğrudan yazılabildi!';
exception
  when insufficient_privilege then
    raise notice 'OK, portföye doğrudan yazma engellendi.';
end;
$$;
rollback;

select '--- liderlik tablosu ---' as step;
select * from public.get_leaderboard(10);
