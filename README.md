# Piyasa Akademi — Finansal Okuryazarlık Oyunu

Sanal para ile piyasa simülasyonu. React + Vite (statik SPA) → Netlify CDN, veri ve yetki → Supabase (Postgres + Auth + RLS).

**Faz 1 durumu:** kimlik doğrulama, piyasa listesi, fiyat grafiği, atomik alım/satım, portföy ve liderlik tablosu çalışır durumda.

## Gereksinimler

- Node 22+
- Bir Supabase projesi (free tier yeterli)

## Kurulum

```bash
npm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
```

`.env` içine Supabase panelindeki **Project URL** ve **anon public key** değerlerini gir:

```
VITE_SUPABASE_URL=https://<proje-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Veritabanı

`supabase/migrations` altındaki dosyaları **sırayla** Supabase SQL Editor'de çalıştır:

| Dosya | İçerik |
| --- | --- |
| `0001_schema.sql` | Tablolar, indeksler, `auth.users` → `profiles` trigger'ı |
| `0002_rls.sql` | RLS politikaları, kolon düzeyi yetkiler |
| `0003_trade_rpc.sql` | `buy_asset`, `sell_asset`, `get_leaderboard`, `is_admin` |
| `0004_seed.sql` | 19 varlık, 30 günlük fiyat geçmişi, 4 kriz senaryosu, haberler |

Supabase CLI kullanıyorsan: `supabase db push`.

### Geliştirme

```bash
npm run dev
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tip kontrolü + statik üretim (`dist/`) |
| `npm run preview` | Üretim çıktısını yerelde sun |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest birim testleri |
| `pwsh scripts/db-verify.ps1` | Geçici Postgres container'ında RPC + RLS senaryolarını çalıştırır (Docker gerekir) |

## Mimari

```
src/
  auth/          oturum + profil bağlamı
  components/    layout, grafik, işlem paneli
  lib/           Supabase istemcisi, API çağrıları, para matematiği
  pages/         giriş, piyasa, varlık, portföy, liderlik
supabase/
  migrations/    şema, RLS, RPC, seed
  tests/         auth stub + Faz 1 RPC/RLS senaryoları
scripts/
  db-verify.ps1  yerel Docker ile veritabanı doğrulaması
```

### Güvenlik modeli

- İstemci **hiçbir** tabloya yazmaz. `profiles` üzerinde yalnız `username` kolonu güncellenebilir (kolon yetkisi), `cash_balance` asla.
- Tüm para hareketleri `SECURITY DEFINER` fonksiyonlarda, `FOR UPDATE` kilidiyle ve `search_path = public, pg_temp` sabitlenerek yapılır.
- `portfolios` ve `transactions` yalnız kendi satırlarını okur; `anon` rolünün oyun verisine erişimi yoktur.
- Liderlik tablosu `get_leaderboard()` RPC'siyle döner; başka oyuncuların profil satırları istemciye açılmaz.

### Netlify kotası

Statik SPA + CDN; SSR ve sürekli fonksiyon çağrısı yok. `dev` dalı Netlify'a bağlı değil, CI sadece GitHub'da koşar; deploy yalnız `main` güncellenince tetiklenir. `netlify.toml` deploy preview'ları kapatır.

## Yol haritası

- [x] Faz 1 — Şema, RLS, atomik alım/satım, piyasa & portföy arayüzü
- [ ] Faz 2 — Fiyat motoru (pg_cron), senaryo motoru, Realtime haber, admin paneli, sezonlar
- [ ] Faz 3 — Eğitim katmanı (brifing/quiz/debrief), E2E, izleme, yayın

> Sanal para ile oynanan eğitim simülasyonu. Yatırım tavsiyesi değildir.
