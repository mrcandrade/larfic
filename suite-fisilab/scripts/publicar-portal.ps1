<#
.SYNOPSIS
  Monta o portal de downloads pronto para enviar ao servidor da UFRGS (dist/portal).

.DESCRIPTION
  Copia portal/ e acrescenta:
    dados/apps.json     <- apps.json (catálogo)
    dados/MANIFESTO.md  <- MANIFESTO.md
    downloads/*.exe e downloads/manifest.json <- dist/instaladores (gerados por build-installers.ps1)
  Não copia config.local.php nem dados/downloads.json (ficam só no servidor).

  Depois, envie a pasta dist/portal para o servidor, por exemplo:
    scp -r dist/portal/* usuario@servidor.ufrgs.br:/var/www/fisilab/suite/
  ou, com rsync (preserva o contador e a configuração local do servidor):
    rsync -av --exclude config.local.php --exclude dados/downloads.json dist/portal/ usuario@servidor:/var/www/fisilab/suite/

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\publicar-portal.ps1
  powershell -ExecutionPolicy Bypass -File scripts\publicar-portal.ps1 -SemInstaladores   # só o site
#>
param([switch] $SemInstaladores)
$ErrorActionPreference = 'Stop'
$Suite = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Out = Join-Path $Suite 'dist\portal'
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
Copy-Item -Recurse (Join-Path $Suite 'portal') $Out
Remove-Item (Join-Path $Out 'config.local.php'), (Join-Path $Out 'dados\downloads.json'), (Join-Path $Out '.gitignore') -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Suite 'apps.json') (Join-Path $Out 'dados\apps.json')
Copy-Item (Join-Path $Suite 'MANIFESTO.md') (Join-Path $Out 'dados\MANIFESTO.md')
if (-not $SemInstaladores) {
  $inst = Join-Path $Suite 'dist\instaladores'
  if (Test-Path (Join-Path $inst 'manifest.json')) {
    Copy-Item (Join-Path $inst 'manifest.json') (Join-Path $Out 'downloads\')
    Get-ChildItem $inst -Filter *.exe | Copy-Item -Destination (Join-Path $Out 'downloads\')
  } else {
    Write-Warning 'dist/instaladores/manifest.json não existe: rode installer/build-installers.ps1 antes.'
  }
}
$size = (Get-ChildItem -Recurse $Out | Measure-Object Length -Sum).Sum
Write-Host ("Portal pronto em {0} ({1:N0} MB)" -f $Out, ($size / 1MB)) -ForegroundColor Green
