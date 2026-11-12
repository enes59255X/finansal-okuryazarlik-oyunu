-- Faz 3 / 0008 — Başlangıç kadrosu
-- Transfer pazarı kapalı olduğu için her yeni oyuncuya 5 kişilik altyapı kadrosu verilir.
-- Fonksiyon istemciye kapalıdır; yalnızca profil trigger'ı çağırır.

create or replace function public.grant_starter_squad(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null then
    return;
  end if;

  -- Kadrosunda oyuncu varsa dokunma
  if exists (
    select 1
    from public.portfolios p
    join public.assets a on a.id = p.asset_id
    where p.user_id = p_user and a.category = 'player' and p.shares > 0
  ) then
    return;
  end if;

  insert into public.portfolios (user_id, asset_id, shares, average_buy_price)
  select p_user, a.id, 1, a.current_price
  from public.assets a
  join public.player_stats ps on ps.asset_id = a.id
  where a.category = 'player' and a.is_active
  order by ps.overall asc
  limit 5
  on conflict (user_id, asset_id) do nothing;
end;
$$;

revoke execute on function public.grant_starter_squad(uuid) from public, anon, authenticated;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.grant_starter_squad(new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Mevcut oyuncular için tek seferlik doldurma
do $$
declare
  v_profile record;
begin
  for v_profile in
    select p.id
    from public.profiles p
    where not exists (
      select 1
      from public.portfolios pt
      join public.assets a on a.id = pt.asset_id
      where pt.user_id = p.id and a.category = 'player' and pt.shares > 0
    )
  loop
    perform public.grant_starter_squad(v_profile.id);
  end loop;
end;
$$;
