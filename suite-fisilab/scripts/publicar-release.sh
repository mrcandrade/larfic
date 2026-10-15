#!/usr/bin/env bash
# Publica os instaladores de dist/instaladores como uma Release do repositório LARFIC no GitHub.
#
# Cria a tag suite-<versão da suíte> (lida do manifest.json gerado por build-installers.ps1) e envia
# o instalador da suíte completa, os 12 instaladores individuais, o manifest.json e um
# SHA256SUMS.txt. O link "latest" fica estável:
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

NOTES=$(python - "$MANIFEST" <<'EOF'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
s = m["suite"]
print("Programas livres para democratizar o acesso à tecnologia entre os alunos da UFRGS, disponibilizados pelo")
print("FisiLab — LARFIC · UFRGS em parceria com o CTA — Centro de Tecnologia Acadêmica.\n")
print(f"**Para instalar tudo:** baixe `{s['file']}` ({s['size']/1048576:.0f} MB), execute e escolha os programas.")
print("Não precisa de senha de administrador. Windows 10/11 de 64 bits.\n")
print("| Programa | Versão | Instalador | Tamanho |\n|---|---|---|---|")
for a in m["apps"]:
    print(f"| {a['name']} | {a['version']} | `{a['file']}` | {a['size']/1048576:.0f} MB |")
print("\nSe o Windows mostrar \"O Windows protegeu o computador\", clique em *Mais informações* › *Executar assim mesmo*.")
print("Confira a integridade com `Get-FileHash <arquivo>` e compare com `SHA256SUMS.txt`.\n")
print("Os programas são versões modificadas de projetos de código aberto do ArtCraft Team e contribuidores")
print("(MIT ou Apache 2.0). Veja os créditos e o manifesto em `suite-fisilab/`.")
EOF
)

if gh release view "$TAG" --repo "$OWNER/larfic" >/dev/null 2>&1; then
  gh release upload "$TAG" --repo "$OWNER/larfic" --clobber ./*.exe manifest.json SHA256SUMS.txt
  gh release edit "$TAG" --repo "$OWNER/larfic" --notes "$NOTES" >/dev/null
else
  gh release create "$TAG" --repo "$OWNER/larfic" --title "Suíte FisiLab $VERSION" --notes "$NOTES" --latest \
    ./*.exe manifest.json SHA256SUMS.txt
fi
echo "Release: https://github.com/$OWNER/larfic/releases/tag/$TAG"
