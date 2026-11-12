# Supabase migration uygulayıcı: supabase/migrations/*.sql dosyalarını sırayla çalıştırır.
#
# Kullanım:
#   pwsh scripts/db-migrate.ps1 -ConnectionString "postgresql://postgres.xxx:SIFRE@aws-0-xxx.pooler.supabase.com:5432/postgres"
#   veya SUPABASE_DB_URL ortam değişkeni ile:
#   $env:SUPABASE_DB_URL = "postgresql://..."; pwsh scripts/db-migrate.ps1
#
# Gereksinim: Docker engine çalışıyor olmalı (yerel psql kurulumu gerekmez).

param(
  [string]$ConnectionString = $env:SUPABASE_DB_URL
)

$ErrorActionPreference = 'Continue'

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
  Write-Error 'Bağlantı adresi verilmedi. -ConnectionString parametresi veya SUPABASE_DB_URL ortam değişkeni gerekli.'
  exit 1
}

$root = Split-Path -Parent $PSScriptRoot
$migrations = Join-Path $root 'supabase\migrations'
$files = Get-ChildItem $migrations -Filter '*.sql' | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Error "Migration bulunamadı: $migrations"
  exit 1
}

$failed = $false

foreach ($file in $files) {
  Write-Host "-> $($file.Name)"
  $sql = Get-Content $file.FullName -Raw -Encoding UTF8

  # SQL'i stdin üzerinden gönder: bağlantı adresi komut satırında görünmez
  $output = $sql | docker run --rm -i `
    -e PGCONNECT_TIMEOUT=20 `
    postgres:16-alpine psql $ConnectionString -v ON_ERROR_STOP=1 -q 2>&1
  $code = $LASTEXITCODE
  $output | Write-Host

  if ($code -ne 0) {
    Write-Error "Migration başarısız: $($file.Name)"
    $failed = $true
    break
  }
}

if ($failed) { exit 1 }

Write-Output 'Tüm migration dosyaları uygulandı.'
