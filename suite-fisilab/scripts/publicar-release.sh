#!/usr/bin/env bash
# Publica os instaladores de dist/instaladores como uma Release do repositório LARFIC no GitHub.
#
# Cria a tag suite-<versão da suíte> (lida do manifest.json gerado por build-installers.ps1) e envia
# o instalador da suíte completa, os 10 instaladores individuais, o manifest.json e um
# SHA256SUMS.txt, com o texto da página gerado por notas_release.py. O link "latest" fica estável:
#   https://github.com/<dono>/larfic/releases/latest/download/<arquivo>
#
# Uso (Git Bash, na raiz do repositório larfic):
#   bash suite-fisilab/scripts/publicar-release.sh
set -euo pipefail

OWNER="${OWNER:-mrcandrade}"
SUITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$SUITE_DIR/dist/instaladores"
MANIFEST="$DIST/manifest.json"
[ -f "$MANIFEST" ] || { echo "erro: $MANIFEST não existe (rode installer/build-installers.ps1)" >&2; exit 1; }

VERSION=$(python -c "import json,sys; m=json.load(open(sys.argv[1],encoding='utf-8')); print(m['suite']['version'])" "$MANIFEST")
TAG="suite-$VERSION"

cd "$DIST"
: > SHA256SUMS.txt
for f in *.exe; do sha256sum "$f" >> SHA256SUMS.txt; done

NOTES=$(PYTHONIOENCODING=utf-8 python -X utf8 "$SUITE_DIR/scripts/notas_release.py" "$MANIFEST" "$SUITE_DIR/apps.json" "$OWNER/larfic" "$TAG")

if gh release view "$TAG" --repo "$OWNER/larfic" >/dev/null 2>&1; then
  gh release upload "$TAG" --repo "$OWNER/larfic" --clobber ./*.exe manifest.json SHA256SUMS.txt
  gh release edit "$TAG" --repo "$OWNER/larfic" --notes "$NOTES" >/dev/null
else
  gh release create "$TAG" --repo "$OWNER/larfic" --title "Suíte FisiLab $VERSION" --notes "$NOTES" --latest \
    ./*.exe manifest.json SHA256SUMS.txt
fi
echo "Release: https://github.com/$OWNER/larfic/releases/tag/$TAG"
