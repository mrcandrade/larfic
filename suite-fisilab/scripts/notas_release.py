"""Gera o texto da página da Release (para quem não é da área): o que baixar no Windows e no Linux e como instalar.

Uso: python -X utf8 notas_release.py <manifest.json> <apps.json> <dono/repo> <tag>
"""
import json
import sys

manifest = json.load(open(sys.argv[1], encoding="utf-8"))
apps_info = {a["slug"]: a for a in json.load(open(sys.argv[2], encoding="utf-8"))["apps"]}
repo, tag = sys.argv[3], sys.argv[4]
base = f"https://github.com/{repo}/releases/download/{tag}"
suite = manifest["suite"]


def mb(size):
    return f"{size / 1048576:.0f} MB"


def link(texto, arquivo):
    return f"[{texto}]({base}/{arquivo})"


out = []
p = out.append

p("Dez programas livres e gratuitos para os alunos da UFRGS, disponibilizados pelo FisiLab (LARFIC · UFRGS)")
p("em parceria com o CTA (Centro de Tecnologia Acadêmica).")
p("")
p("> **Qual é o meu caso?** Usa Windows? Vá para [Windows](#windows). Usa Ubuntu, Mint ou outro Linux? Vá para [Linux](#linux).")
p("> Você **não** precisa abrir a lista \"Assets\" lá embaixo: os links desta página já baixam o arquivo certo.")
p("")
p("## Windows")
p("")
p("Para Windows 10 ou 11. Não precisa de senha de administrador.")
p("")
p(f"1. Baixe o instalador: **{link('⬇ Baixar a Suíte FisiLab para Windows', suite['file'])}** ({mb(suite['size'])}).")
p("2. Abra o arquivo baixado (fica na pasta **Downloads**).")
p("3. Se aparecer **\"O Windows protegeu o computador\"**, clique em **Mais informações** e depois em **Executar assim mesmo**.")
p("   O aviso aparece porque o instalador ainda não tem assinatura digital paga.")
p("4. Marque os programas que quiser, clique em **Avançar** e depois em **Instalar**.")
p("5. Pronto: os programas aparecem no **menu Iniciar**.")
p("")
p("Quer só um programa? Use a coluna **Windows** da [tabela de programas](#programas).")
p("")
p("## Linux")
p("")
p("Para Ubuntu 22.04 ou mais novo, Linux Mint 21 ou mais novo, Debian 12 e parecidos. Baixe um arquivo por programa,")
p("na coluna **Linux** da [tabela de programas](#programas).")
p("")
p("1. Baixe o arquivo **.deb** do programa.")
p("2. Dê dois cliques no arquivo baixado e clique em **Instalar** (pode pedir sua senha).")
p("   Se os dois cliques não funcionarem, abra o Terminal na pasta Downloads e digite")
p("   `sudo apt install ./` seguido do nome do arquivo.")
p("3. Pronto: o programa aparece no **menu de aplicativos**.")
p("")
p("<details><summary><b>Usa outra distribuição (Fedora, Arch…) ou não pode instalar? Use o AppImage</b></summary>")
p("")
p("O AppImage roda sem instalar:")
p("")
p("1. Baixe o arquivo **AppImage** do programa (coluna \"Sem instalar\" da tabela).")
p("2. Clique nele com o botão direito › **Propriedades** › **Permissões** e marque **Permitir executar como programa**")
p("   (ou, no Terminal: `chmod +x` seguido do nome do arquivo).")
p("3. Dê dois cliques para abrir.")
p("")
p("</details>")
p("")
p("## Programas")
p("")
p("| Programa | Para que serve | Windows | Linux | Linux (sem instalar) |")
p("|---|---|---|---|---|")
for a in manifest["apps"]:
    info = apps_info.get(a["slug"], {})
    nome, versao = a["name"], a["version"]
    short = a["slug"].removeprefix("fisilab-")
    win = link("Baixar", a["file"]) + f" ({mb(a['size'])})"
    deb = link("Baixar .deb", f"fisilab-{short}_{versao}_amd64.deb")
    appimage = link("AppImage", f"FisiLab-{nome}-{versao}-x86_64.AppImage")
    p(f"| **{nome}** | {info.get('tagline', '')} | {win} | {deb} | {appimage} |")
p("")
p("Os programas funcionam sem internet e não coletam dados de quem usa. Veja o")
p(f"[aviso de privacidade](https://github.com/{repo}/blob/main/suite-fisilab/PRIVACIDADE.md) e o")
p(f"[manifesto](https://github.com/{repo}/blob/main/suite-fisilab/MANIFESTO.md).")
p("")
p("<details><summary>Para quem quer conferir os arquivos (opcional)</summary>")
p("")
p("A lista **Assets** abaixo tem todos os arquivos desta versão: `.exe` são os instaladores do Windows, `.deb` e `.AppImage`")
p("são do Linux. `SHA256SUMS.txt` (Windows) e `SHA256SUMS-linux.txt` (Linux) trazem as somas de verificação, para")
p("conferir que o download não foi corrompido: no Windows, `Get-FileHash <arquivo>` no PowerShell; no Linux,")
p("`sha256sum <arquivo>`. `manifest.json` é usado pelos próprios programas para avisar quando há versão nova.")
p("")
p("Os programas são versões modificadas de projetos de código aberto do ArtCraft Team e contribuidores (licenças MIT ou")
p(f"Apache 2.0). Código e créditos em [`suite-fisilab/`](https://github.com/{repo}/tree/main/suite-fisilab).")
p("")
p("</details>")

print("\n".join(out))
