# Netlify ortam değişkenlerini yazıp deploy tetikler.
#
# Kullanım:
#   pwsh scripts/netlify-env.ps1 -SupabaseUrl "https://xxx.supabase.co" -AnonKey "eyJ..."
#   (token: -Token parametresi veya NETLIFY_AUTH_TOKEN ortam değişkeni)
#
# Not: VITE_* değişkenleri build sırasında gömülür; bu yüzden deploy tetiklenir.

param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$AnonKey,
  [string]$Token = $env:NETLIFY_AUTH_TOKEN,
  [string]$SiteName = '11finanssimulator'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Token)) {
  throw 'Netlify token gerekli: -Token veya NETLIFY_AUTH_TOKEN.'
}

$headers = @{
  Authorization  = "Bearer $Token"
  'User-Agent'   = 'opencode'
  'Content-Type' = 'application/json'
}

$sites = Invoke-RestMethod -Uri 'https://api.netlify.com/api/v1/sites?per_page=100' -Headers $headers
$site = $sites | Where-Object { $_.name -eq $SiteName } | Select-Object -First 1
if (-not $site) { throw "Site bulunamadı: $SiteName" }

$account = $site.account_slug
$siteId = $site.id
Write-Output "Site: $($site.name) ($siteId), hesap: $account"

$variables = [ordered]@{
  VITE_SUPABASE_URL      = $SupabaseUrl.TrimEnd('/')
  VITE_SUPABASE_ANON_KEY = $AnonKey.Trim()
}

foreach ($key in $variables.Keys) {
  $body = @{
    key    = $key
    scopes = @('builds')
    values = @(@{ value = $variables[$key]; context = 'all' })
  } | ConvertTo-Json -Depth 5

  $uri = "https://api.netlify.com/api/v1/accounts/$account/env/$key" + "?site_id=$siteId"
  Invoke-RestMethod -Uri $uri -Method Put -Headers $headers -Body $body | Out-Null
  Write-Output "-> $key yazıldı"
}

$deploy = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites/$siteId/builds" -Method Post -Headers $headers
Write-Output "Deploy tetiklendi: $($deploy.deploy_id)"

do {
  Start-Sleep -Seconds 10
  $state = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/deploys/$($deploy.deploy_id)" -Headers $headers
  Write-Output "durum: $($state.state)"
} while ($state.state -in @('new', 'pending', 'building', 'enqueued', 'preparing'))

Write-Output "Son durum: $($state.state) $($state.error_message)"
if ($state.state -ne 'ready') { exit 1 }
Write-Output "Canlı: $($state.ssl_url)"
