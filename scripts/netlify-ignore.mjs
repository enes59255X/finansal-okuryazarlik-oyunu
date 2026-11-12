// Netlify build ignore script.
// Netlify: ignore komutu 0 ile çıkarsa build atlanır, sıfırdan farklı çıkarsa build çalışır.
// Amaç: deploy preview ve branch deploy'larında build kredisi harcamamak.
// Sadece production (main) deploy edilir.

const context = process.env.CONTEXT ?? 'production'

if (context === 'deploy-preview' || context === 'branch-deploy') {
  console.log(`[netlify] context=${context} → build atlandı (kredi koruması).`)
  process.exit(0)
}

process.exit(1)
