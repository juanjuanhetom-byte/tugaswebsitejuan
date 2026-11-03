# ============================================================
#  SIBORU — Skrip publikasi ke here.now + pengaturan domain
#  ------------------------------------------------------------
#  Contoh pemakaian (PowerShell, dari folder proyek):
#
#   # 1) Lihat daftar berkas yang akan dipublikasikan (tanpa mengunggah)
#   .\tools\publish.ps1 -DryRun
#
#   # 2) Ganti domain final saja (canonical, OG, sitemap, robots)
#   .\tools\publish.ps1 -Domain "https://siboru.idbbali.ac.id/" -SetDomainOnly
#
#   # 3) Tambahkan kode verifikasi Google Search Console + terbitkan
#   .\tools\publish.ps1 -Domain "https://siboru.idbbali.ac.id/" `
#       -GoogleVerification "TOKEN_DARI_GSC" -ClaimToken "POAkn2jbOnj7zTH7"
#
#   # 4) Perbarui situs yang sudah ada (URL here.now sekarang)
#   .\tools\publish.ps1 -ClaimToken "POAkn2jbOnj7zTH7"
#
#  Catatan:
#   - Tanpa -ClaimToken, skrip MEMBUAT situs anonim baru (berlaku 24 jam)
#     dan menampilkan claimUrl — simpan tautan itu.
#   - Dengan -ClaimToken, skrip MEMPERBARUI situs yang sama.
#   - Berkas verifikasi Google berbentuk "googleXXXXXXXX.html" di folder
#     akar otomatis ikut dipublikasikan.
# ============================================================

param(
  [string]$Domain = "",
  [string]$GoogleVerification = "",
  [string]$ClaimToken = "",
  [string]$ApiKey = "",
  [string]$Slug = "mystic-anvil-hha7",
  [switch]$SetDomainOnly,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# ---------- util ----------
function Write-Utf8NoBom([string]$path, [string]$text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $enc)
}
function Get-Text([string]$path) { [System.IO.File]::ReadAllText((Join-Path $root $path)) }

$currentDomain = ""
try {
  $idx = Get-Text "index.html"
  $m = [regex]::Match($idx, 'rel="canonical"\s+href="([^"]+)"')
  if ($m.Success) { $currentDomain = $m.Groups[1].Value }
} catch { }

# ---------- 1) Ganti domain ----------
if ($Domain) {
  $base = $Domain.TrimEnd("/") + "/"
  if ($currentDomain -and $currentDomain -ne $base) {
    $oldBase = $currentDomain
    $files = @("index.html", "catalog.html", "sitemap.xml", "robots.txt")
    foreach ($f in $files) {
      $p = Join-Path $root $f
      if (-not (Test-Path $p)) { continue }
      $t = Get-Text $f
      $t = $t.Replace($oldBase.TrimEnd("/"), $base.TrimEnd("/"))
      Write-Utf8NoBom $p $t
      Write-Host ("  domain diperbarui: {0}" -f $f)
    }
    $currentDomain = $base
  } elseif (-not $currentDomain) {
    Write-Warning "Canonical tidak ditemukan di index.html — domain tidak diubah."
  } else {
    Write-Host "  domain sudah sama: $base"
  }
}

# ---------- 2) Meta verifikasi Google ----------
if ($GoogleVerification) {
  $p = Join-Path $root "index.html"
  $t = Get-Text "index.html"
  $meta = '<meta name="google-site-verification" content="{0}" />' -f $GoogleVerification
  if ($t -match 'name="google-site-verification"') {
    $t = [regex]::Replace($t, '<meta name="google-site-verification" content="[^"]*"\s*/?>', $meta)
  } else {
    $t = $t -replace '(<title>.*?</title>)', ("`$1`n  " + $meta)
  }
  Write-Utf8NoBom $p $t
  Write-Host "  meta google-site-verification diperbarui"
}

if ($SetDomainOnly) {
  Write-Host "Selesai (hanya domain). Tidak ada yang dipublikasikan."
  return
}

# ---------- 3) Daftar berkas ----------
$files = New-Object System.Collections.Generic.List[string]
foreach ($f in @("index.html","catalog.html","admin.html","404.html","robots.txt","sitemap.xml","site.webmanifest")) {
  if (Test-Path (Join-Path $root $f)) { $files.Add($f) }
}
foreach ($dir in @("css","js","images","media")) {
  if (Test-Path (Join-Path $root $dir)) {
    Get-ChildItem (Join-Path $root $dir) -Recurse -File |
      ForEach-Object { $files.Add($_.FullName.Substring($root.Length + 1).Replace('\','/')) }
  }
}
Get-ChildItem $root -Filter "google*.html" -File -ErrorAction SilentlyContinue |
  ForEach-Object { $files.Add($_.Name) }

$types = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml"
  ".mp4"="video/mp4"; ".webm"="video/webm"; ".ico"="image/x-icon"
  ".txt"="text/plain; charset=utf-8"; ".xml"="application/xml; charset=utf-8"
  ".webmanifest"="application/manifest+json"
}

$manifest = @()
foreach ($f in $files) {
  $full = Join-Path $root $f
  if (-not (Test-Path $full)) { continue }
  $ext = [System.IO.Path]::GetExtension($f).ToLower()
  $ct = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
  $manifest += @{ path = $f; size = (Get-Item $full).Length; contentType = $ct }
}
$totalBytes = ($manifest | ForEach-Object { $_.size } | Measure-Object -Sum).Sum
$totalMB = [math]::Round(($totalBytes / 1MB), 2)
Write-Host ("  {0} berkas, {1} MB" -f $manifest.Count, $totalMB)

if ($DryRun) {
  $manifest | ForEach-Object { "   {0,-38} {1,10}" -f $_.path, $_.size }
  Write-Host "DryRun selesai. Tidak ada yang diunggah."
  return
}

# ---------- 4) Buat / perbarui situs ----------
$body = @{
  displayName        = "SIBORU — Sistem Booking Ruangan"
  displayDescription = "Sistem Booking Ruangan IDB Bali: katalog ruangan, pengajuan peminjaman, persetujuan admin, dan struk digital."
  files              = $manifest
}
if ($ClaimToken) { $body.claimToken = $ClaimToken }

$method = if ($ApiKey -or $ClaimToken) { "PUT" } else { "POST" }
$url = if ($ApiKey -or $ClaimToken) { "https://here.now/api/v1/publish/$Slug" } else { "https://here.now/api/v1/publish" }
$authHeaders = @{}
if ($ApiKey) { $authHeaders["Authorization"] = "Bearer $ApiKey" }

Write-Host ("  {0} https://here.now ..." -f $method)
$res = Invoke-RestMethod -Uri $url -Method $method -Headers $authHeaders `
        -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6)

if (-not $res.upload -or -not $res.upload.uploads) {
  throw ("Respons here.now tidak berisi upload URL: " + ($res | ConvertTo-Json -Depth 4))
}

# ---------- 5) Unggah ----------
Write-Host ("  slug: {0}" -f $res.slug)
$ok = 0; $fail = 0
foreach ($u in $res.upload.uploads) {
  $full = Join-Path $root $u.path
  $h = @{}
  if ($u.headers) {
    foreach ($p in $u.headers.PSObject.Properties) { $h[$p.Name] = [string]$p.Value }
  }
  try {
    Invoke-WebRequest -Uri $u.url -Method Put -Headers $h -InFile $full -UseBasicParsing | Out-Null
    $ok++
  } catch {
    $fail++
    Write-Warning ("gagal unggah {0}: {1}" -f $u.path, $_.Exception.Message)
  }
}
Write-Host ("  unggah: {0} berhasil, {1} gagal" -f $ok, $fail)

# ---------- 6) Finalisasi ----------
$fin = Invoke-RestMethod -Uri $res.upload.finalizeUrl -Method Post -ContentType "application/json" `
        -Body (@{ versionId = $res.upload.versionId } | ConvertTo-Json)

Write-Host ""
Write-Host "  SITUS LIVE :" $fin.primaryUrl
Write-Host "  Status     :" $fin.publishStatus.state
if ($fin.publishStatus.expiresAt) { Write-Host "  Kedaluwarsa:" $fin.publishStatus.expiresAt }
if ($res.claimUrl) {
  Write-Host ""
  Write-Host "  SIMPAN tautan klaim ini (hanya muncul sekali):" -ForegroundColor Yellow
  Write-Host "  $($res.claimUrl)" -ForegroundColor Yellow
}
