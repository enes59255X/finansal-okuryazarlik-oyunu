import { PageShell } from '../components/PageShell'

const GAMES = [
  { name: 'Rulet', desc: 'Kırmızı/siyah, tek-çift veya tek sayı. Sunucu RNG, sabit ödeme tablosu.', icon: '🎡' },
  { name: 'Blackjack', desc: 'Sunucu destesi, hit / stand / double. Oturum süresi ve bahis limiti var.', icon: '🃏' },
  { name: 'Aviator', desc: 'Tur yükselir, sen çekilmeden çakılırsa bahis gider. Crash noktası sunucuda.', icon: '✈️' },
  { name: 'Günlük bonus', desc: '24 saatte bir küçük jeton. Seri bozulursa sıfırlanır.', icon: '🎁' },
]

export function CasinoPage() {
  return (
    <PageShell
      title="Gazino"
      subtitle="Yan modül. Şu an hazırlık aşamasında; açıldığında tüm bahisler sunucu tarafında işlenecek."
      actions={
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Yakında
        </span>
      }
    >
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/80">Erdal Gazino</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Eğlence tarafı, ekonominin dışında değil.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Aynı cüzdanı kullanacak; kaybettiğin para transfer bütçenden düşecek. Bu yüzden her oyun için
            işlem başına ve günlük kayıp tavanı sunucuda zorunlu olacak. Kasa, hisse ve istemci tarafı bakiye
            gibi eski sistemdeki açıklar taşınmayacak.
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {GAMES.map((game) => (
          <article
            key={game.name}
            className="flex items-start gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-800/70 text-xl">
              {game.icon}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-white">{game.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{game.desc}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
        Sanal para ile oynanan bir simülasyon. Gerçek para yatırma/çekme yoktur; kumar tavsiyesi değildir.
      </p>
    </PageShell>
  )
}
