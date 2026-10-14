; Instalador de UM aplicativo da Suíte FisiLab (Inno Setup 6).
;
; Não chame direto: use build-installers.ps1, que compila o app, monta a pasta de staging e passa:
;   /DAppSlug=fisilab-foto /DAppName=Foto /DAppVersion=0.9.0 /DAppTagline="Editor de imagens"
;   /DAppEquivalent="Adobe Photoshop" /DAppUpstream=PhotoCraft /DAppGuid={...}
;   /DStageDir=...\dist\stage\fisilab-foto /DOutDir=...\dist\instaladores
;
; O staging tem: <slug>.exe, <slug>-cli.exe, os arquivos de dados do app, LICENCA.txt, SOBRE.txt,
; NOTICE.txt, MODIFICACOES.md e (opcional) assoc.iss com as associações de arquivo do app.

#ifndef AppSlug
  #error Use build-installers.ps1 (faltou /DAppSlug)
#endif

#define Publisher "FisiLab — LARFIC/UFRGS"
#define SuiteUrl "https://github.com/mrcandrade/larfic/tree/main/suite-fisilab"
#define Images AddBackslash(SourcePath) + "images\"

[Setup]
AppId={{{#AppGuid}}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#Publisher}
AppPublisherURL={#SuiteUrl}
AppSupportURL=https://github.com/mrcandrade/{#AppSlug}/issues
AppUpdatesURL={#SuiteUrl}
AppComments={#AppTagline} — alternativa livre ao {#AppEquivalent}. Baseado no {#AppUpstream} (ArtCraft Team e contribuidores). Disponibilizado pelo FisiLab em parceria com o CTA.
AppCopyright=Baseado no {#AppUpstream} (© ArtCraft Team e contribuidores). Modificações © 2026 {#Publisher}. MIT OR Apache-2.0.
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#Publisher}
VersionInfoDescription=Instalador do {#AppName} — Suíte FisiLab
VersionInfoProductName={#AppName}
; Sem administrador por padrão (alunos instalam em computadores pessoais e de laboratório);
; o assistente oferece "para todos os usuários" a quem tiver permissão.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DefaultDirName={autopf}\Suite FisiLab\{#AppName}
DefaultGroupName=Suíte FisiLab
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
LicenseFile={#StageDir}\LICENCA.txt
InfoBeforeFile={#StageDir}\SOBRE.txt
OutputDir={#OutDir}
OutputBaseFilename=FisiLab-{#AppName}-Setup-{#AppVersion}
SetupIconFile={#StageDir}\{#AppSlug}.ico
UninstallDisplayIcon={app}\{#AppSlug}.exe
UninstallDisplayName={#AppName} (Suíte FisiLab)
WizardStyle=modern
WizardImageFile={#Images}wizard-100.bmp,{#Images}wizard-200.bmp
WizardSmallImageFile={#Images}small-{#AppSlug}-100.bmp,{#Images}small-{#AppSlug}-200.bmp
Compression=lzma2/max
SolidCompression=yes
ChangesAssociations=yes
CloseApplications=yes
RestartApplications=no
#ifdef SignTool
SignTool={#SignTool}
SignedUninstaller=yes
#endif

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
ptbr.AppDesc={#AppTagline} — alternativa livre ao {#AppEquivalent}
en.AppDesc={#AppTagline} — free alternative to {#AppEquivalent}
ptbr.Assoc=Associar arquivos ao {#AppName}
en.Assoc=Associate files with {#AppName}
ptbr.AssocGroup=Associações de arquivo:
en.AssocGroup=File associations:
ptbr.SuiteSite=Site da Suíte FisiLab
en.SuiteSite=Suíte FisiLab website

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
#ifexist AddBackslash(StageDir) + "assoc.iss"
Name: "assoc"; Description: "{cm:Assoc}"; GroupDescription: "{cm:AssocGroup}"
#endif

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Excludes: "assoc.iss,LICENCA.txt,SOBRE.txt"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\LICENCA.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\SOBRE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppSlug}.exe"; Comment: "{cm:AppDesc}"; AppUserModelID: "br.ufrgs.fisilab.{#LowerCase(AppName)}"
Name: "{group}\{cm:SuiteSite}"; Filename: "{#SuiteUrl}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppSlug}.exe"; Comment: "{cm:AppDesc}"; Tasks: desktopicon

#ifexist AddBackslash(StageDir) + "assoc.iss"
  #include AddBackslash(StageDir) + "assoc.iss"
#endif

[Run]
Filename: "{app}\{#AppSlug}.exe"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
