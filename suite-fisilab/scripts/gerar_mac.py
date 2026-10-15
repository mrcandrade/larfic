"""Gera os arquivos de macOS de cada programa da suíte: o ícone .icns e a janela do DMG.

Para cada app de apps.json escreve:
    brand/icons/<slug>/<slug>.icns                       ícone do .app (16 a 1024 px, dos PNGs da marca)
    brand/macos-dmg/<slug>/background.tiff               fundo da janela do DMG (1x e 2x)
    brand/macos-dmg/<slug>/dmg-layout.DS_Store           tamanho da janela, ícones e fundo

A janela mostra "<Nome>.app" à esquerda, o atalho "Aplicativos" (link para /Applications) à direita e uma seta entre os dois,
com a instrução em português (a fonte embutida do Pillow não tem acentos: o texto evita acentos). O .DS_Store aponta para o fundo por um alias que inclui o nome do
volume, então o volume do DMG tem de se chamar exatamente <Nome> (sem versão).

Adaptado de packaging/macos/dmg/generate.py dos projetos originais (ArtCraft Team e contribuidores,
MIT ou Apache 2.0), sem resvg: o fundo é desenhado com Pillow e a fonte embutida dele (Aileron,
domínio público).

Precisa de: pip install "pillow>=12" ds_store==1.3.3 mac_alias==2.2.3
Uso: python -X utf8 suite-fisilab/scripts/gerar_mac.py
"""

import datetime
import json
import os
import sys

from ds_store import DSStore
from mac_alias import Alias, TargetInfo, VolumeInfo
from PIL import Image, ImageCms, ImageDraw, ImageFont

SUITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WIDTH, HEIGHT = 660, 400  # conteúdo da janela, em pt; o tamanho 1x do fundo
TITLE_BAR = 32
ICON_SIZE = 128
APP_POS, APPS_POS = (170, 215), (490, 215)
PALETTE = 16
FIXED_DATE = datetime.datetime(2026, 10, 15, tzinfo=datetime.timezone.utc)

CREME = (0xF2, 0xEA, 0xDA)
MARINHO = (0x1A, 0x25, 0x32)
VERMELHO = (0xAD, 0x2C, 0x22)
ICNS_SIZES = (16, 32, 64, 128, 256, 512, 1024)


def write_icns(slug):
    d = os.path.join(SUITE, "brand", "icons", slug)
    images = [Image.open(os.path.join(d, f"{slug}-{n}.png")).convert("RGBA") for n in ICNS_SIZES]
    out = os.path.join(d, f"{slug}.icns")
    images[-1].save(out, append_images=images[:-1])
    return out


def draw_background(name, scale):
    w, h = WIDTH * scale, HEIGHT * scale
    im = Image.new("RGB", (w, h), CREME)
    d = ImageDraw.Draw(im)
    # Faixa de cima com a instrução.
    d.rectangle([0, 0, w, 78 * scale], fill=MARINHO)
    title = ImageFont.load_default(size=24 * scale)
    d.text((w / 2, 39 * scale), "Arraste para a pasta Aplicativos", font=title, fill=CREME, anchor="mm")
    # Seta entre os ícones, fora das caixas de 128 pt (com 10 pt de folga).
    y = APP_POS[1] * scale
    x0 = (APP_POS[0] + ICON_SIZE // 2 + 22) * scale
    x1 = (APPS_POS[0] - ICON_SIZE // 2 - 22) * scale
    t = 7 * scale
    head = 22 * scale
    d.rectangle([x0, y - t, x1 - head, y + t], fill=VERMELHO)
    d.polygon([(x1 - head, y - 3 * t), (x1, y), (x1 - head, y + 3 * t)], fill=VERMELHO)
    # Rodapé.
    small = ImageFont.load_default(size=13 * scale)
    d.text((w / 2, 368 * scale), "FisiLab (LARFIC · UFRGS) e CTA · software livre",
           font=small, fill=MARINHO, anchor="mm")
    return im.quantize(PALETTE, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)


def srgb_profile():
    icc = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    d = FIXED_DATE
    icc[24:36] = b"".join(v.to_bytes(2, "big") for v in (d.year, d.month, d.day, 0, 0, 0))
    if icc[84:100] != bytes(16):
        sys.exit("erro: o perfil sRGB tem ID; recalcule depois de fixar a data")
    return bytes(icc)


def write_tiff(name, out):
    one, two = draw_background(name, 1), draw_background(name, 2)
    two.encoderinfo = {"dpi": (144, 144)}
    one.save(out, "TIFF", save_all=True, append_images=[two], compression="tiff_adobe_deflate",
             dpi=(72, 72), icc_profile=srgb_profile())
    with Image.open(out) as im:
        im.seek(1)
        if im.info.get("dpi") != (144, 144):
            sys.exit("erro: a página 2x não está em 144 dpi (precisa do Pillow 12 ou mais novo)")
        strips = []
        for page in (0, 1):
            im.seek(page)
            strips += zip(im.tag_v2[273], im.tag_v2[279])
    # Zera o byte de alinhamento que a libtiff deixa sem inicializar (saída reprodutível).
    starts = {o for o, _ in strips}
    with open(out, "r+b") as f:
        for o, n in strips:
            if (o + n) % 2 and o + n not in starts:
                f.seek(o + n)
                f.write(bytes(1))


def background_alias(volume_name):
    volume = VolumeInfo(volume_name, FIXED_DATE, b"H+", 5, 0x0D02, b"\0\0")
    volume.posix_path = f"/Volumes/{volume_name}"
    target = TargetInfo(0, "background.tiff", 25, 26, FIXED_DATE, b"\0\0\0\0", b"\0\0\0\0")
    target.folder_name = ".background"
    target.cnid_path = [25]
    target.carbon_path = f"{volume_name}:.background:\0background.tiff"
    target.posix_path = "/.background/background.tiff"
    return Alias(volume=volume, target=target).to_bytes()


def write_ds_store(name, out):
    if os.path.exists(out):
        os.remove(out)
    with DSStore.open(out, "w+") as d:
        d["."]["bwsp"] = {
            "ShowStatusBar": False,
            "ShowToolbar": False,
            "ShowTabView": False,
            "ContainerShowSidebar": False,
            "ShowSidebar": False,
            "WindowBounds": f"{{{{200, 528}}, {{{WIDTH}, {HEIGHT + TITLE_BAR}}}}}",
        }
        d["."]["icvp"] = {
            "viewOptionsVersion": 1,
            "backgroundType": 2,
            "backgroundImageAlias": background_alias(name),
            "backgroundColorRed": 1.0,
            "backgroundColorGreen": 1.0,
            "backgroundColorBlue": 1.0,
            "gridOffsetX": 0.0,
            "gridOffsetY": 0.0,
            "gridSpacing": 100.0,
            "arrangeBy": "none",
            "showIconPreview": True,
            "showItemInfo": False,
            "labelOnBottom": True,
            "textSize": 16.0,
            "iconSize": float(ICON_SIZE),
        }
        d["."]["vSrn"] = ("long", 1)
        d[f"{name}.app"]["Iloc"] = APP_POS
        d["Aplicativos"]["Iloc"] = APPS_POS


def main():
    apps = json.load(open(os.path.join(SUITE, "apps.json"), encoding="utf-8"))["apps"]
    for a in apps:
        slug, name = a["slug"], a["name"]
        icns = write_icns(slug)
        out = os.path.join(SUITE, "brand", "macos-dmg", slug)
        os.makedirs(out, exist_ok=True)
        write_tiff(name, os.path.join(out, "background.tiff"))
        write_ds_store(name, os.path.join(out, "dmg-layout.DS_Store"))
        print(f"{slug}: {os.path.relpath(icns, SUITE)}, brand/macos-dmg/{slug}/")


if __name__ == "__main__":
    main()
