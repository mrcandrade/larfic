# Suíte FisiLab — instalação e manutenção

O [README](README.md) desta pasta é o [Manifesto pelas Tecnologias Livres](MANIFESTO.md). Este arquivo
reúne as informações práticas: como instalar, o que foi alterado nos programas e como gerar e
publicar os instaladores. Sobre os dados que cada programa guarda, veja [PRIVACIDADE.md](PRIVACIDADE.md).

## Instalação

Para quem vai **usar** os programas:

1. Acesse a página de downloads: https://github.com/mrcandrade/larfic/releases/latest
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

### Linux

Na mesma página de downloads há, para cada programa (Ubuntu 22.04 ou mais novo, ou equivalente, 64 bits):

- **AppImage** (`FisiLab-Foto-0.9.0-x86_64.AppImage`): baixe, marque como executável
  (`chmod +x FisiLab-Foto-0.9.0-x86_64.AppImage`, ou *Propriedades › Permitir executar*) e abra.
  Não precisa de senha de administrador.
- **.deb** (`fisilab-foto_0.9.0_amd64.deb`), para Ubuntu e Debian, com atalho no menu:
  `sudo apt install ./fisilab-foto_0.9.0_amd64.deb`.

Os pacotes Linux são gerados pelo GitHub Actions (`.github/workflows/linux.yml` na raiz do
repositório) sempre que uma Release é publicada.

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
└── scripts/
    ├── sync-brand.ps1        copia brand/fisilab-brand para todos os programas
    ├── publicar-github.sh    cria os repositórios dos programas e os submódulos
    └── publicar-release.sh   publica os instaladores como Release do repositório larfic
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

Os pacotes Linux não são gerados aqui: ao publicar a Release (próxima seção), o workflow
`Linux (AppImage e .deb)` do GitHub Actions compila os dez programas no Ubuntu 22.04 e anexa os
pacotes e o `SHA256SUMS-linux.txt` à mesma Release. Para refazer só os pacotes Linux: Actions ›
*Linux (AppImage e .deb)* › *Run workflow*, informando a tag.

### Publicar os instaladores

```bash
bash suite-fisilab/scripts/publicar-release.sh
```

Isso cria (ou atualiza) a Release `suite-<data>` do repositório `larfic` com os instaladores, o
`manifest.json` e o `SHA256SUMS.txt`. O endereço `releases/latest` passa a apontar para ela.

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
