# Uso: python scripts/gerar_icones.py <Inter-SemiBold.ttf> brand/icons
"""Gera os ícones da Suíte FisiLab: azulejo marinho, listras da logo do LARFIC, monograma creme e
uma barra (vermelha da chama nos apps criativos, azul CTA nos de documentos/engenharia)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = sys.argv[1]
OUT = sys.argv[2]
APPS = [
    ("fisifoto", "Fo", "red"), ("fisivetor", "Ve", "red"), ("fisifilme", "Fi", "red"),
    ("fisirevela", "Rv", "red"), ("fisiefeitos", "Ef", "red"), ("fisisom", "Sm", "red"),
    ("fisipdf", "Pd", "blue"), ("fisilayout", "Ly", "blue"), ("fisitexto", "Tx", "blue"),
    ("fisislides", "Sl", "blue"), ("fisiplanilha", "Pl", "blue"), ("fisicad", "Cd", "blue"),
]
NAVY_TOP, NAVY_BOT = (0x22, 0x31, 0x45), (0x14, 0x1D, 0x29)
CREAM = (0xF2, 0xEA, 0xDA)
RED, BLUE = (0xC8, 0x40, 0x2F), (0x44, 0x80, 0xC4)
S = 1024

def tile(mono, accent):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # gradiente vertical
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        k = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(NAVY_TOP, NAVY_BOT)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    im.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(im)
    # listras (motivo da logo do LARFIC), discretas, abaixo da barra: camada à parte + composição
    over = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for i in range(5):
        y = int(S * 0.76) + i * 30
        half = int(S * 0.34 * (1 - abs(i - 2) / 4.5))
        od.line([(S // 2 - half, y), (S // 2 + half, y)], fill=CREAM + (34,), width=10 + 2 * i)
    over.putalpha(Image.composite(over.getchannel("A"), Image.new("L", (S, S), 0), mask))
    im.alpha_composite(over)
    d = ImageDraw.Draw(im)
    # monograma
    font = ImageFont.truetype(FONT, int(S * 0.46))
    bbox = d.textbbox((0, 0), mono, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (S - w) // 2 - bbox[0]
    y = int(S * 0.40) - h // 2 - bbox[1]
    d.text((x, y), mono, font=font, fill=CREAM + (255,))
    # barra de destaque
    col = RED if accent == "red" else BLUE
    bw = int(S * 0.38)
    by = int(S * 0.64)
    d.rounded_rectangle([(S - bw) // 2, by, (S + bw) // 2, by + int(S * 0.045)], radius=int(S * 0.02), fill=col + (255,))
    return im

os.makedirs(OUT, exist_ok=True)
for name, mono, accent in APPS:
    im = tile(mono, accent)
    dst = os.path.join(OUT, name)
    os.makedirs(dst, exist_ok=True)
    im.save(os.path.join(dst, f"{name}-1024.png"))
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        im.resize((s, s), Image.LANCZOS).save(os.path.join(dst, f"{name}-{s}.png"))
    im.save(os.path.join(dst, f"{name}.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok")
