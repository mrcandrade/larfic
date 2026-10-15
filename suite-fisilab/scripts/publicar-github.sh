#!/usr/bin/env bash
# Publica os 10 programas da Suíte FisiLab no GitHub e os liga ao repositório LARFIC.
#
# Para cada programa:
#   1. cria o fork do projeto original com o nome novo (ex.: storytold/photocraft -> <dono>/fisilab-foto),
#      o que mantém o histórico e mostra no GitHub de onde o código veio;
#   2. aponta o repositório local para o fork (origin) e o original (upstream) e envia a branch main;
#   3. ajusta descrição e site do repositório.
# Depois adiciona os 12 como submódulos em suite-fisilab/apps/ do repositório LARFIC.
#
# Uso (Git Bash):
#   bash suite-fisilab/scripts/publicar-github.sh /c/Users/Maxter/Desktop/fisilab-work/apps
#
# Precisa do gh autenticado (gh auth status) na conta dona dos repositórios.
set -euo pipefail

APPS_DIR="${1:?informe a pasta com os repositórios dos programas}"
OWNER="${OWNER:-mrcandrade}"
SUITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARFIC_DIR="$(cd "$SUITE_DIR/.." && pwd)"
HOMEPAGE="${HOMEPAGE:-https://github.com/$OWNER/larfic/releases/latest}"

# upstream  nome-novo  Nome  descrição
while IFS='|' read -r up slug name desc; do
  echo "=== $name ($up -> $OWNER/$slug)"
  if ! gh repo view "$OWNER/$slug" >/dev/null 2>&1; then
    gh repo fork "storytold/$up" --fork-name "$slug" --clone=false --default-branch-only
  fi
  gh repo edit "$OWNER/$slug" --description "$desc" --homepage "$HOMEPAGE" >/dev/null
  cd "$APPS_DIR/$slug"
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$OWNER/$slug.git"
  git remote remove upstream 2>/dev/null || true
  git remote add upstream "https://github.com/storytold/$up.git"
  # O fork recém-criado tem o histórico do original; nosso commit fica por cima dele.
  git fetch origin main
  if git merge-base --is-ancestor origin/main HEAD; then
    git push origin HEAD:main
  else
    # O original avançou depois do nosso clone: publica numa branch e avisa.
    git push origin HEAD:refs/heads/suite-fisilab
    echo "AVISO: $slug: o original tem commits novos; publicado na branch suite-fisilab (faça o merge e depois envie para main)."
  fi
  cd - >/dev/null
done <<'EOF'
photocraft|fisilab-foto|Foto|Foto — editor de imagens livre (alternativa ao Adobe Photoshop). Suíte FisiLab · UFRGS, baseado no PhotoCraft.
filmcraft|fisilab-filme|Filme|Filme — editor de vídeo livre (alternativa ao Adobe Premiere Pro). Suíte FisiLab · UFRGS, baseado no FilmCraft.
lightcraft|fisilab-revela|Revela|Revela — revelação e catálogo de fotos (alternativa ao Adobe Lightroom). Suíte FisiLab · UFRGS, baseado no LightCraft.
pdfcraft|fisilab-pdf|PDF|PDF — leitor e editor de PDF livre (alternativa ao Adobe Acrobat). Suíte FisiLab · UFRGS, baseado no PdfCraft.
effectcraft|fisilab-efeitos|Efeitos|Efeitos — animação gráfica e composição (alternativa ao Adobe After Effects). Suíte FisiLab · UFRGS, baseado no EffectCraft.
designcraft|fisilab-layout|Layout|Layout — diagramação e editoração (alternativa ao Adobe InDesign). Suíte FisiLab · UFRGS, baseado no DesignCraft.
wordcraft|fisilab-texto|Texto|Texto — processador de texto livre (alternativa ao Microsoft Word). Suíte FisiLab · UFRGS, baseado no WordCraft.
deckcraft|fisilab-slides|Slides|Slides — apresentações (alternativa ao Microsoft PowerPoint). Suíte FisiLab · UFRGS, baseado no DeckCraft.
gridcraft|fisilab-planilha|Planilha|Planilha — planilhas (alternativa ao Microsoft Excel). Suíte FisiLab · UFRGS, baseado no GridCraft.
cadcraft|fisilab-cad|CAD|CAD — desenho técnico e CAD (alternativa ao Autodesk AutoCAD). Suíte FisiLab · UFRGS, baseado no CADCraft.
EOF

# Submódulos no repositório LARFIC
cd "$LARFIC_DIR"
for slug in fisilab-foto fisilab-filme fisilab-revela fisilab-pdf fisilab-efeitos fisilab-layout fisilab-texto fisilab-slides fisilab-planilha fisilab-cad; do
  if [ ! -e "suite-fisilab/apps/$slug" ]; then
    git submodule add "https://github.com/$OWNER/$slug.git" "suite-fisilab/apps/$slug"
  fi
done
git add .gitmodules suite-fisilab/apps
git commit -m "Suíte FisiLab: repositórios dos 10 programas como submódulos" || true
git push origin main
echo "Pronto."
