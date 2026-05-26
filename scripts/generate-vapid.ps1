# Generates VAPID keys for Web Push. Run: powershell -File scripts/generate-vapid.ps1
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
  Write-Error "npx not found. Install Node.js first."
  exit 1
}
Write-Host "Generating VAPID keys..." -ForegroundColor Cyan
npx --yes web-push generate-vapid-keys
Write-Host ""
Write-Host "Add to .env:" -ForegroundColor Yellow
Write-Host "  VITE_VAPID_PUBLIC_KEY=<Public Key>"
Write-Host ""
Write-Host "Add to Supabase Edge Function secrets (notify-announcement):" -ForegroundColor Yellow
Write-Host "  VAPID_PUBLIC_KEY=<Public Key>"
Write-Host "  VAPID_PRIVATE_KEY=<Private Key>"
Write-Host "  VAPID_SUBJECT=mailto:your@email.ru"
Write-Host ""
Write-Host "Add to Vercel Environment Variables:" -ForegroundColor Yellow
Write-Host "  VITE_VAPID_PUBLIC_KEY=<Public Key>"
