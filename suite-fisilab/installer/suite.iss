; Instalador da Suíte FisiLab completa (Inno Setup 6).
;
; Leva dentro os instaladores individuais (<Nome>-Setup-<versão>.exe) e roda, em modo silencioso,
; os dos aplicativos marcados. Assim cada app fica registrado sozinho em "Aplicativos instalados",
; pode ser atualizado pelo instalador dele e desinstalado separadamente.
;
; Gerado/compilado por build-installers.ps1, que escreve suite-apps.iss (a lista de componentes) e passa:
;   /DSuiteVersion=2026.10 /DInstallersDir=...\dist\instaladores /DOutDir=...\dist\instaladores
;   /DTextDir=...\dist\stage\_suite

#ifndef SuiteVersion
  #error Use build-installers.ps1 (faltou /DSuiteVersion)
#endif

#define Publisher "FisiLab — LARFIC/UFRGS"
#define SuiteUrl "https://github.com/mrcandrade/larfic/tree/main/suite-fisilab"
#define Images AddBackslash(SourcePath) + "images\"

[Setup]
AppId={{D6979A8B-F201-5F65-A244-B8AF3371ED58}
AppName=Suíte FisiLab
AppVersion={#SuiteVersion}
AppVerName=Suíte FisiLab {#SuiteVersion}
AppPublisher={#Publisher}
AppPublisherURL={#SuiteUrl}
AppComments=Programas livres para estudantes, professores e técnicos da UFRGS. Disponibilizado pelo FisiLab em parceria com o CTA.
VersionInfoVersion={#SuiteVersion}
VersionInfoCompany={#Publisher}
VersionInfoDescription=Instalador da Suíte FisiLab
VersionInfoProductName=Suíte FisiLab
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; O instalador da suíte não instala arquivos próprios nem fica registrado: quem fica registrado é
; cada aplicativo.
CreateAppDir=no
Uninstallable=no
DisableProgramGroupPage=yes
LicenseFile={#TextDir}\LICENCA.txt
InfoBeforeFile={#TextDir}\SOBRE.txt
OutputDir={#OutDir}
OutputBaseFilename=SuiteFisiLab-Setup-{#SuiteVersion}
SetupIconFile={#Images}suite.ico
WizardStyle=modern
WizardImageFile={#Images}wizard-100.bmp,{#Images}wizard-200.bmp
WizardSmallImageFile={#Images}small-suite-100.bmp,{#Images}small-suite-200.bmp
; Os instaladores internos já vêm comprimidos com LZMA2; comprimir de novo só gasta tempo.
Compression=none
#ifdef SignTool
SignTool={#SignTool}
#endif

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "completa"; Description: "Instalação completa (todos os programas)"
Name: "midia"; Description: "Imagem, vídeo e áudio"
Name: "documentos"; Description: "Documentos e escritório"
Name: "personalizada"; Description: "Personalizada (escolher os programas)"; Flags: iscustom

#include AddBackslash(SourcePath) + "suite-apps.iss"

[Code]
// Os instaladores internos seguem o modo escolhido aqui: só para este usuário ou para todos.
function ModeSwitch(Param: String): String;
begin
  if IsAdminInstallMode then
    Result := '/ALLUSERS'
  else
    Result := '/CURRENTUSER';
end;
