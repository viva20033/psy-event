# Generates PWA icons from public/icons/source.png (Windows, no npm)
# Usage: powershell -File scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$src = Join-Path $root "public\icons\source.png"
$outDir = Join-Path $root "public\icons"

if (-not (Test-Path $src)) {
  Write-Error "Put your source image at public/icons/source.png"
  exit 1
}

function Resize-Icon($size, $name) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Host "OK $name"
}

Resize-Icon 512 "icon-512.png"
Resize-Icon 192 "icon-192.png"
Resize-Icon 180 "apple-touch-icon.png"
Resize-Icon 32 "favicon-32.png"

$img = [System.Drawing.Image]::FromFile($src)
$canvas = 512
$inner = [int](512 * 0.8)
$bmp = New-Object System.Drawing.Bitmap $canvas, $canvas
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(255, 245, 240, 232))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$x = ($canvas - $inner) / 2
$g.DrawImage($img, $x, $x, $inner, $inner)
$bmp.Save((Join-Path $outDir "icon-512-maskable.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Host "OK icon-512-maskable.png"
Write-Host "Done."
