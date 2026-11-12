-- Faz 2 / 0006 — Varlık ve haber genişletmesi (idempotent)

insert into public.assets (symbol, name, category, current_price, previous_close, volatility)
values
  ('KCHOL',  'Koç Holding',              'stock',     198.40,  196.10, 0.0240),
  ('SAHOL',  'Sabancı Holding',          'stock',      94.60,   93.80, 0.0240),
  ('GARAN',  'Garanti BBVA',             'stock',     138.20,  136.40, 0.0270),
  ('AKBNK',  'Akbank',                   'stock',      71.35,   70.60, 0.0270),
  ('TCELL',  'Turkcell',                 'stock',      96.80,   97.40, 0.0230),
  ('PGSUS',  'Pegasus',                  'stock',     246.50,  241.00, 0.0330),
  ('FROTO',  'Ford Otosan',              'stock',    1180.00, 1168.00, 0.0250),
  ('MGROS',  'Migros',                   'stock',     612.00,  608.50, 0.0210),
  ('BIST30F','BIST 30 Endeks Fonu',      'fund',       18.42,   18.31, 0.0140),
  ('ALTINF', 'Altın Fonu',               'fund',       32.75,   32.41, 0.0120),
  ('TECF',   'Teknoloji Sektör Fonu',    'fund',       27.10,   26.72, 0.0280),
  ('BORCF',  'Borçlanma Araçları Fonu',  'fund',       14.08,   14.05, 0.0060),
  ('ADA',    'Cardano',                  'crypto',      0.92,    0.89, 0.0450),
  ('XRP',    'XRP',                      'crypto',      2.34,    2.28, 0.0430),
  ('AVAX',   'Avalanche',                'crypto',     38.60,   37.40, 0.0480),
  ('DOT',    'Polkadot',                 'crypto',      7.85,    7.68, 0.0460),
  ('LINK',   'Chainlink',                'crypto',     22.40,   21.95, 0.0440)
on conflict (symbol) do nothing;

insert into public.news (headline, body, severity, kind, related_symbols, source)
select v.headline, v.body, v.severity, v.kind, v.related_symbols, v.source
from (values
  (
    'Merkez Bankası faiz kararını açıkladı',
    'Politika faizi beklentilerin altında artırıldı. Tahvil getirileri geriledi, banka hisseleri günü pozitif kapattı.',
    'warning', 'bond', array['TR2Y', 'TR10Y', 'GARAN', 'AKBNK'], 'Makro Bülten'
  ),
  (
    'Çip devi yatırımını iki katına çıkardı',
    'Yarı iletken üreticisi yeni fabrika yatırımını duyurdu. Tedarik zinciri hisseleri ve teknoloji fonları hareketlendi.',
    'info', 'stock', array['NVDA', 'TECF', 'ASELS'], 'Teknoloji Hattı'
  ),
  (
    'Altında jeopolitik prim',
    'Orta Doğu''daki gerilim güvenli liman talebini artırdı. Ons altın yeni zirveyi test ediyor, altın fonlarına giriş hızlandı.',
    'warning', 'commodity', array['XAUUSD', 'ALTINF'], 'Emtia Masası'
  ),
  (
    'Bitcoin kurumsal talepte rekor',
    'Spot ETF girişleri haftalık rekor kırdı. Kripto varlıklarda volatilite arttı; yatırımcılar kâr realizasyonuna gidiyor.',
    'info', 'crypto', array['BTC', 'ETH', 'SOL', 'LINK'], 'Dijital Varlık'
  ),
  (
    'Havacılıkta yolcu trafiği rekoru',
    'Yaz sezonu rezervasyonları beklentinin üzerinde. Akaryakıt maliyetleri ise marjları baskılıyor.',
    'info', 'stock', array['THYAO', 'PGSUS'], 'Sektör Raporu'
  ),
  (
    'Kuraklık uyarısı: buğday rekoltesinde düşüş',
    'Tarım bakanlığı rekolte tahminini aşağı çekti. Gıda perakendesi maliyet artışıyla karşı karşıya.',
    'critical', 'commodity', array['WHEAT', 'BIMAS', 'MGROS'], 'Tarım Bülteni'
  ),
  (
    'Petrol arzında kesinti riski',
    'Tanker güzergâhındaki askeri hareketlilik arz endişesi yarattı. Enerji hisseleri ve petrol fonları yükselişte.',
    'critical', 'commodity', array['BRENT', 'TUPRS', 'NATGAS'], 'Enerji Masası'
  ),
  (
    'Bankacılıkta kârlılık beklentisi yükseldi',
    'Analistler net faiz marjı tahminlerini yukarı revize etti. Banka hisselerinde hedef fiyatlar arttı.',
    'info', 'stock', array['GARAN', 'AKBNK'], 'Analiz Merkezi'
  ),
  (
    'Kripto düzenlemesinde yeni çerçeve',
    'Düzenleyici kurum saklama ve raporlama kurallarını netleştirdi. Piyasa ilk tepki olarak temkinli.',
    'warning', 'crypto', array['BTC', 'XRP', 'ADA'], 'Regülasyon Notu'
  ),
  (
    'Endeks fonlarına rekor giriş',
    'Pasif yatırım araçlarına yönelim sürüyor. BIST 30 endeks fonu hacmi tarihi zirvede.',
    'info', 'fund', array['BIST30F', 'XU100'], 'Fon Radar'
  )
) as v(headline, body, severity, kind, related_symbols, source)
where not exists (
  select 1 from public.news n where n.headline = v.headline
);
