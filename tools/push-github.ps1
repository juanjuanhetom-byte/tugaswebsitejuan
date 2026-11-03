# ============================================================
#  SIBORU — Push ke GitHub tanpa menyimpan token
#  ------------------------------------------------------------
#  Cara pakai:
#
#    # 1) Simpan token ke berkas sementara (jangan di folder proyek)
#    Set-Content "$env:TEMP\gh_token.txt" "github_pat_XXXXXXXX" -NoNewline
#
#    # 2) Jalankan push
#    .\tools\push-github.ps1 -TokenFile "$env:TEMP\gh_token.txt"
#
#    # 3) Hapus berkas token setelah selesai
#    Remove-Item "$env:TEMP\gh_token.txt"
#
#  Token TIDAK ditulis ke .git/config — hanya dipakai pada satu
#  perintah push (URL sementara), sehingga tidak tersimpan permanen.
# ============================================================

param(
  [string]$Token = "",
  [string]$TokenFile = "",
  [string]$Repo = "https://github.com/juanjuanhetom-byte/tugaswebsitejuan.git",
  [string]$Message = "",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not $Token -and $TokenFile) {
  if (-not (Test-Path $TokenFile)) { throw "Berkas token tidak ditemukan: $TokenFile" }
  $Token = (Get-Content $TokenFile -Raw).Trim()
}
if (-not $Token) { throw "Token kosong. Isi -Token atau -TokenFile." }
if ($Token -notmatch '^(github_pat_|ghp_)') {
  Write-Warning "Format token tidak dikenali (biasanya diawali github_pat_ atau ghp_). Tetap dicoba…"
}

# Git portable (MinGit) atau git di PATH
$git = Join-Path $env:LOCALAPPDATA "MinGit\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }
Write-Host ("  git: {0}" -f $git)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Commit tambahan bila diminta
if ($Message) {
  & $git add -A
  $dirty = (& $git status --porcelain)
  if ($dirty) {
    & $git commit -m $Message
    Write-Host ("  commit baru: {0}" -f $Message)
  } else {
    Write-Host "  tidak ada perubahan untuk di-commit"
  }
}

# Push memakai URL sementara (token tidak disimpan)
$pushUrl = $Repo -replace '^https://', ("https://" + $Token + "@")
Write-Host ("  push ke branch {0} …" -f $Branch)
& $git push $pushUrl $Branch 2>&1 | ForEach-Object { $_ -replace [regex]::Escape($Token), "***" }
$code = $LASTEXITCODE

if ($code -ne 0) {
  Write-Host ""
  Write-Warning "Push gagal (exit $code). Periksa: token kedaluwarsa? izin Contents: Read and write? repo benar?"
  exit $code
}

Write-Host ""
Write-Host "  BERHASIL. Cek: https://github.com/juanjuanhetom-byte/tugaswebsitejuan/commits/$Branch" -ForegroundColor Green
Write-Host "  Jangan lupa REVOKE token: https://github.com/settings/tokens?type=beta" -ForegroundColor Yellow
