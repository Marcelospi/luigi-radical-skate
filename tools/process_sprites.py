import os
from PIL import Image, ImageOps
from rembg import remove

def process_all():
    print("=== Processando Sprites do Luigi ===")
    
    # 1. Luigi 3D (SK8-BOY) a partir de Personagem.jpeg
    print("Processando Luigi 3D (Personagem.jpeg)...")
    img_3d = Image.open('Imagens/Personagem.jpeg')
    
    # Action Pose (Skate lateral em movimento)
    # y=755 a 1165 pega o capacete até as rodinhas do skate, x=25 a 420
    action_crop = img_3d.crop((25, 755, 420, 1165))
    action_nobg = remove(action_crop)
    
    # Obter bbox com alfa para recortar sobras
    bbox_3d = action_nobg.getbbox()
    if bbox_3d:
        action_nobg = action_nobg.crop(bbox_3d)
    
    # Redimensionar para tamanho padrão do jogo (altura 240px proporcional)
    h_target = 240
    w_target = int(action_nobg.width * (h_target / action_nobg.height))
    sprite_3d_skate = action_nobg.resize((w_target, h_target), Image.Resampling.LANCZOS)
    sprite_3d_skate.save('assets/sprites/luigi_3d_skate.png')
    print(f"Salvo luigi_3d_skate.png ({w_target}x{h_target})")
    
    # Pose Duck (Agachado no skate)
    duck_h = int(h_target * 0.68)
    duck_w = int(w_target * 1.1)
    sprite_3d_duck = action_nobg.resize((duck_w, duck_h), Image.Resampling.LANCZOS)
    sprite_3d_duck.save('assets/sprites/luigi_3d_duck.png')
    print(f"Salvo luigi_3d_duck.png ({duck_w}x{duck_h})")
    
    # Pose Jump (Salto/Ollie com skate inclinado)
    sprite_3d_jump = sprite_3d_skate.rotate(-15, expand=True, resample=Image.Resampling.BICUBIC)
    sprite_3d_jump.save('assets/sprites/luigi_3d_jump.png')
    print("Salvo luigi_3d_jump.png")
    
    # Pose Trick (Manobra radical aérea)
    sprite_3d_trick = sprite_3d_skate.rotate(25, expand=True, resample=Image.Resampling.BICUBIC)
    sprite_3d_trick.save('assets/sprites/luigi_3d_trick.png')
    print("Salvo luigi_3d_trick.png")
    
    # Retrato 3D
    portrait_3d_crop = img_3d.crop((380, 40, 650, 320))
    portrait_3d_nobg = remove(portrait_3d_crop)
    if portrait_3d_nobg.getbbox():
        portrait_3d_nobg = portrait_3d_nobg.crop(portrait_3d_nobg.getbbox())
    portrait_3d_nobg = portrait_3d_nobg.resize((160, 160), Image.Resampling.LANCZOS)
    portrait_3d_nobg.save('assets/portraits/portrait_luigi_3d.png')
    print("Salvo portrait_luigi_3d.png")

    # 2. Luigi Realista (com agasalho Homem-Aranha)
    print("\nProcessando Luigi Realista (20260919_134936.jpg)...")
    img_real = ImageOps.exif_transpose(Image.open('Imagens/20260919_134936.jpg'))
    
    # Crop ao redor do Luigi e skate
    real_crop = img_real.crop((500, 500, 2600, 3950))
    real_crop_small = real_crop.resize((int(real_crop.width * 800 / real_crop.height), 800), Image.Resampling.LANCZOS)
    real_nobg = remove(real_crop_small)
    
    # Ajusta para a direção correta (olhando para a direita / frente)
    real_nobg = ImageOps.mirror(real_nobg)
    
    bbox_real = real_nobg.getbbox()
    if bbox_real:
        real_nobg = real_nobg.crop(bbox_real)
        
    # Redimensionar para tamanho padrão do jogo (altura 240px)
    w_real = int(real_nobg.width * (h_target / real_nobg.height))
    sprite_real_skate = real_nobg.resize((w_real, h_target), Image.Resampling.LANCZOS)
    sprite_real_skate.save('assets/sprites/luigi_real_skate.png')
    print(f"Salvo luigi_real_skate.png ({w_real}x{h_target})")
    
    # Duck Real
    duck_real_h = int(h_target * 0.68)
    duck_real_w = int(w_real * 1.1)
    sprite_real_duck = real_nobg.resize((duck_real_w, duck_real_h), Image.Resampling.LANCZOS)
    sprite_real_duck.save('assets/sprites/luigi_real_duck.png')
    print(f"Salvo luigi_real_duck.png ({duck_real_w}x{duck_real_h})")
    
    # Jump Real (Ollie)
    sprite_real_jump = sprite_real_skate.rotate(15, expand=True, resample=Image.Resampling.BICUBIC)
    sprite_real_jump.save('assets/sprites/luigi_real_jump.png')
    print("Salvo luigi_real_jump.png")
    
    # Trick Real (Pose com skate no ar)
    sprite_real_trick = sprite_real_skate.rotate(-20, expand=True, resample=Image.Resampling.BICUBIC)
    sprite_real_trick.save('assets/sprites/luigi_real_trick.png')
    print("Salvo luigi_real_trick.png")
    
    # Retrato Realista a partir da foto do rosto (20260919_134956.jpg)
    print("Processando retrato do Luigi Realista (20260919_134956.jpg)...")
    img_face = ImageOps.exif_transpose(Image.open('Imagens/20260919_134956.jpg'))
    face_crop = img_face.crop((500, 600, 2400, 2500))
    face_crop_small = face_crop.resize((400, 400), Image.Resampling.LANCZOS)
    face_nobg = remove(face_crop_small)
    face_nobg = face_nobg.resize((160, 160), Image.Resampling.LANCZOS)
    face_nobg.save('assets/portraits/portrait_luigi_real.png')
    print("Salvo portrait_luigi_real.png")
    
    print("\n=== Todos os sprites foram processados com sucesso! ===")

if __name__ == '__main__':
    process_all()
