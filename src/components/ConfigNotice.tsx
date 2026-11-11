export function ConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl rounded-2xl border border-amber-400/30 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Kurulum gerekli</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Supabase bağlantısı tanımlı değil</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Proje kökünde <code className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-200">.env</code> dosyası
          oluşturup şu değişkenleri doldur:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/50 p-4 text-xs text-slate-200">
          {`VITE_SUPABASE_URL=https://<proje-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`}
        </pre>
        <p className="mt-4 text-xs text-slate-400">
          Ardından <code className="text-slate-200">supabase/migrations</code> altındaki SQL dosyalarını sırayla
          Supabase SQL Editor'de çalıştır ve geliştirme sunucusunu yeniden başlat.
        </p>
      </div>
    </div>
  )
}
