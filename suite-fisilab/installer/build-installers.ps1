<#
.SYNOPSIS
  Compila os aplicativos da Suíte FisiLab e gera os instaladores (.exe) para Windows.

.DESCRIPTION
  Para cada app de apps.json:
    1. cargo build --release (com as features e variáveis de ambiente de installer/apps/<slug>.json);
    2. monta dist/stage/<slug>: exes, arquivos de dados, ícone, LICENCA.txt, SOBRE.txt, NOTICE.txt,
       MODIFICACOES.md e assoc.iss (associações de arquivo);
    3. compila installer/app.iss com o Inno Setup -> dist/instaladores/FisiLab-<Nome>-Setup-<versão>.exe.
  Depois gera o instalador da suíte completa (SuiteFisiLab-Setup-<data>.exe) e
  dist/instaladores/manifest.json (nomes, versões, tamanhos e SHA-256), que o portal PHP lê.

  Precisa de: Rust (MSVC), Visual Studio Build Tools + Windows SDK e Inno Setup 6
  (winget install JRSoftware.InnoSetup).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1
  powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1 -Apps fisilab-foto,fisilab-pdf
  powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1 -SkipBuild   # só reempacota
  powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1 -Fast        # release sem LTO pesado
#>
param(
  [string[]] $Apps,
  # Onde estão os repositórios dos apps (por padrão, os submódulos em suite-fisilab/apps).
  [string] $AppsRoot,
  [switch] $SkipBuild,
  [switch] $SkipSuite,
  # Só gera o instalador da suíte com os instaladores que já estão em dist/instaladores.
  [switch] $OnlySuite,
  # codegen-units=16 e thin-LTO local: compila bem mais rápido, executável um pouco maior/lento.
  [switch] $Fast,
  # Comando de assinatura do Inno Setup, por exemplo: 'signtool sign /fd sha256 /a /tr http://timestamp.digicert.com /td sha256 $f'
  [string] $SignTool
)
$ErrorActionPreference = 'Stop'
$Suite = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $AppsRoot) { $AppsRoot = Join-Path $Suite 'apps' }
$Dist = Join-Path $Suite 'dist'
$StageRoot = Join-Path $Dist 'stage'
$OutDir = Join-Path $Dist 'instaladores'
New-Item -ItemType Directory -Force -Path $StageRoot, $OutDir | Out-Null
$Utf8Bom = New-Object System.Text.UTF8Encoding $true

function Find-Iscc {
  foreach ($p in @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe")) {
    if (Test-Path $p) { return $p }
  }
  $c = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  throw 'Inno Setup 6 não encontrado (winget install JRSoftware.InnoSetup).'
}
$Iscc = Find-Iscc

function Invoke-Native([string] $What, [scriptblock] $Block, [int] $Attempts = 1) {
  for ($i = 1; $i -le $Attempts; $i++) {
    Write-Host "==> $What" -ForegroundColor Cyan
    & $Block
    if ($LASTEXITCODE -eq 0) { return }
    if ($i -lt $Attempts) {
      # Antivírus e o Explorer às vezes seguram o .exe recém-gerado ("EndUpdateResource failed").
      Write-Warning "$What falhou (código $LASTEXITCODE); nova tentativa em 20 s ($i/$Attempts)"
      Start-Sleep -Seconds 20
    }
  }
  throw "$What falhou (código $LASTEXITCODE)"
}

function Write-Text([string] $Path, [string] $Text) {
  [IO.File]::WriteAllText($Path, ($Text -replace "`r?`n", "`r`n"), $Utf8Bom)
}

function Get-WorkspaceVersion([string] $Root) {
  $inPkg = $false
  foreach ($line in Get-Content (Join-Path $Root 'Cargo.toml')) {
    if ($line -match '^\s*\[') { $inPkg = ($line.Trim() -eq '[workspace.package]'); continue }
    if ($inPkg -and $line -match '^\s*version\s*=\s*"([^"]+)"') { return $Matches[1] }
  }
  throw "Sem [workspace.package] version em $Root\Cargo.toml"
}

$Catalog = Get-Content (Join-Path $Suite 'apps.json') -Raw -Encoding UTF8 | ConvertFrom-Json
# Aceita -Apps a,b,c também quando chega como um texto só (powershell -File).
if ($Apps) { $Apps = @($Apps | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
$Selected = $Catalog.apps
if ($Apps) { $Selected = $Catalog.apps | Where-Object { $Apps -contains $_.slug } }
if (-not $Selected) { throw "Nenhum app selecionado (-Apps $($Apps -join ','))" }

$Manifest = @()
$suiteEntry = $null
if ($OnlySuite) { $Selected = @() }
foreach ($a in $Selected) {
  $slug = $a.slug
  $root = Join-Path $AppsRoot $slug
  if (-not (Test-Path (Join-Path $root 'Cargo.toml'))) { throw "Repositório do $($a.name) não encontrado em $root (git submodule update --init?)" }
  $cfg = Get-Content (Join-Path $PSScriptRoot "apps\$slug.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $version = Get-WorkspaceVersion $root
  # O Inno Setup quer uma versão numérica (a.b.c); sufixos de pré-lançamento ficam só no nome.
  $numeric = ($version -split '-')[0]
  Write-Host "`n### $($a.name) $version ($($a.equivalent))" -ForegroundColor Yellow

  $targetDir = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $root 'target' }
  if (-not $SkipBuild) {
    $saved = @{}
    foreach ($p in $cfg.env.PSObject.Properties) { $saved[$p.Name] = [Environment]::GetEnvironmentVariable($p.Name); Set-Item "env:$($p.Name)" $p.Value }
    # Executáveis sem dependência do redistribuível do Visual C++.
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS = '-C target-feature=+crt-static'
    if ($Fast) { $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = '16'; $env:CARGO_PROFILE_RELEASE_LTO = 'off' }
    $cargoArgs = @('build', '--release', '--target', 'x86_64-pc-windows-msvc', '--manifest-path', (Join-Path $root 'Cargo.toml'))
    foreach ($p in $cfg.packages) { $cargoArgs += @('-p', $p) }
    if ($cfg.features -and $cfg.features.Count -gt 0) { $cargoArgs += @('--features', ($cfg.features -join ',')) }
    try {
      Invoke-Native "cargo $($cargoArgs -join ' ')" { cargo @cargoArgs }
    } finally {
      foreach ($k in $saved.Keys) { Set-Item "env:$k" $saved[$k] }
      Remove-Item env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS -ErrorAction SilentlyContinue
      Remove-Item env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS, env:CARGO_PROFILE_RELEASE_LTO -ErrorAction SilentlyContinue
    }
  }
  $bin = Join-Path $targetDir 'x86_64-pc-windows-msvc\release'

  # Staging
  $stage = Join-Path $StageRoot $slug
  if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
  New-Item -ItemType Directory -Force -Path $stage | Out-Null
  foreach ($exe in $cfg.exes) { Copy-Item (Join-Path $bin $exe) $stage }
  foreach ($f in $cfg.files) {
    $src = Join-Path $root $f.from
    $dst = Join-Path $stage $f.to
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    if (Test-Path $src -PathType Container) { Copy-Item -Recurse $src $dst } else { Copy-Item $src $dst }
  }
  # Comandos extras de staging (ex.: o PDF baixa os modelos de OCR com `cargo xtask models`).
  foreach ($c in $cfg.stage_commands) {
    $cmd = $c.run.Replace('{stage}', $stage)
    Push-Location $root
    try { Invoke-Native "$cmd  # $($c.why)" { cmd /c $cmd } } finally { Pop-Location }
  }
  Copy-Item (Join-Path $root "assets\fisilab\$slug.ico") $stage
  Copy-Item (Join-Path $root 'NOTICE') (Join-Path $stage 'NOTICE.txt')
  Copy-Item (Join-Path $root 'MODIFICACOES.md') $stage -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $root 'LICENSE-MIT') (Join-Path $stage 'LICENSE-MIT.txt')
  Copy-Item (Join-Path $root 'LICENSE-APACHE') (Join-Path $stage 'LICENSE-APACHE.txt')
  if (Test-Path (Join-Path $root 'ATTRIBUTION.md')) { Copy-Item (Join-Path $root 'ATTRIBUTION.md') $stage }

  $mit = Get-Content (Join-Path $root 'LICENSE-MIT') -Raw
  $apache = Get-Content (Join-Path $root 'LICENSE-APACHE') -Raw
  Write-Text (Join-Path $stage 'LICENCA.txt') @"
$($a.name) — Suíte FisiLab
==========================================

O $($a.name) é software livre. Você pode usá-lo para qualquer finalidade, estudar como ele
funciona, modificá-lo e redistribuí-lo, nos termos da licença MIT ou da licença Apache 2.0, à sua
escolha. Os textos das duas licenças estão abaixo (em inglês, que é a versão com valor legal).

Ele é uma versão modificada do $($a.upstream) (https://github.com/storytold/$($a.upstream_slug)),
© 2026 ArtCraft Team e contribuidores do $($a.upstream). Modificações © 2026 FisiLab — LARFIC/UFRGS.
Os nomes e marcas do projeto original pertencem aos seus titulares; esta versão não é afiliada
nem endossada por eles. Componentes de terceiros e suas licenças: NOTICE.txt e ATTRIBUTION.md,
instalados junto com o programa.

O PROGRAMA É FORNECIDO "COMO ESTÁ", SEM GARANTIAS DE QUALQUER TIPO.

------------------------------------------------------------------------------------------
MIT License
------------------------------------------------------------------------------------------
$mit
------------------------------------------------------------------------------------------
Apache License 2.0
------------------------------------------------------------------------------------------
$apache
"@
  Write-Text (Join-Path $stage 'SOBRE.txt') @"
$($a.name) $version — $($a.tagline)
Alternativa livre ao $($a.equivalent)

Parte da Suíte FisiLab, disponibilizada pelo FisiLab — LARFIC · UFRGS (Laboratório de Robótica,
Inteligência Artificial e Física Computacional) em parceria com o CTA — Centro de Tecnologia
Acadêmica, para uso de estudantes, professores e técnicos da UFRGS.

CRÉDITOS
O $($a.name) é baseado no $($a.upstream), um projeto de código aberto do ArtCraft Team e de seus
contribuidores: https://github.com/storytold/$($a.upstream_slug)
Todo o trabalho de edição, formatos de arquivo e ferramentas é deles. O FisiLab alterou o nome, a
identidade visual, o tema de cores, a tela de abertura, os textos em português e o instalador.

MANIFESTO PELAS TECNOLOGIAS LIVRES
Conhecimento produzido em uma universidade pública deve circular livremente. Por isso, as
ferramentas que usamos para ensinar, pesquisar e criar também devem ser livres: qualquer pessoa
pode usá-las, estudá-las, modificá-las e compartilhá-las. Software livre dá autonomia à
universidade, garante que os arquivos continuem abertos e evita que estudantes precisem pagar
para aprender.

Manifesto completo: https://github.com/mrcandrade/larfic/blob/main/suite-fisilab/MANIFESTO.md
Código-fonte: https://github.com/mrcandrade/$slug
"@

  # Associações de arquivo (Registry com Root: HKA = do usuário ou da máquina, conforme o modo).
  if ($cfg.assoc -and $cfg.assoc.Count -gt 0) {
    $exe = "$slug.exe"
    $lines = @('[Registry]')
    foreach ($as in $cfg.assoc) {
      $ext = $as.ext.TrimStart('.').ToLower()
      $progId = "FisiLab.$($a.name).$ext"
      $lines += "Root: HKA; Subkey: ""Software\Classes\.$ext\OpenWithProgids""; ValueType: string; ValueName: ""$progId""; ValueData: """"; Flags: uninsdeletevalue; Tasks: assoc"
      if ($as.owner) {
        $lines += "Root: HKA; Subkey: ""Software\Classes\.$ext""; ValueType: string; ValueName: """"; ValueData: ""$progId""; Flags: uninsdeletevalue; Tasks: assoc"
      }
      $lines += "Root: HKA; Subkey: ""Software\Classes\$progId""; ValueType: string; ValueName: """"; ValueData: ""$($as.description)""; Flags: uninsdeletekey; Tasks: assoc"
      $lines += "Root: HKA; Subkey: ""Software\Classes\$progId\DefaultIcon""; ValueType: string; ValueName: """"; ValueData: ""{app}\$exe,0""; Tasks: assoc"
      $lines += "Root: HKA; Subkey: ""Software\Classes\$progId\shell\open\command""; ValueType: string; ValueName: """"; ValueData: """"""{app}\$exe"""" """"%1""""""; Tasks: assoc"
      $lines += "Root: HKA; Subkey: ""Software\Classes\Applications\$exe\SupportedTypes""; ValueType: string; ValueName: "".$ext""; ValueData: """"; Flags: uninsdeletekey; Tasks: assoc"
    }
    $lines += "Root: HKA; Subkey: ""Software\Classes\Applications\$exe""; ValueType: string; ValueName: ""FriendlyAppName""; ValueData: ""$($a.name)""; Flags: uninsdeletekey; Tasks: assoc"
    Write-Text (Join-Path $stage 'assoc.iss') ($lines -join "`n")
  }

  $isccArgs = @(
    "/DAppSlug=$slug", "/DAppName=$($a.name)", "/DAppVersion=$numeric", "/DAppTagline=$($a.tagline)",
    "/DAppEquivalent=$($a.equivalent)", "/DAppUpstream=$($a.upstream)", "/DAppGuid=$($a.guid)",
    "/DStageDir=$stage", "/DOutDir=$OutDir", '/Qp'
  )
  if ($SignTool) { $isccArgs += @("/Ssigntool=$SignTool", '/DSignTool=signtool') }
  Invoke-Native "Inno Setup: $($a.name)" { & $Iscc @isccArgs (Join-Path $PSScriptRoot 'app.iss') } -Attempts 4
}

# Manifesto de downloads (todos os instaladores presentes em dist/instaladores, não só os de agora).
function Get-Entry($a) {
  $f = Get-ChildItem $OutDir -Filter "FisiLab-$($a.name)-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $f) { return $null }
  $ver = $f.BaseName.Substring("FisiLab-$($a.name)-Setup-".Length)
  [ordered]@{
    slug = $a.slug; name = $a.name; version = $ver; file = $f.Name; size = $f.Length
    sha256 = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
    date = $f.LastWriteTimeUtc.ToString('yyyy-MM-dd')
  }
}
$entries = @()
foreach ($a in $Catalog.apps) { $e = Get-Entry $a; if ($e) { $entries += $e } }

if (-not $SkipSuite -and $entries.Count -gt 0) {
  $suiteVersion = (Get-Date).ToString('yyyy.M.d')
  $suiteStage = Join-Path $StageRoot '_suite'
  New-Item -ItemType Directory -Force -Path $suiteStage | Out-Null
  Write-Text (Join-Path $suiteStage 'LICENCA.txt') @"
Suíte FisiLab
=============

Todos os programas desta suíte são software livre, distribuídos sob a licença MIT ou a licença
Apache 2.0, à sua escolha. Cada programa é uma versão modificada de um projeto de código aberto do
ArtCraft Team e de seus contribuidores (https://github.com/storytold), e instala junto os textos
completos das licenças (LICENCA.txt, LICENSE-MIT.txt, LICENSE-APACHE.txt, NOTICE.txt).

Os nomes e marcas dos projetos originais pertencem aos seus titulares; esta suíte não é afiliada
nem endossada por eles.

OS PROGRAMAS SÃO FORNECIDOS "COMO ESTÃO", SEM GARANTIAS DE QUALQUER TIPO.
"@
  $table = ($entries | ForEach-Object {
    $app = $Catalog.apps | Where-Object { $_.slug -eq $PSItem.slug } | Select-Object -First 1
    "  - $($app.name) — $($app.tagline) (alternativa ao $($app.equivalent)); baseado no $($app.upstream)"
  }) -join "`n"
  Write-Text (Join-Path $suiteStage 'SOBRE.txt') @"
Suíte FisiLab — programas livres para a UFRGS

Disponibilizada pelo FisiLab — LARFIC · UFRGS (Laboratório de Robótica, Inteligência Artificial e
Física Computacional) em parceria com o CTA — Centro de Tecnologia Acadêmica, para uso de
estudantes, professores e técnicos da UFRGS.

Programas incluídos:
$table

Na próxima tela, escolha quais programas instalar. Cada um fica registrado separadamente em
Configurações > Aplicativos e pode ser atualizado ou removido sozinho.

Créditos: todos os programas são versões modificadas de projetos de código aberto do ArtCraft Team
e de seus contribuidores, sob as licenças MIT e Apache 2.0.

Manifesto: https://github.com/mrcandrade/larfic/blob/main/suite-fisilab/MANIFESTO.md
"@
  $comp = @('[Components]')
  $files = @('[Files]')
  $run = @('[Run]')
  foreach ($e in $entries) {
    $app = $Catalog.apps | Where-Object { $_.slug -eq $e.slug } | Select-Object -First 1
    $types = 'completa personalizada'
    if ($app.category -eq 'Imagem e mídia') { $types = 'completa midia personalizada' }
    if ($app.category -eq 'Documentos') { $types = 'completa documentos personalizada' }
    if ($app.category -eq 'Engenharia') { $types = 'completa personalizada' }
    $sizeMb = [math]::Round($e.size / 1MB)
    $cid = $app.slug -replace '-', '_'   # o Inno não aceita hífen em nome de componente
    $comp += "Name: ""$cid""; Description: ""$($app.name) — $($app.tagline) (alternativa ao $($app.equivalent))""; Types: $types; ExtraDiskSpaceRequired: $($e.size * 3)"
    $files += "Source: ""{#InstallersDir}\$($e.file)""; DestDir: ""{tmp}""; Flags: deleteafterinstall; Components: $cid"
    $run += "Filename: ""{tmp}\$($e.file)""; Parameters: ""/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- {code:ModeSwitch}""; StatusMsg: ""Instalando $($app.name)…""; Flags: waituntilterminated; Components: $cid"
  }
  Write-Text (Join-Path $PSScriptRoot 'suite-apps.iss') (($comp + '' + $files + '' + $run) -join "`n")
  $isccArgs = @("/DSuiteVersion=$suiteVersion", "/DInstallersDir=$OutDir", "/DOutDir=$OutDir", "/DTextDir=$suiteStage", '/Qp')
  if ($SignTool) { $isccArgs += @("/Ssigntool=$SignTool", '/DSignTool=signtool') }
  Invoke-Native 'Inno Setup: Suíte FisiLab' { & $Iscc @isccArgs (Join-Path $PSScriptRoot 'suite.iss') } -Attempts 4
  $sf = Get-Item (Join-Path $OutDir "SuiteFisiLab-Setup-$suiteVersion.exe")
  $suiteEntry = [ordered]@{
    slug = 'suite'; name = 'Suíte FisiLab'; version = $suiteVersion; file = $sf.Name; size = $sf.Length
    sha256 = (Get-FileHash $sf.FullName -Algorithm SHA256).Hash.ToLower(); date = $sf.LastWriteTimeUtc.ToString('yyyy-MM-dd')
  }
}

$out = [ordered]@{ generated = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); suite = $suiteEntry; apps = $entries }
$json = $out | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $OutDir 'manifest.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "`nInstaladores em $OutDir" -ForegroundColor Green
Get-ChildItem $OutDir -Filter *.exe | ForEach-Object { '{0,-40} {1,8:N1} MB' -f $_.Name, ($_.Length / 1MB) }
