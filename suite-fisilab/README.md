<p align="center">
  <img src="../assets/larfic-logo.png" alt="Logo LARFIC" width="160">
</p>

<h1 align="center">Suíte FisiLab</h1>

<p align="center">
  <strong>Programas livres para estudantes, professores e técnicos da UFRGS</strong><br>
  Disponibilizada pelo <strong>FisiLab — LARFIC · UFRGS</strong> em parceria com o <strong>CTA — Centro de Tecnologia Acadêmica</strong>
</p>

<p align="center">
  <a href="MANIFESTO.md">Manifesto</a> ·
  <a href="#programas">Programas</a> ·
  <a href="#instalação">Instalação</a> ·
  <a href="#créditos">Créditos</a> ·
  <a href="#para-quem-mantém-a-suíte">Manutenção</a>
</p>

---

A Suíte FisiLab é o primeiro projeto do LARFIC: doze programas de código aberto para o dia a dia
acadêmico, com nomes em português, identidade visual da UFRGS e do CTA, tela de abertura,
interface em português por padrão e instaladores simples para Windows. Não é preciso usar o
GitHub nem compilar nada: basta baixar o instalador.

## Programas

| | Programa | Para que serve | Substitui | Baseado em |
|---|---|---|---|---|
| <img src="brand/icons/fisifoto/fisifoto-64.png" width="32"> | **FisiFoto** | Editor de imagens | Adobe Photoshop | [PhotoCraft](https://github.com/storytold/photocraft) |
| <img src="brand/icons/fisivetor/fisivetor-64.png" width="32"> | **FisiVetor** | Ilustração vetorial | Adobe Illustrator | [VectorCraft](https://github.com/storytold/vectorcraft) |
| <img src="brand/icons/fisifilme/fisifilme-64.png" width="32"> | **FisiFilme** | Editor de vídeo | Adobe Premiere Pro | [FilmCraft](https://github.com/storytold/filmcraft) |
| <img src="brand/icons/fisirevela/fisirevela-64.png" width="32"> | **FisiRevela** | Revelação e catálogo de fotos | Adobe Lightroom | [LightCraft](https://github.com/storytold/lightcraft) |
| <img src="brand/icons/fisiefeitos/fisiefeitos-64.png" width="32"> | **FisiEfeitos** | Animação gráfica e composição | Adobe After Effects | [EffectCraft](https://github.com/storytold/effectcraft) |
| <img src="brand/icons/fisisom/fisisom-64.png" width="32"> | **FisiSom** | Gravação e edição de áudio | Avid Pro Tools | [SoundCraft](https://github.com/storytold/soundcraft) |
| <img src="brand/icons/fisitexto/fisitexto-64.png" width="32"> | **FisiTexto** | Processador de texto | Microsoft Word | [WordCraft](https://github.com/storytold/wordcraft) |
| <img src="brand/icons/fisiplanilha/fisiplanilha-64.png" width="32"> | **FisiPlanilha** | Planilhas | Microsoft Excel | [GridCraft](https://github.com/storytold/gridcraft) |
| <img src="brand/icons/fisislides/fisislides-64.png" width="32"> | **FisiSlides** | Apresentações | Microsoft PowerPoint | [DeckCraft](https://github.com/storytold/deckcraft) |
| <img src="brand/icons/fisipdf/fisipdf-64.png" width="32"> | **FisiPDF** | Leitor e editor de PDF | Adobe Acrobat | [PdfCraft](https://github.com/storytold/pdfcraft) |
| <img src="brand/icons/fisilayout/fisilayout-64.png" width="32"> | **FisiLayout** | Diagramação e editoração | Adobe InDesign | [DesignCraft](https://github.com/storytold/designcraft) |
| <img src="brand/icons/fisicad/fisicad-64.png" width="32"> | **FisiCAD** | Desenho técnico e CAD | Autodesk AutoCAD | [CADCraft](https://github.com/storytold/cadcraft) |

O código de cada programa fica em um repositório próprio (`github.com/mrcandrade/<nome>`),
incluído aqui como submódulo em [`apps/`](apps/).

## Instalação

Para quem vai **usar** os programas:

1. Acesse o portal de downloads da suíte (no servidor da UFRGS) ou a página de *Releases* deste
   repositório.
2. Baixe **`SuiteFisiLab-Setup-<data>.exe`** (todos os programas, você escolhe quais na instalação)
   ou só o instalador do programa que quiser, por exemplo `FisiFoto-Setup-0.9.0.exe`.
3. Execute o instalador. **Não é preciso senha de administrador**: por padrão, ele instala só para
   o seu usuário. Em laboratórios, quem administra pode escolher "para todos os usuários".

Requisitos: Windows 10 ou 11 de 64 bits. Se o Windows mostrar "O Windows protegeu o computador",
clique em *Mais informações* › *Executar assim mesmo* (veja [Assinatura de código](#assinatura-de-código)).

Instalação sem interação (laboratórios, imagens de máquina):

```bat
SuiteFisiLab-Setup-<data>.exe /VERYSILENT /ALLUSERS /COMPONENTS="fisifoto,fisitexto,fisiplanilha"
FisiFoto-Setup-0.9.0.exe /VERYSILENT /ALLUSERS /NORESTART
```

## O que muda em relação aos projetos originais

Em todos os programas:

- **Nome e marca próprios.** O nome, o wordmark e os logos "ArtCraft" são marcas registradas e não
  fazem parte da licença aberta, então foram retirados e substituídos.
- **Tema de cores "UFRGS Noite" (padrão) e "UFRGS Dia"**, com as cores das logos do LARFIC, da UFRGS
  e do CTA ([paleta](brand/fisilab-brand/src/palette.rs)). Os temas originais continuam disponíveis.
- **Tela de abertura** com a logo do CTA animada (clique ou tecla para pular).
- **Janela "Sobre a Suíte FisiLab"** (menu Ajuda) com créditos ao projeto original, o manifesto e as
  logos da UFRGS e do CTA.
- **Interface em português (Brasil) por padrão**, quando o programa tem a tradução.
- Links de comunidade apontando para a suíte; nada envia dados para os servidores do projeto original.
- Ícones, executáveis (`fisifoto.exe` etc.), identificadores e pastas de configuração novos, para
  não conflitar com instalações do original.

Cada repositório tem um `MODIFICACOES.md` com a lista detalhada.

## Créditos

Os programas da Suíte FisiLab **não foram escritos do zero pelo FisiLab**. São versões modificadas
de projetos de código aberto criados pelo **ArtCraft Team e por seus contribuidores**
([github.com/storytold](https://github.com/storytold)), publicados sob a licença **MIT ou Apache 2.0**,
à escolha de quem usa. Todo o trabalho de edição, formatos de arquivo e ferramentas é deles.

O FisiLab adaptou o nome, a identidade visual, o tema de cores, a tela de abertura, os textos e o
instalador, e distribui a suíte para a comunidade da UFRGS. As modificações são publicadas sob as
mesmas licenças. Os nomes e marcas dos projetos originais pertencem aos seus titulares; esta suíte
não é afiliada nem endossada por eles. Adobe, Microsoft, Autodesk e Avid, e os nomes dos seus
programas, são marcas de seus titulares e aparecem aqui só para indicar a finalidade de cada
programa.

Componentes de terceiros (fontes, ícones, bibliotecas) estão listados no `NOTICE` e no
`ATTRIBUTION.md` de cada programa, e são instalados junto com ele.

## Manifesto

> Conhecimento produzido em uma universidade pública deve circular livremente. Por isso, as
> ferramentas que usamos para ensinar, pesquisar e criar também devem ser livres.

Leia o [Manifesto pelas Tecnologias Livres](MANIFESTO.md).

---

## Para quem mantém a suíte

### Estrutura

```
suite-fisilab/
├── apps.json                 catálogo: nomes, descrições, equivalentes, projeto de origem
├── MANIFESTO.md
├── apps/<nome>/              submódulos: um repositório por programa
├── brand/
│   ├── fisilab-brand/        crate Rust: paleta, tela de abertura (CTA) e janela Sobre
│   └── icons/<nome>/         ícones gerados (.ico e .png)
├── installer/
│   ├── app.iss               instalador de um programa (Inno Setup 6)
│   ├── suite.iss             instalador da suíte (leva os instaladores individuais)
│   ├── apps/<nome>.json      como compilar e empacotar cada programa
│   ├── images/               imagens do assistente de instalação
│   └── build-installers.ps1  compila tudo e gera os .exe + manifest.json
├── portal/                   site de downloads em PHP (para o servidor da UFRGS)
└── scripts/
    ├── sync-brand.ps1        copia brand/fisilab-brand para todos os programas
    └── publicar-portal.ps1   monta dist/portal pronto para enviar ao servidor
```

### Gerar os instaladores

Requisitos (Windows): [Rust](https://rustup.rs) com MSVC, Visual Studio Build Tools com o SDK do
Windows e [Inno Setup 6](https://jrsoftware.org/isinfo.php) (`winget install JRSoftware.InnoSetup`).

```powershell
git clone --recurse-submodules https://github.com/mrcandrade/larfic
cd larfic\suite-fisilab
powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1          # todos
powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1 -Apps fisifoto,fisipdf
```

Os instaladores e o `manifest.json` (versões, tamanhos e SHA-256) ficam em `dist/instaladores/`.

### Publicar no servidor da UFRGS

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publicar-portal.ps1
```

Isso monta `dist/portal/`, o site completo com os instaladores. O passo a passo para o servidor
está em [portal/LEIAME.md](portal/LEIAME.md).

### Mudar a identidade visual

A paleta, a tela de abertura e a janela Sobre ficam em um só lugar,
[`brand/fisilab-brand`](brand/fisilab-brand). Depois de alterar, rode
`scripts\sync-brand.ps1` para copiar o crate para os doze programas e gere novos instaladores.

### Assinatura de código

Instaladores sem assinatura digital mostram o aviso do SmartScreen. Para eliminá-lo, a UFRGS pode
usar um certificado de assinatura de código (OV/EV) e gerar os instaladores com:

```powershell
installer\build-installers.ps1 -SignTool 'signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /a $f'
```

### Atualizar a partir dos projetos originais

Cada repositório de programa mantém o original como `upstream`:

```bash
cd apps/fisifoto
git fetch upstream && git merge upstream/main   # resolva conflitos, rode os testes
```

---

<p align="center">
  <img src="../assets/ufrgs-logo.gif" alt="UFRGS" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="../assets/cta-logo.webp" alt="CTA — Centro de Tecnologia Acadêmica" height="56">
</p>
