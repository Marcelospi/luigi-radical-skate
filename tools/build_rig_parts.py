"""
Gera as 8 peças ilustradas do Cutout Rig 2D do Luigi em assets/rig/*.png
seguindo o contrato de dimensões e pivôs, usando supersampling 2x (LANCZOS)
e extraindo head_luigi.png + helmet_overlay.png diretamente do retrato oficial.
"""

from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PORTRAIT_PATH = ROOT / "assets" / "portraits" / "portrait_luigi_3d.png"
OUT_DIR = ROOT / "assets" / "rig"
OUT_DIR.mkdir(parents=True, exist_ok=True)

INK = (26, 20, 18, 255)


def extract_head_and_helmet():
    """Extrai head_luigi.png (160x160) e helmet_overlay.png (160x160) do retrato oficial."""
    src = Image.open(PORTRAIT_PATH).convert("RGBA").resize((160, 160), Image.LANCZOS)
    w, h = src.size
    px = src.load()

    # 1. Flood-fill BFS a partir das 4 bordas removendo apenas fundo branco externo
    visited = [[False] * w for _ in range(h)]
    bg = [[False] * w for _ in range(h)]
    q = deque()

    def is_near_white(x, y):
        r, g, b, a = px[x, y]
        if a < 20:
            return True
        lum = r * 0.299 + g * 0.587 + b * 0.114
        return lum >= 224 and (max(r, g, b) - min(r, g, b)) <= 30

    def push(x, y):
        if 0 <= x < w and 0 <= y < h and not visited[y][x] and is_near_white(x, y):
            visited[y][x] = True
            bg[y][x] = True
            q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        push(x - 1, y)
        push(x + 1, y)
        push(x, y - 1)
        push(x, y + 1)

    head = src.copy()
    hpx = head.load()
    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                hpx[x, y] = (0, 0, 0, 0)
                continue
            r, g, b, a = hpx[x, y]
            touches_bg = (
                (x > 0 and bg[y][x - 1])
                or (x < w - 1 and bg[y][x + 1])
                or (y > 0 and bg[y - 1][x])
                or (y < h - 1 and bg[y + 1][x])
            )
            if touches_bg:
                lum = r * 0.299 + g * 0.587 + b * 0.114
                if lum > 175:
                    a = int(a * max(0.12, (240 - lum) / 80))
            # Remove suavemente os cantos da gola da camisa na base do retrato
            if y > int(h * 0.85):
                dx = abs(x - w * 0.5) / (w * 0.5)
                if dx > 0.30:
                    fade = max(0.0, 1.0 - ((y - h * 0.85) / (h * 0.15)) * min(1.0, (dx - 0.30) / 0.25))
                    a = int(a * fade)
            hpx[x, y] = (r, g, b, a)

    head.save(OUT_DIR / "head_luigi.png")

    # 2. helmet_overlay.png: mantém apenas a casca do capacete no topo + alça preta do queixo,
    #    removendo rosto, cabelo interno e pescoço/gola abaixo da alça + sombra suave da aba na testa.
    helmet = head.copy()
    opx = helmet.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = opx[x, y]
            if a == 0:
                continue
            nx = (x - 80.0) / 80.0  # -1..1
            # Curva inferior da aba do capacete (mais alta no centro, desce nas laterais)
            brim_y = 58.0 + 18.0 * (nx * nx)
            lum = r * 0.299 + g * 0.587 + b * 0.114

            if y > brim_y:
                # Na zona inferior (alça preta do queixo), preserva apenas pixels bem escuros da alça
                strap_center = 146.0 - 48.0 * (nx * nx)
                near_strap = abs(y - strap_center) <= 9.5 and abs(nx) < 0.94
                if near_strap and lum < 75:
                    continue
                # Transição suave de 4px logo abaixo da aba do capacete
                top_alpha = max(0.0, min(1.0, (y - brim_y) / 4.0))
                new_a = int(a * (1.0 - top_alpha))
                opx[x, y] = (r, g, b, new_a)

    # Adiciona sombra sutil da aba do capacete projetada sobre a testa do usuário
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    pts = []
    for x in range(18, 143, 4):
        nx = (x - 80.0) / 80.0
        by = 58.0 + 18.0 * (nx * nx)
        pts.append((x, by))
    for x in range(142, 17, -4):
        nx = (x - 80.0) / 80.0
        by = 58.0 + 18.0 * (nx * nx) + 14.0
        pts.append((x, by))
    sdraw.polygon(pts, fill=(24, 16, 12, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=4))

    helmet = Image.alpha_composite(shadow, helmet)
    helmet.save(OUT_DIR / "helmet_overlay.png")


def draw_plaid_pattern(img, mask_box=None):
    """Aplica padrão xadrez azul-marinho e vermelho fiel à camisa do Luigi sobre uma camada RGBA."""
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    step = 26
    for x in range(-h, w + h, step):
        draw.line([(x, 0), (x, h)], fill=(182, 59, 62, 165), width=6)
        draw.line([(x + 12, 0), (x + 12, h)], fill=(18, 30, 52, 145), width=4)
    for y in range(0, h + step, step):
        draw.line([(0, y), (w, y)], fill=(182, 59, 62, 155), width=6)
        draw.line([(0, y + 12), (w, y + 12)], fill=(18, 30, 52, 140), width=4)

    # Recorta pelo alpha da imagem base
    r, g, b, a = img.split()
    overlay.putalpha(Image.composite(overlay.split()[3], Image.new("L", (w, h), 0), a))
    return Image.alpha_composite(img, overlay)


def build_torso():
    """assets/rig/torso.png (120x140, pivô quadril 0.50,0.86, ombros y=0.22, pescoço y=0.14)."""
    S = 2
    W, H = 120 * S, 140 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Pescoço (pele)
    d.rounded_rectangle([96, 18, 144, 54], radius=14, fill=(224, 169, 134, 255), outline=INK, width=5)
    # Sombra sob o queixo
    d.ellipse([98, 22, 142, 42], fill=(186, 134, 102, 255))

    # Camiseta cinza claro interna ("Sk8 KID")
    shirt_pts = [(66, 44), (174, 44), (168, 232), (72, 232)]
    d.polygon(shirt_pts, fill=(196, 192, 182, 255), outline=INK, width=5)
    # Gola redonda da camiseta
    d.arc([90, 32, 150, 62], start=0, end=180, fill=(115, 110, 102, 255), width=6)
    # Sombra lateral suave na camiseta
    d.polygon([(70, 50), (92, 50), (92, 228), (74, 228)], fill=(168, 164, 154, 255))

    # Estampa "Sk8 KID" estilizada no peito
    try:
        font_big = ImageFont.truetype("arialbd.ttf", 34)
        font_sm = ImageFont.truetype("arialbd.ttf", 28)
    except Exception:
        font_big = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    # Sombra vermelha street art + texto branco/ink
    d.text((88, 92), "Sk8", font=font_big, fill=(182, 59, 62, 255))
    d.text((85, 89), "Sk8", font=font_big, fill=INK)
    d.text((87, 90), "Sk8", font=font_big, fill=(242, 240, 235, 255))
    d.text((92, 128), "KiD", font=font_sm, fill=(182, 59, 62, 255))
    d.text((90, 126), "KiD", font=font_sm, fill=(242, 240, 235, 255))

    # Abas da camisa xadrez aberta (esquerda e direita)
    plaid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plaid_layer)
    # Lado esquerdo
    left_flank = [(44, 48), (94, 40), (88, 244), (36, 234), (40, 120)]
    pd.polygon(left_flank, fill=(35, 59, 93, 255))
    # Lado direito
    right_flank = [(146, 40), (196, 48), (204, 120), (206, 234), (154, 244)]
    pd.polygon(right_flank, fill=(35, 59, 93, 255))
    plaid_layer = draw_plaid_pattern(plaid_layer)

    # Contornos e golas da camisa xadrez
    pd2 = ImageDraw.Draw(plaid_layer)
    pd2.polygon(left_flank, outline=INK, width=5)
    pd2.polygon(right_flank, outline=INK, width=5)
    # Gola esquerda e direita
    pd2.polygon([(78, 34), (102, 42), (90, 64), (66, 52)], fill=(28, 48, 76, 255), outline=INK, width=4)
    pd2.polygon([(162, 34), (138, 42), (150, 64), (174, 52)], fill=(28, 48, 76, 255), outline=INK, width=4)
    # Bolso no peito direito
    pd2.rounded_rectangle([158, 92, 190, 126], radius=4, fill=(30, 52, 82, 210), outline=INK, width=3)

    img = Image.alpha_composite(img, plaid_layer)

    # Barra do quadril / cinto sutil (y ~ 0.86 = 240)
    d_final = ImageDraw.Draw(img)
    d_final.rounded_rectangle([72, 224, 168, 252], radius=8, fill=(98, 88, 66, 255), outline=INK, width=4)

    img = img.resize((120, 140), Image.LANCZOS)
    img.save(OUT_DIR / "torso.png")


def build_arm_upper():
    """assets/rig/arm_upper.png (52x88, pivô ombro 0.50,0.16, cotovelo 0.50,0.84)."""
    S = 2
    W, H = 52 * S, 88 * S
    sleeve = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sleeve)
    # Manga xadrez cilíndrica
    d.rounded_rectangle([18, 12, 86, 158], radius=28, fill=(35, 59, 93, 255))
    sleeve = draw_plaid_pattern(sleeve)
    d2 = ImageDraw.Draw(sleeve, "RGBA")
    # Sombreamento lateral
    d2.rounded_rectangle([18, 12, 42, 158], radius=16, fill=(14, 24, 42, 90))
    # Contorno externo
    d2.rounded_rectangle([18, 12, 86, 158], radius=28, outline=INK, width=5)
    # Dobra da manga perto do cotovelo
    d2.rounded_rectangle([16, 130, 88, 156], radius=10, fill=(28, 46, 74, 255), outline=INK, width=4)

    sleeve.resize((52, 88), Image.LANCZOS).save(OUT_DIR / "arm_upper.png")


def build_arm_lower():
    """assets/rig/arm_lower.png (52x96, pivô cotovelo 0.50,0.14, mão 0.50,0.88)."""
    S = 2
    W, H = 52 * S, 96 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Antebraço (pele)
    d.rounded_rectangle([28, 14, 76, 150], radius=22, fill=(224, 169, 134, 255), outline=INK, width=5)
    # Sombra suave no lado esquerdo
    d.rounded_rectangle([30, 18, 46, 144], radius=10, fill=(198, 145, 110, 255))

    # Munhequeira marrom com tiras (assinatura do Luigi!)
    d.rounded_rectangle([22, 88, 82, 142], radius=12, fill=(107, 71, 45, 255), outline=INK, width=5)
    d.line([(24, 106), (80, 106)], fill=INK, width=4)
    d.line([(24, 124), (80, 124)], fill=INK, width=4)
    d.rounded_rectangle([42, 96, 62, 134], radius=5, fill=(78, 50, 30, 255), outline=INK, width=3)

    # Mão aberta/semi-fechada na ponta (y ~ 0.88 = 169)
    d.ellipse([26, 140, 78, 184], fill=(224, 169, 134, 255), outline=INK, width=5)
    # Polegar lateral
    d.ellipse([66, 146, 88, 168], fill=(224, 169, 134, 255), outline=INK, width=4)

    img.resize((52, 96), Image.LANCZOS).save(OUT_DIR / "arm_lower.png")


def build_thigh():
    """assets/rig/thigh.png (64x96, pivô quadril 0.50,0.16, joelho 0.50,0.84)."""
    S = 2
    W, H = 64 * S, 96 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Coxa da calça cargo cáqui/oliva
    d.rounded_rectangle([20, 12, 108, 178], radius=34, fill=(132, 120, 90, 255), outline=INK, width=5)
    # Sombreamento de volume
    d.rounded_rectangle([22, 16, 52, 174], radius=20, fill=(104, 94, 70, 255))
    # Brilho suave frontal
    d.rounded_rectangle([74, 26, 98, 160], radius=14, fill=(148, 136, 104, 255))

    # Bolso cargo lateral com aba
    d.rounded_rectangle([32, 62, 92, 128], radius=10, fill=(118, 106, 78, 255), outline=INK, width=4)
    d.rounded_rectangle([30, 58, 94, 78], radius=6, fill=(142, 130, 98, 255), outline=INK, width=4)

    img.resize((64, 96), Image.LANCZOS).save(OUT_DIR / "thigh.png")


def build_shin_shoe():
    """assets/rig/shin_shoe.png (76x110, pivô joelho 0.42,0.14, sola 0.52,0.92)."""
    S = 2
    W, H = 76 * S, 110 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Canela da calça cargo (centrada em x ~ 0.42 = 64)
    d.rounded_rectangle([26, 12, 102, 148], radius=26, fill=(124, 112, 84, 255), outline=INK, width=5)
    d.rounded_rectangle([28, 18, 52, 142], radius=14, fill=(98, 88, 64, 255))
    # Barra dobrada da calça
    d.rounded_rectangle([24, 124, 104, 146], radius=8, fill=(106, 95, 70, 255), outline=INK, width=4)

    # Tênis cano alto marrom escuro apontando para a direita (sola em y ~ 0.92 = 202)
    shoe_pts = [
        (32, 142), (96, 142), (104, 162), (138, 174),
        (144, 192), (138, 204), (26, 204), (24, 170)
    ]
    d.polygon(shoe_pts, fill=(71, 60, 51, 255), outline=INK, width=5)
    # Biqueira branca
    d.chord([110, 172, 146, 202], start=270, end=90, fill=(235, 232, 223, 255), outline=INK, width=4)
    # Solado branco vulcanizado com listra escura
    d.rounded_rectangle([24, 190, 144, 208], radius=8, fill=(235, 232, 223, 255), outline=INK, width=5)
    d.line([(30, 199), (138, 199)], fill=(80, 74, 68, 200), width=3)

    # Cadarços brancos
    for ly in (152, 162, 172):
        d.line([(86, ly), (104, ly + 4)], fill=(238, 236, 230, 255), width=4)

    img.resize((76, 110), Image.LANCZOS).save(OUT_DIR / "shin_shoe.png")


def build_skateboard():
    """assets/rig/skateboard.png (180x56, horizontal, pivô centro do deck 0.50,0.42)."""
    S = 2
    W, H = 180 * S, 56 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Trucks metálicos (traseiro e dianteiro)
    for tx in (92, 268):
        d.polygon([(tx - 16, 48), (tx + 16, 48), (tx + 10, 76), (tx - 10, 76)], fill=(138, 146, 158, 255), outline=INK, width=4)
        # Rodinhas creme (2 visíveis por truck em 2.5D)
        d.ellipse([tx - 24, 66, tx + 4, 96], fill=(205, 196, 172, 255), outline=INK, width=4)
        d.ellipse([tx - 4, 70, tx + 26, 100], fill=(232, 223, 200, 255), outline=INK, width=4)
        # Rolamento central
        d.ellipse([tx + 6, 80, tx + 16, 90], fill=(70, 66, 62, 255))

    # Shape côncavo street art (nose e tail levantados, centro em y ~ 0.42 = 47)
    deck_pts = [
        (16, 30), (62, 42), (298, 42), (344, 30),
        (350, 42), (304, 58), (56, 58), (10, 42)
    ]
    d.polygon(deck_pts, fill=(38, 120, 168, 255), outline=INK, width=5)

    # Faixas street art (dourado e vermelho na lateral inferior do shape)
    d.polygon([(80, 48), (200, 48), (190, 56), (90, 56)], fill=(235, 182, 58, 255))
    d.polygon([(205, 48), (288, 48), (280, 56), (198, 56)], fill=(192, 56, 62, 255))

    # Lixa preta no topo do deck
    grip_pts = [(18, 29), (62, 40), (298, 40), (342, 29), (344, 35), (298, 47), (62, 47), (16, 35)]
    d.polygon(grip_pts, fill=(32, 34, 40, 255), outline=INK, width=3)

    img.resize((180, 56), Image.LANCZOS).save(OUT_DIR / "skateboard.png")


def main():
    extract_head_and_helmet()
    build_torso()
    build_arm_upper()
    build_arm_lower()
    build_thigh()
    build_shin_shoe()
    build_skateboard()
    print("Rig gerado com sucesso em:", OUT_DIR)
    for p in sorted(OUT_DIR.glob("*.png")):
        im = Image.open(p)
        print(f" - {p.name}: {im.size} ({im.mode})")


if __name__ == "__main__":
    main()
