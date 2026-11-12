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

### Netlify kotası ve build kredisi koruması

Statik SPA + CDN; SSR ve sürekli fonksiyon çağrısı yok. Krediyi tüketen tek şey build:

- `netlify.toml` içindeki `ignore` komutu (`scripts/netlify-ignore.mjs`) **deploy preview** ve **branch deploy** context'lerinde build'i iptal eder; sadece production (`main`) build alır.
- Netlify panelinde de şunları kapat: *Site configuration → Build & deploy → Branches and deploy contexts* → **Branch deploys: None**, **Deploy previews: Don't deploy pull requests**.
- GitHub Actions Netlify kredisi harcamaz (GitHub'ın kendi runner'ında koşar); CI yine `dev` ve `main` push'larında çalışır.

## Canlıya alma (Netlify)

Deploy'u sen tetikleyeceksin; repo bunun için hazır. Sıra:

1. **Supabase'i hazırla**
   - Proje oluştur, `supabase/migrations` altındaki 4 dosyayı sırayla SQL Editor'de çalıştır.
   - *Authentication → Sign In / Providers → Email*: e-posta doğrulaması istemiyorsan "Confirm email" kapat.
2. **Netlify'a bağla**
   - *Add new site → Import an existing project → GitHub → `finansal-okuryazarlik-oyunu`*.
   - Production branch: **`main`**. Build komutu ve publish dizini `netlify.toml`'dan gelir (`npm run build` → `dist`), panelde değiştirme.
3. **Ortam değişkenleri** (*Site configuration → Environment variables*)

   | Değişken | Değer | Kapsam |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Builds |
   | `VITE_SUPABASE_ANON_KEY` | `anon` / `public` anahtar | Builds |

   > `VITE_` önekli değişkenler **build sırasında** gömülür. Sonradan değiştirirsen *Deploys → Trigger deploy → Clear cache and deploy site* gerekir (1 build harcar). `service_role` anahtarını **hiçbir zaman** ekleme.

4. **Supabase Auth URL'leri**
   - *Authentication → URL Configuration*: **Site URL** = Netlify adresin (`https://<site>.netlify.app`), **Redirect URLs** = `https://<site>.netlify.app/**` (+ özel domain varsa onu da ekle).
   - Bu adım atlanırsa kayıt/giriş sonrası yönlendirmeler çalışmaz.
5. **İlk deploy sonrası kontrol**
   - Ana sayfa açılıyor, "Kurulum gerekli" ekranı **gelmiyor**.
   - Kayıt ol → 10.000 ₺ bakiye görünüyor.
   - Bir varlık al → nakit düşüyor, portföyde pozisyon görünüyor.
   - Liderlik tablosunda kullanıcı adın çıkıyor.

### Ortam değişkenleri özeti

| Dosya | Nerede | Amaç |
| --- | --- | --- |
| `.env` | Yerel (git'e girmez) | `npm run dev` |
| Netlify Environment variables | Panel | Production build |
| GitHub Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | Repo ayarları | CI build adımı (opsiyonel; yoksa build yine geçer) |

## Yol haritası

- [x] Faz 1 — Şema, RLS, atomik alım/satım, piyasa & portföy arayüzü
- [ ] Faz 2 — Fiyat motoru (pg_cron), senaryo motoru, Realtime haber, admin paneli, sezonlar
- [ ] Faz 3 — Eğitim katmanı (brifing/quiz/debrief), E2E, izleme, yayın

> Sanal para ile oynanan eğitim simülasyonu. Yatırım tavsiyesi değildir.
