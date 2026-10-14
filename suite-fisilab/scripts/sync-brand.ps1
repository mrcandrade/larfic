<#
.SYNOPSIS
  Copia a identidade visual (brand/fisilab-brand e os ícones) para todos os programas da suíte.

.DESCRIPTION
  A fonte única da paleta, da tela de abertura e da janela Sobre é brand/fisilab-brand. Cada
  programa leva uma cópia em crates/fisilab-brand (para compilar sozinho, sem depender deste
  repositório). Depois de mudar o crate ou os ícones, rode este script, confira com
  `cargo check` em cada programa e faça commit em cada submódulo.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-brand.ps1
  powershell -ExecutionPolicy Bypass -File scripts\sync-brand.ps1 -AppsRoot C:\fisilab-work\apps
#>
param([string] $AppsRoot)
$ErrorActionPreference = 'Stop'
$Suite = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $AppsRoot) { $AppsRoot = Join-Path $Suite 'apps' }
$Brand = Join-Path $Suite 'brand\fisilab-brand'
$Catalog = Get-Content (Join-Path $Suite 'apps.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$Logos = Join-Path $Suite '..\assets'

foreach ($a in $Catalog.apps) {
  $root = Join-Path $AppsRoot $a.slug
  if (-not (Test-Path $root)) { Write-Warning "$($a.slug): não encontrado em $root"; continue }
  $dst = Join-Path $root 'crates\fisilab-brand'
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse $Brand $dst
  Remove-Item -Recurse -Force (Join-Path $dst 'target') -ErrorAction SilentlyContinue
  $assets = Join-Path $root 'assets\fisilab'
  New-Item -ItemType Directory -Force -Path $assets | Out-Null
  Copy-Item (Join-Path $Suite "brand\icons\$($a.slug)\*") $assets -Force
  Copy-Item (Join-Path $Logos 'larfic-logo.png'), (Join-Path $Logos 'ufrgs-logo.gif'), (Join-Path $Logos 'cta-logo.webp') $assets -Force
  Write-Host "$($a.name): ok"
}
