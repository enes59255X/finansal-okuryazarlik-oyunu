-- Faz 1 / 0004 — Başlangıç verisi
-- 19 varlık, 30 günlük fiyat geçmişi, 4 kriz senaryosu, 1 sezon, 3 haber.

insert into public.assets (symbol, name, category, current_price, previous_close, volatility)
values
  ('THYAO',  'Türk Hava Yolları',        'stock',     285.50,  281.00, 0.0300),
  ('ASELS',  'Aselsan',                  'stock',      68.40,   67.10, 0.0280),
  ('TUPRS',  'Tüpraş',                   'stock',     142.30,  145.00, 0.0260),
  ('EREGL',  'Ereğli Demir Çelik',       'stock',      27.80,   27.95, 0.0250),
  ('BIMAS',  'BİM Mağazalar',            'stock',     512.00,  508.50, 0.0180),
  ('SISE',   'Şişecam',                  'stock',      41.20,   41.75, 0.0220),
  ('NVDA',   'NVIDIA',                   'stock',     182.40,  179.20, 0.0350),
  ('XU100',  'BIST 100 Endeksi',         'index',   11250.00, 11180.00, 0.0150),
  ('SPX',    'S&P 500 Endeksi',          'index',    6420.00,  6395.00, 0.0120),
  ('XGYO',   'BIST GYO Endeksi',         'index',    3180.00,  3210.00, 0.0200),
  ('XAUUSD', 'Altın (ons)',              'commodity', 2685.00, 2668.00, 0.0110),
  ('BRENT',  'Brent Petrol',             'commodity',   74.20,   72.90, 0.0280),
  ('WHEAT',  'Buğday',                   'commodity',  612.00,  608.00, 0.0240),
  ('NATGAS', 'Doğal Gaz',                'commodity',    3.42,    3.38, 0.0450),
  ('TR2Y',   '2 Yıllık Devlet Tahvili',  'bond',        42.10,   41.80, 0.0080),
  ('TR10Y',  '10 Yıllık Devlet Tahvili', 'bond',        29.80,   29.65, 0.0070),
  ('BTC',    'Bitcoin',                  'crypto',   68400.00, 67200.00, 0.0380),
  ('ETH',    'Ethereum',                 'crypto',    3120.00,  3068.00, 0.0420),
  ('SOL',    'Solana',                   'crypto',     148.60,   145.20, 0.0500)
on conflict (symbol) do nothing;

-- 30 günlük geçmiş (deterministik dalgalanma, grafikler boş kalmasın)
insert into public.price_history (asset_id, price, recorded_at)
select a.id,
       greatest(round((a.current_price * (1 + 0.02 * sin(i * 0.7) + 0.01 * cos(i * 1.3)))::numeric, 2), 0.01),
       now() - make_interval(days => i)
from public.assets a
cross join generate_series(0, 29) as i
where not exists (select 1 from public.price_history);

-- Kriz senaryoları
insert into public.scenarios (code, title, description, effects)
values
  (
    'hormuz_krizi',
    'Hürmüz Boğazı Krizi',
    'İran-ABD gerginliği tırmanıyor. Hürmüz Boğazı''nda askeri tatbikat ve tanker engellemesi petrol arzını tehdit ediyor.',
    '{"BRENT": 0.35, "XAUUSD": 0.15, "THYAO": -0.25, "XU100": -0.08, "SPX": -0.08}'::jsonb
  ),
  (
    'cip_kritigi',
    'Kritik Çip Kıtlığı',
    'Küresel yarı iletken fabrikalarında hammadde tedarik krizi. Teknoloji üretimi durma noktasında.',
    '{"NVDA": 0.30, "cat:stock": -0.18}'::jsonb
  ),
  (
    'sok_faiz',
    'Şok Faiz Artırımı',
    'Merkez Bankası enflasyonla mücadele için politika faizini 5 puan artırdı.',
    '{"cat:bond": 0.12, "cat:stock": -0.10, "XU100": -0.10, "SPX": -0.10, "XGYO": -0.15}'::jsonb
  ),
  (
    'kuresel_kuraklik',
    'Küresel Kuraklık',
    'Buğday ve mısır rekoltesinde %40 düşüş beklentisi. Gıda emtiası fiyatları yükseliyor.',
    '{"WHEAT": 0.45, "BIMAS": -0.12}'::jsonb
  )
on conflict (code) do nothing;

-- İlk sezon
insert into public.seasons (name, status)
select 'Sezon 1', 'active'
where not exists (select 1 from public.seasons where status = 'active');

-- Başlangıç haberleri
insert into public.news (headline, body, severity)
select * from (values
  ('Piyasalar açıldı', 'Sanal piyasa 10.000 ₺ başlangıç bakiyesiyle işleme açıldı. İlk hamleni yapmadan önce sektörleri incele.', 'info'),
  ('Fed toplantısı yaklaşıyor', 'Küresel piyasalar Fed''in faiz kararını bekliyor. Tahvil ve hisse fiyatlarında dalgalanma artabilir.', 'warning'),
  ('Altın yükselişte', 'Jeopolitik riskler güvenli liman talebini artırdı; ons altın yeni zirveyi test ediyor.', 'info')
) as v(headline, body, severity)
where not exists (select 1 from public.news);
