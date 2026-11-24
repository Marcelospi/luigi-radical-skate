"""Gera ícones PWA oficiais (192x192, 512x512, maskable 512x512) e capa Open Graph (1200x630)."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PORTRAIT_PATH = ROOT / "assets" / "portraits" / "portrait_luigi_3d.png"
SPRITE_PATH = ROOT / "assets" / "sprites" / "luigi_3d_trick.png"
ICONS_DIR = ROOT / "assets" / "icons"
OG_PATH = ROOT / "assets" / "og-cover.png"


def make_radial_glow(size: int, color: tuple[int, int, int, int]) -> Image.Image:
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    margin = int(size * 0.14)
    draw.ellipse((margin, margin, size - margin, size - margin), fill=color)
    return glow.filter(ImageFilter.GaussianBlur(radius=size * 0.14))


def create_app_icon(size: int, maskable: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (7, 8, 18, 255))
    draw = ImageDraw.Draw(canvas)

    # Gradiente sutil escuro + acentos neon
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(10 + 14 * t)
        g = int(14 + 10 * t)
        b = int(34 + 28 * (1 - t))
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    glow_cyan = make_radial_glow(size, (34, 211, 238, 105))
    canvas.alpha_composite(glow_cyan)

    # Borda / anel interno
    pad = int(size * (0.14 if maskable else 0.06))
    ring_w = max(3, int(size * 0.022))
    draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=int(size * (0.22 if not maskable else 0.28)),
        outline=(34, 211, 238, 190),
        width=ring_w,
    )

    # Personagem oficial (safe-zone maior para maskable)
    src_path = SPRITE_PATH if SPRITE_PATH.exists() else PORTRAIT_PATH
    hero = Image.open(src_path).convert("RGBA")
    scale_ratio = 0.60 if maskable else 0.76
    target_h = int(size * scale_ratio)
    ratio = target_h / hero.height
    target_w = max(1, int(hero.width * ratio))
    hero_resized = hero.resize((target_w, target_h), Image.Resampling.LANCZOS)

    hx = (size - target_w) // 2
    hy = (size - target_h) // 2 - int(size * 0.02)
    canvas.alpha_composite(hero_resized, (hx, hy))

    # Rastro neon sutil no rodapé do ícone padrão
    if not maskable:
        overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(overlay)
        bar_h = max(6, int(size * 0.032))
        bar_y = size - pad - bar_h - int(size * 0.045)
        odraw.rounded_rectangle(
            (int(size * 0.24), bar_y, int(size * 0.76), bar_y + bar_h),
            radius=bar_h // 2,
            fill=(244, 63, 126, 235),
        )
        canvas.alpha_composite(overlay)

    return canvas


def load_font(size: int, bold: bool = True):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def create_og_cover() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGBA", (w, h), (7, 8, 18, 255))
    draw = ImageDraw.Draw(img)

    # Fundo gradiente noturno
    for y in range(h):
        t = y / (h - 1)
        r = int(7 + 20 * t)
        g = int(8 + 14 * t)
        b = int(24 + 34 * (1 - abs(t - 0.5)))
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Halos ciano e magenta
    halo_c = make_radial_glow(580, (34, 211, 238, 110))
    halo_p = make_radial_glow(520, (244, 63, 126, 95))
    img.alpha_composite(halo_c, (620, 40))
    img.alpha_composite(halo_p, (-110, 140))

    # Pista neon inferior
    track_y = 500
    draw.rectangle((0, track_y, w, h), fill=(18, 22, 46, 255))
    draw.rectangle((0, track_y, w, track_y + 7), fill=(34, 211, 238, 255))

    # Camada RGBA própria para transparências dos pills e textos
    ui_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    udraw = ImageDraw.Draw(ui_layer)

    # Sprite do Luigi 3D em manobra à direita (com respiro confortável do texto)
    if SPRITE_PATH.exists():
        hero = Image.open(SPRITE_PATH).convert("RGBA")
        target_h = 420
        target_w = int(hero.width * (target_h / hero.height))
        hero_r = hero.resize((target_w, target_h), Image.Resampling.LANCZOS)
        img.alpha_composite(hero_r, (w - target_w - 56, track_y - target_h + 26))

    # Tipografia à esquerda
    f_kicker = load_font(22, bold=True)
    f_title1 = load_font(54, bold=True)
    f_title2 = load_font(76, bold=True)
    f_sub = load_font(27, bold=False)

    udraw.rounded_rectangle((76, 94, 338, 138), radius=22, fill=(14, 48, 72, 215), outline=(34, 211, 238, 220), width=2)
    udraw.text((106, 103), "ARCADE RADICAL", font=f_kicker, fill=(34, 211, 238, 255))

    udraw.text((76, 162), "LUIGI", font=f_title1, fill=(226, 232, 240, 255))
    udraw.text((74, 224), "RADICAL SKATE", font=f_title2, fill=(255, 255, 255, 255))
    udraw.text((78, 330), "4 Esportes • 4 Fases • Oficina & Placar Global", font=f_sub, fill=(195, 201, 224, 255))

    # Pílulas de destaque com texto perfeitamente centralizado
    pills = ["Skate", "BMX", "Patinete", "Patins"]
    px = 78
    for label in pills:
        bbox = udraw.textbbox((0, 0), label, font=f_kicker)
        tw = bbox[2] - bbox[0]
        bw = tw + 44
        udraw.rounded_rectangle((px, 404, px + bw, 446), radius=21, fill=(20, 24, 52, 235), outline=(139, 92, 246, 200), width=2)
        udraw.text((px + 22, 412), label, font=f_kicker, fill=(238, 242, 255, 255))
        px += bw + 14

    img.alpha_composite(ui_layer)
    return img.convert("RGB")


def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    create_app_icon(192, maskable=False).save(ICONS_DIR / "icon-192.png", "PNG")
    create_app_icon(512, maskable=False).save(ICONS_DIR / "icon-512.png", "PNG")
    create_app_icon(512, maskable=True).save(ICONS_DIR / "icon-maskable-512.png", "PNG")
    create_og_cover().save(OG_PATH, "PNG", optimize=True)
    print("Icones PWA e og-cover gerados com sucesso!")


if __name__ == "__main__":
    main()
