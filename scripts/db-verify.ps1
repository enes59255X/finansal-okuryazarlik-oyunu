# Faz 1 veritabanı doğrulaması: geçici bir Postgres container'ında
# auth stub + migration'lar + RPC/RLS senaryolarını çalıştırır.
#
# Kullanım: pwsh scripts/db-verify.ps1
# Gereksinim: Docker engine çalışıyor olmalı.

$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$container = 'okuryazarlik-pg-verify'

function Remove-Container {
  docker rm -f $container *> $null
}

Remove-Container

try {
  docker run -d --name $container `
    -e POSTGRES_PASSWORD=postgres `
    -v "${root}\supabase\migrations:/migrations:ro" `
    -v "${root}\supabase\tests:/tests:ro" `
    postgres:16-alpine | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    docker exec $container pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  }

  if (-not $ready) { throw 'Postgres container hazır olmadı.' }

  $files = @('/tests/00_auth_stub.sql') +
    (Get-ChildItem "$root\supabase\migrations" -Filter '*.sql' | Sort-Object Name | ForEach-Object { "/migrations/$($_.Name)" }) +
    @('/tests/01_phase1.sql')

  foreach ($file in $files) {
    Write-Host "-> $file"
    $output = docker exec $container psql -U postgres -q -v ON_ERROR_STOP=1 -f $file 2>&1
    $code = $LASTEXITCODE
    $output | Write-Host
    if ($code -ne 0) { throw "Doğrulama başarısız: $file" }
  }

  Write-Output 'Tüm Faz 1 veritabanı kontrolleri geçti.'
}
finally {
  Remove-Container
}
