# Como Adicionar Novos Personagens no Jogo do Luigi 🛹

Você pode adicionar novos personagens no jogo a qualquer momento de duas maneiras simples:

---

## Método 1: Pelo Próprio Jogo (Sem Instalar Nada!)

1. Abra o jogo no seu navegador.
2. No menu inicial, clique em **✨ Criar avatar**.
3. Escolha uma das 3 opções no topo do Estúdio:
   - **📁 Escolher foto**: selecione qualquer imagem ou foto do aparelho.
   - **📸 Câmera**: tire uma foto na hora usando a webcam ou câmera do celular.
   - **🎨 Sem foto**: crie um avatar ilustrado personalizado!
4. Personalize na hora vendo a **prévia ao vivo na pista**:
   - Ajuste **Esquerda ↔ Direita**, **Cima ↕ Baixo**, **Zoom** e **Espelhar** (ou arraste direto com o dedo/mouse).
   - Escolha **Tamanho do Rosto** (Grande ou Normal), **Gênero/Estilo**, **Cor da Pele**, **Cor da Roupa**, **Cor do Cabelo**, **Capacete SK8** e **Acessório Inicial**.
5. Digite o nome e clique em **"Salvar e jogar"**.

> Todos os personagens têm o mesmo equilíbrio físico para que seus avatares personalizados sejam 100% competitivos em qualquer esporte!
> Para remover um personagem criado por você, passe o mouse sobre o card dele na tela de seleção e clique no **✕** no canto superior esquerdo (confirmando no modal).

---

## Método 2: Com o Script Automático de IA (`import_character.py`)

Para recortar fotos automaticamente com remoção profissional de fundo (usando `rembg`):

1. Salve a foto em qualquer pasta (por exemplo, `Imagens/`).
2. Abra o terminal na pasta do jogo e execute:
   ```bash
   python tools/import_character.py "caminho/para/sua_foto.jpg" --nome "Super Luigi"
   ```
3. O script corrige a rotação, remove o fundo, gera as 4 poses (`skate`, `duck`, `jump`, `trick`) + retrato e registra o personagem em `assets/characters.json`.
4. Recarregue a página do jogo para vê-lo disponível na seleção!
