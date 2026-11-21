#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de importação inteligente de novos personagens para o Jogo do Luigi.
Uso:
  python tools/import_character.py caminho/da/foto.jpg --nome "Nome do Personagem"
"""

import sys
import os
import json
import argparse
from PIL import Image, ImageOps

try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    print("Aviso: 'rembg' não encontrado. As imagens serão salvas sem remoção automática de fundo.")

def import_new_character(image_path, character_name, character_id=None):
    if not os.path.exists(image_path):
        print(f"Erro: O arquivo '{image_path}' não foi encontrado!")
        sys.exit(1)
        
    if not character_id:
        # Gera id a partir do nome
        character_id = character_name.lower().replace(' ', '_').replace('-', '_')
        character_id = ''.join(c for c in character_id if c.isalnum() or c == '_')
        
    print(f"\n==========================================")
    print(f"  Importando Novo Personagem: {character_name}")
    print(f"  ID do Personagem: {character_id}")
    print(f"  Imagem de Origem: {image_path}")
    print(f"==========================================\n")
    
    os.makedirs('assets/sprites', exist_ok=True)
    os.makedirs('assets/portraits', exist_ok=True)
    
    # 1. Carregar imagem e corrigir orientação EXIF
    raw_img = Image.open(image_path)
    img = ImageOps.exif_transpose(raw_img)
    
    print("1. Otimizando imagem e removendo fundo com IA...")
    # Redimensiona para altura máxima de 1000px para manter alta qualidade e velocidade
    if img.height > 1000:
        new_w = int(img.width * (1000 / img.height))
        img = img.resize((new_w, 1000), Image.Resampling.LANCZOS)
        
    if REMBG_AVAILABLE:
        nobg = remove(img)
    else:
        nobg = img.convert("RGBA")
        
    # Recortar espaços transparentes vazios
    bbox = nobg.getbbox()
    if bbox:
        nobg = nobg.crop(bbox)
        
    h_target = 240
    w_target = int(nobg.width * (h_target / nobg.height))
    
    # 2. Gerar Sprite Normal de Skate
    skate_sprite = nobg.resize((w_target, h_target), Image.Resampling.LANCZOS)
    skate_path = f"assets/sprites/{character_id}_skate.png"
    skate_sprite.save(skate_path)
    print(f"-> Sprite normal salvo: {skate_path}")
    
    # 3. Gerar Sprite Duck (Abaixado / Agachado)
    duck_h = int(h_target * 0.68)
    duck_w = int(w_target * 1.1)
    duck_sprite = nobg.resize((duck_w, duck_h), Image.Resampling.LANCZOS)
    duck_path = f"assets/sprites/{character_id}_duck.png"
    duck_sprite.save(duck_path)
    print(f"-> Sprite agachado salvo: {duck_path}")
    
    # 4. Gerar Sprite Jump (Salto/Ollie com inclinação)
    jump_sprite = skate_sprite.rotate(15, expand=True, resample=Image.Resampling.BICUBIC)
    jump_path = f"assets/sprites/{character_id}_jump.png"
    jump_sprite.save(jump_path)
    print(f"-> Sprite pulo salvo: {jump_path}")
    
    # 5. Gerar Sprite Trick (Manobra Aérea)
    trick_sprite = skate_sprite.rotate(-25, expand=True, resample=Image.Resampling.BICUBIC)
    trick_path = f"assets/sprites/{character_id}_trick.png"
    trick_sprite.save(trick_path)
    print(f"-> Sprite manobra salvo: {trick_path}")
    
    # 6. Gerar Retrato / Avatar
    # Foca no terço superior (rosto/cabeça)
    head_crop = nobg.crop((0, 0, nobg.width, int(nobg.height * 0.45)))
    head_bbox = head_crop.getbbox()
    if head_bbox:
        head_crop = head_crop.crop(head_bbox)
    portrait = head_crop.resize((160, 160), Image.Resampling.LANCZOS)
    portrait_path = f"assets/portraits/portrait_{character_id}.png"
    portrait.save(portrait_path)
    print(f"-> Retrato salvo: {portrait_path}")
    
    # 7. Atualizar assets/characters.json
    json_path = 'assets/characters.json'
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {"defaultCharacter": character_id, "characters": []}
        
    # Remove duplicata se já existir esse id
    data["characters"] = [c for c in data.get("characters", []) if c.get("id") != character_id]
    
    new_char_entry = {
        "id": character_id,
        "name": character_name,
        "badge": "Personagem Personalizado",
        "description": f"Novo personagem radical: {character_name} pronto para a pista!",
        "portrait": portrait_path,
        "sprites": {
            "skate": skate_path,
            "duck": duck_path,
            "jump": jump_path,
            "trick": trick_path
        },
        "stats": {
            "velocidade": "Alta",
            "salto": "Radical",
            "manobras": "Mestres"
        },
        "width": int(w_target * 0.7),
        "height": 130,
        "duckHeight": 85
    }
    
    data["characters"].append(new_char_entry)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"-> Registro atualizado com sucesso em {json_path}!")
    print(f"\n Parabéns! '{character_name}' foi adicionado e já está disponível para jogar no game!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Importar nova foto/imagem de personagem para o jogo do Luigi.")
    parser.add_argument("imagem", help="Caminho da imagem (JPG ou PNG)")
    parser.add_argument("--nome", required=True, help="Nome do personagem")
    parser.add_argument("--id", help="ID único opcional (letras minúsculas e sem espaço)")
    
    args = parser.parse_args()
    import_new_character(args.imagem, args.nome, args.id)
