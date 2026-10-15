"""Gera as imagens do assistente de instalação (Inno Setup) da Suíte FisiLab.

Uso (na pasta suite-fisilab): python scripts/gerar_imagens_instalador.py <pasta com Inter-Regular.ttf e Inter-SemiBold.ttf>
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

FONTS = sys.argv[1]
ASSETS = os.path.join("..", "assets")
OUT = os.path.join("installer", "images")
NAVY, CREAM, RED = (0x1A, 0x25, 0x32), (0xF2, 0xEA, 0xDA), (0xC8, 0x40, 0x2F)

larfic = Image.open(os.path.join(ASSETS, "larfic-logo.png")).convert("RGBA")
cta = Image.open(os.path.join(ASSETS, "cta-logo.webp")).convert("RGBA")


def wizard(scale):
    """Imagem lateral (164x314 em 100%): a chama do LARFIC, o nome da suíte e a logo do CTA."""
    w, h = 164 * scale, 314 * scale
    im = Image.new("RGB", (w, h), CREAM)
    lw = int(w * 0.86)
    logo = larfic.resize((lw, lw), Image.LANCZOS)
    im.paste(logo, ((w - lw) // 2, int(h * 0.03)), logo)
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(os.path.join(FONTS, "Inter-SemiBold.ttf"), 15 * scale)
    f2 = ImageFont.truetype(os.path.join(FONTS, "Inter-Regular.ttf"), 9 * scale)
    y = int(h * 0.03) + lw + 4 * scale
    for text, font in (("Suíte FisiLab", f1), ("FisiLab — LARFIC", f2), ("em parceria com o CTA", f2)):
        d.text(((w - d.textlength(text, font=font)) / 2, y), text, font=font, fill=NAVY)
        y += font.size + 5 * scale
    d.rectangle([w * 0.3, y + 2 * scale, w * 0.7, y + 4 * scale], fill=RED)
    # Cartão branco com a logo do CTA (desenhada para fundo branco).
    card = h - 52 * scale
    d.rectangle([0, card, w, h], fill=(255, 255, 255))
    ch = 30 * scale
    logo = cta.resize((int(ch * cta.width / cta.height), ch), Image.LANCZOS)
    if logo.width > w - 16 * scale:
        logo = cta.resize((w - 16 * scale, int((w - 16 * scale) * cta.height / cta.width)), Image.LANCZOS)
    im.paste(logo, ((w - logo.width) // 2, card + (52 * scale - logo.height) // 2), logo)
    im.save(os.path.join(OUT, f"wizard-{scale * 100}.bmp"))


def small(name, src, scale, bg):
    px = 55 * scale
    canvas = Image.new("RGB", (px, px), bg)
    icon = src.resize((px, px), Image.LANCZOS)
    canvas.paste(icon, (0, 0), icon)
    canvas.save(os.path.join(OUT, f"small-{name}-{scale * 100}.bmp"))


os.makedirs(OUT, exist_ok=True)
for s in (1, 2):
    wizard(s)
    small("suite", larfic, s, CREAM)
for a in json.load(open("apps.json", encoding="utf-8"))["apps"]:
    icon = Image.open(os.path.join("brand", "icons", a["slug"], f"{a['slug']}-1024.png")).convert("RGBA")
    for s in (1, 2):
        small(a["slug"], icon, s, (255, 255, 255))
larfic.save(os.path.join(OUT, "suite.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok")
