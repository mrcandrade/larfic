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

A Suíte FisiLab é o primeiro projeto do LARFIC: dez programas de código aberto para o dia a dia
acadêmico, com nomes em português, ícones próprios, tela de abertura com a logo do CTA,
interface em português (quando o programa tem tradução) e instaladores simples para Windows. Não é preciso usar o
GitHub nem compilar nada: basta baixar o instalador.

## Programas

| | Programa | Para que serve | Substitui | Baseado em |
|---|---|---|---|---|
| <img src="brand/icons/fisilab-foto/fisilab-foto-64.png" width="32"> | **Foto** | Editor de imagens | Adobe Photoshop | [PhotoCraft](https://github.com/storytold/photocraft) |
| <img src="brand/icons/fisilab-filme/fisilab-filme-64.png" width="32"> | **Filme** | Editor de vídeo | Adobe Premiere Pro | [FilmCraft](https://github.com/storytold/filmcraft) |
| <img src="brand/icons/fisilab-revela/fisilab-revela-64.png" width="32"> | **Revela** | Revelação e catálogo de fotos | Adobe Lightroom | [LightCraft](https://github.com/storytold/lightcraft) |
| <img src="brand/icons/fisilab-efeitos/fisilab-efeitos-64.png" width="32"> | **Efeitos** | Animação gráfica e composição | Adobe After Effects | [EffectCraft](https://github.com/storytold/effectcraft) |
| <img src="brand/icons/fisilab-texto/fisilab-texto-64.png" width="32"> | **Texto** | Processador de texto | Microsoft Word | [WordCraft](https://github.com/storytold/wordcraft) |
| <img src="brand/icons/fisilab-planilha/fisilab-planilha-64.png" width="32"> | **Planilha** | Planilhas | Microsoft Excel | [GridCraft](https://github.com/storytold/gridcraft) |
| <img src="brand/icons/fisilab-slides/fisilab-slides-64.png" width="32"> | **Slides** | Apresentações | Microsoft PowerPoint | [DeckCraft](https://github.com/storytold/deckcraft) |
| <img src="brand/icons/fisilab-pdf/fisilab-pdf-64.png" width="32"> | **PDF** | Leitor e editor de PDF | Adobe Acrobat | [PdfCraft](https://github.com/storytold/pdfcraft) |
| <img src="brand/icons/fisilab-layout/fisilab-layout-64.png" width="32"> | **Layout** | Diagramação e editoração | Adobe InDesign | [DesignCraft](https://github.com/storytold/designcraft) |
| <img src="brand/icons/fisilab-cad/fisilab-cad-64.png" width="32"> | **CAD** | Desenho técnico e CAD | Autodesk AutoCAD | [CADCraft](https://github.com/storytold/cadcraft) |

O código de cada programa fica em um repositório próprio (`github.com/mrcandrade/fisilab-<nome>`, por exemplo `fisilab-foto`),
incluído aqui como submódulo em [`apps/`](apps/).

## Instalação

Para quem vai **usar** os programas:

1. Acesse o portal de downloads da suíte (no servidor da UFRGS) ou a página de *Releases* deste
   repositório.
2. Baixe **`SuiteFisiLab-Setup-<data>.exe`** (todos os programas, você escolhe quais na instalação)
   ou só o instalador do programa que quiser, por exemplo `FisiLab-Foto-Setup-0.9.0.exe`.
3. Execute o instalador. **Não é preciso senha de administrador**: por padrão, ele instala só para
   o seu usuário. Em laboratórios, quem administra pode escolher "para todos os usuários".

Requisitos: Windows 10 ou 11 de 64 bits. Se o Windows mostrar "O Windows protegeu o computador",
clique em *Mais informações* › *Executar assim mesmo* (veja [Assinatura de código](#assinatura-de-código)).

Instalação sem interação (laboratórios, imagens de máquina):

```bat
SuiteFisiLab-Setup-<data>.exe /VERYSILENT /ALLUSERS /COMPONENTS="fisilab_foto,fisilab_texto,fisilab_planilha"
FisiLab-Foto-Setup-0.9.0.exe /VERYSILENT /ALLUSERS /NORESTART
```

## O que muda em relação aos projetos originais

Em todos os programas:

- **Nome e marca próprios.** O nome, o wordmark e os logos "ArtCraft" são marcas registradas e não
  fazem parte da licença aberta, então foram retirados e substituídos.
- **Paleta de cores original de cada programa**, com as opções **"Noite"** (escura) e **"Dia"**
  (clara) no seletor de temas. O tema padrão é o mesmo do projeto original; os outros temas
  originais continuam disponíveis.
- **Tela de abertura** com a logo do CTA animada (clique ou tecla para pular).
- **Janela "Sobre a Suíte FisiLab"** (menu Ajuda) com créditos ao projeto original, o manifesto e as
  logos da UFRGS e do CTA.
- **Interface em português (Brasil) na primeira execução**, quando o programa tem a tradução
  (o Slides ainda não tem e abre em inglês).
- Links de comunidade apontando para a suíte; nada envia dados para os servidores do projeto original.
- Ícones, executáveis (`fisilab-foto.exe` etc.), identificadores e pastas de configuração novos, para
  não conflitar com instalações do original.

Cada repositório tem um `MODIFICACOES.md` com a lista detalhada.

## Créditos

Os programas da Suíte FisiLab **não foram escritos do zero pelo FisiLab**. São versões modificadas
de projetos de código aberto criados pelo **ArtCraft Team e por seus contribuidores**
([github.com/storytold](https://github.com/storytold)), publicados sob a licença **MIT ou Apache 2.0**,
à escolha de quem usa. Todo o trabalho de edição, formatos de arquivo e ferramentas é deles.

O FisiLab adaptou o nome, os ícones, a tela de abertura, a janela Sobre, os textos e o
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
│   ├── fisilab-brand/        crate Rust: tela de abertura (CTA), janela Sobre e cores da marca
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
powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1 -Apps fisilab-foto,fisilab-pdf
```

Os instaladores e o `manifest.json` (versões, tamanhos e SHA-256) ficam em `dist/instaladores/`.

### Publicar no servidor da UFRGS

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publicar-portal.ps1
```

Isso monta `dist/portal/`, o site completo com os instaladores. O passo a passo para o servidor
está em [portal/LEIAME.md](portal/LEIAME.md).

### Mudar a identidade visual

A tela de abertura, a janela Sobre e as cores da marca ficam em um só lugar,
[`brand/fisilab-brand`](brand/fisilab-brand). Depois de alterar, rode
`scripts\sync-brand.ps1` para copiar o crate para os dez programas e gere novos instaladores.

### Assinatura de código

Instaladores sem assinatura digital mostram o aviso do SmartScreen. Para eliminá-lo, a UFRGS pode
usar um certificado de assinatura de código (OV/EV) e gerar os instaladores com:

```powershell
installer\build-installers.ps1 -SignTool 'signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /a $f'
```

### Atualizar a partir dos projetos originais

Cada repositório de programa mantém o original como `upstream`:

```bash
cd apps/fisilab-foto
git fetch upstream && git merge upstream/main   # resolva conflitos, rode os testes
```

---

<p align="center">
  <img src="../assets/ufrgs-logo.gif" alt="UFRGS" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="../assets/cta-logo.webp" alt="CTA — Centro de Tecnologia Acadêmica" height="56">
</p>
