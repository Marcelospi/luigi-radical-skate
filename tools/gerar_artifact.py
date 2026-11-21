"""
Gera a versão do jogo publicada como artifact do Claude.

    python tools/gerar_artifact.py

O artifact envolve o arquivo enviado num esqueleto próprio (doctype, html,
head, body, charset e viewport). Então a página publicada não pode trazer
essas tags, senão ficam duplicadas. Este script transforma o index.html do
projeto na versão aceita, sem ninguém precisar manter dois HTMLs na mão.

Saída: artifact/index.html
"""

import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(RAIZ, "index.html")
SAIDA_DIR = os.path.join(RAIZ, "artifact")
SAIDA = os.path.join(SAIDA_DIR, "index.html")

# Tags que o esqueleto do artifact já fornece ou que não valem lá
REMOVER = [
    r'<meta charset[^>]*>',
    r'<meta name="viewport"[^>]*>',
    r'<meta name="theme-color"[^>]*>',
    r'<meta name="description"[^>]*>',
    r'<link rel="manifest"[^>]*>',
    r'<meta name="mobile-web-app-capable"[^>]*>',
    r'<meta name="apple-mobile-web-app-[^>]*>',
    r'<link rel="apple-touch-icon"[^>]*>',
    r'<!--\s*Instalável no celular[^>]*-->',
]


def gerar():
    if not os.path.exists(ENTRADA):
        print("index.html não encontrado.")
        return 1

    with open(ENTRADA, encoding="utf-8") as f:
        html = f.read()

    titulo = re.search(r"<title>(.*?)</title>", html, re.S)
    titulo = titulo.group(1).strip() if titulo else "Luigi Radical Skate"

    fontes = re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*fonts\.[^>]*>', html)
    estilo = re.findall(r'<link rel="stylesheet" href="css/[^>]*>', html)

    # O ícone é um data URI autocontido: levar junto evita o pedido a
    # /favicon.ico, que voltaria 404 na página publicada.
    icone = re.findall(r'<link rel="icon" href="data:[^>]*>', html)

    corpo = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not corpo:
        print("Não encontrei o <body> no index.html.")
        return 1
    corpo = corpo.group(1).strip()

    for padrao in REMOVER:
        corpo = re.sub(padrao, "", corpo, flags=re.I)

    partes = [f"<title>{titulo}</title>", ""]
    partes += icone + fontes + estilo
    partes += ["", corpo, ""]
    saida = "\n".join(partes)

    # Confere que nenhuma tag de documento sobrou.
    # O limite após o nome importa: <header> não pode ser confundido com <head>.
    for proibida in ("!doctype", "html", "head", "body"):
        if re.search(rf"<\s*/?\s*{proibida}(?=[\s>/])", saida, re.I):
            print(f"Sobrou uma tag proibida na saída: <{proibida}>")
            return 1

    os.makedirs(SAIDA_DIR, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(saida)

    print(f"Gerado: artifact/index.html  ({len(saida):,} bytes)")
    print(f"Título: {titulo}")
    print(f"Links no cabeçalho: {len(icone) + len(fontes) + len(estilo)}")
    return 0


if __name__ == "__main__":
    sys.exit(gerar())
