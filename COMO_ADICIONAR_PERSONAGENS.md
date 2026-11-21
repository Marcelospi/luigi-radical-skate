# Como Adicionar Novos Personagens no Jogo do Luigi 🛹

Você pode adicionar novos personagens no jogo a qualquer momento de duas maneiras super simples:

---

## Método 1: Pelo Próprio Jogo (Mais Fácil - Sem Instalar Nada!)

1. Abra o jogo no seu navegador.
2. No menu inicial, clique em **✨ Criar novo**.
3. Clique na área tracejada (ou arraste uma imagem para cima dela) e escolha
   qualquer foto do computador — um amigo, a mãe, o pai, o cachorro ou um desenho.
4. Escreva o nome do personagem no campo ao lado.
5. Clique em **"Salvar e jogar"**.

O jogo gera sozinho as quatro poses (andando, agachado, pulando e manobra) a
partir da sua foto, salva o personagem no navegador e já abre a tela de seleção
com ele disponível.

> Para remover um personagem criado por você, passe o mouse sobre o card dele na
> tela de seleção e clique no **✕** que aparece no canto.

---

## Método 2: Com o Script Automático de Inteligência Artificial (`import_character.py`)

Se você quiser recortar fotos automaticamente com remoção profissional de fundo por IA (usando `rembg`):

1. Salve a nova foto em qualquer pasta (por exemplo, na pasta `Imagens` ou `NovosPersonagens`).
2. Abra o terminal (PowerShell ou Prompt de Comando) na pasta do jogo:
   ```bash
   python tools/import_character.py "caminho/para/sua_foto.jpg" --nome "Super Luigi"
   ```
3. O script irá:
   - Identificar a foto e corrigir a rotação automaticamente.
   - Remover todo o fundo da foto com IA deixando o personagem transparente.
   - Criar as 4 poses do jogo:
     - 🛹 Andando de skate
     - ⬇️ Abaixado / Agachado
     - 🚀 Saltando (Ollie)
     - ✨ Manobra radical no ar
   - Criar a foto de perfil/avatar para o menu.
   - Registrar no jogo em `assets/characters.json`.
4. Pronto! Ao recarregar a página do jogo, o novo personagem já estará lá com visual impecável!

---

## Dicas para Fotos Ideais:
- Fotos de corpo inteiro ou meio corpo onde a pessoa ou personagem esteja em pé ou em pose de ação.
- Boa iluminação destaca ainda mais os detalhes no jogo.
- Se a foto tiver a pessoa em cima de um skate ou simulando a pose, o resultado fica ainda mais incrível!
