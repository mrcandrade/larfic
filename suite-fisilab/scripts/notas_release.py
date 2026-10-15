"""Gera o texto da página da Release (para quem não é da área): o que baixar no Windows, no Mac e no Linux e como instalar.

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


def appimage_name(a):
    return f"FisiLab-{a['name']}-{a['version']}-x86_64.AppImage"


def link(texto, arquivo):
    return f"[{texto}]({base}/{arquivo})"


out = []
p = out.append

p("Dez programas livres e gratuitos para os alunos da UFRGS, disponibilizados pelo FisiLab (LARFIC · UFRGS)")
p("em parceria com o CTA (Centro de Tecnologia Acadêmica).")
p("")
p("> **Qual é o meu caso?** Usa Windows? Vá para [Windows](#windows). Usa Mac? Vá para [Mac](#mac).")
p("> Usa Ubuntu, Mint ou outro Linux? Vá para [Linux](#linux).")
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
p("## Mac")
p("")
p("Para macOS 11 (Big Sur) ou mais novo, em Macs com Intel ou com Apple Silicon (M1, M2, M3…). Baixe um arquivo por")
p("programa, na coluna **Mac** da [tabela de programas](#programas).")
p("")
p("1. Baixe o arquivo **.dmg** do programa e abra-o (dois cliques).")
p("2. Na janela que aparece, **arraste o ícone do programa para a pasta Aplicativos**.")
p("3. Abra o programa pela pasta **Aplicativos** ou pelo **Launchpad**.")
p("4. Na primeira vez, o Mac avisa que não pode verificar o desenvolvedor. Clique em **Concluído** (ou **OK**), abra")
p("   **Ajustes do Sistema › Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim**; confirme com")
p("   sua senha. Só é preciso fazer isso uma vez por programa.")
p("   No macOS 14 ou anterior, também dá para clicar no programa com o botão direito › **Abrir** › **Abrir**.")
p("   O aviso aparece porque o programa ainda não tem assinatura paga da Apple.")
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
p("1. Baixe o arquivo **AppImage** do programa:")
for a in manifest["apps"]:
    p(f"   - {link(a['name'], appimage_name(a))}")
p("2. Clique nele com o botão direito › **Propriedades** › **Permissões** e marque **Permitir executar como programa**")
p("   (ou, no Terminal: `chmod +x` seguido do nome do arquivo).")
p("3. Dê dois cliques para abrir.")
p("")
p("</details>")
p("")
p("## Programas")
p("")
p("| Programa | Para que serve | Windows | Mac | Linux |")
p("|---|---|---|---|---|")
for a in manifest["apps"]:
    info = apps_info.get(a["slug"], {})
    nome, versao = a["name"], a["version"]
    short = a["slug"].removeprefix("fisilab-")
    win = link("Baixar", a["file"]) + f" ({mb(a['size'])})"
    dmg = link("Baixar .dmg", f"FisiLab-{nome}-{versao}-macOS.dmg")
    deb = link("Baixar .deb", f"fisilab-{short}_{versao}_amd64.deb")
    p(f"| **{nome}** | {info.get('tagline', '')} | {win} | {dmg} | {deb} |")
p("")
p("Os programas funcionam sem internet e não coletam dados de quem usa. Veja o")
p(f"[aviso de privacidade](https://github.com/{repo}/blob/main/suite-fisilab/PRIVACIDADE.md) e o")
p(f"[manifesto](https://github.com/{repo}/blob/main/suite-fisilab/MANIFESTO.md).")
p("")
p("<details><summary>Para quem quer conferir os arquivos (opcional)</summary>")
p("")
p("A lista **Assets** abaixo tem todos os arquivos desta versão: `.exe` são os instaladores do Windows, `.dmg` são do Mac,")
p("`.deb` e `.AppImage` são do Linux. `SHA256SUMS.txt` (Windows), `SHA256SUMS-macos.txt` (Mac) e `SHA256SUMS-linux.txt`")
p("(Linux) trazem as somas de verificação, para conferir que o download não foi corrompido: no Windows,")
p("`Get-FileHash <arquivo>` no PowerShell; no Mac e no Linux, `shasum -a 256 <arquivo>` ou `sha256sum <arquivo>`. `manifest.json` é usado pelos próprios programas para avisar quando há versão nova.")
p("")
p("Os programas são versões modificadas de projetos de código aberto do ArtCraft Team e contribuidores (licenças MIT ou")
p(f"Apache 2.0). Código e créditos em [`suite-fisilab/`](https://github.com/{repo}/tree/main/suite-fisilab).")
p("")
p("</details>")

print("\n".join(out))
