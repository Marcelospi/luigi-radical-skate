# Luigi Radical Skate 🛹

Jogo de skate e esportes radicais no navegador com **4 modos de locomoção** (🛹 **Skate**, 🚲 **Bicicleta BMX**, 🛴 **Patinete** e 🛼 **Patins**), física calibrada a 60 Hz, rampas com **Lip Boost**, **Grind** em corrimãos, 4 fases temáticas, **Oficina & Loja**, **Missões & Troféus**, **Placar Universal Global**, áudio independente via Web Audio API, **Estúdio de Personagens** e instalação como App (**PWA**).

---

## Os 4 Esportes

Escolha seu estilo no menu principal (salvo automaticamente):

| Esporte | Destaque | Manobras (`Z` / `X` / `C` / `Espaço`) |
|---|---|---|
| 🛹 **Skate** | Equilibrado e preciso | Kickflip, 360 Spin, Indy Grab, Super Flip |
| 🚲 **Bicicleta (BMX)** | Super Rampa + pouso macio | Tailwhip, Barspin, Superman, Backflip |
| 🛴 **Patinete** | Ágil com manobras 25% mais rápidas | Tailwhip, Barspin, No-Hander, Bri Flip |
| 🛼 **Patins** | Veloz + **Pulo Duplo no ar** | Mute Grab, 360° Spin, Soul Grab, Misty Flip |

---

## Modos de Jogo e Dificuldades

- **🛹 Clássico**: comece com 3 vidas (até 5 ao desbloquear fases). Escolha entre:
  - **😊 Fácil**: cair no buraco ou errar o giro da manobra não encerra a partida na hora (o abismo custa 1 vida e resgata o skatista).
  - **🔥 Difícil · x1.3**: **+30% de pontos** em tudo! Objetos tiram 1 vida, mas pousar manobra incompleta dá tombo e **cair no buraco encerra a partida**.
- **⏱️ 60s**: faça a maior pontuação possível em 60 segundos sem perder vidas.
- **🌟 Treino**: pratique manobras, teste os esportes e colete moedas sem perder vidas. Clique em **🏁 Fim** no topo (ou na Pausa) quando quiser concluir e guardar suas moedas na carteira (fora do placar competitivo).

---

## Oficina, Missões, Troféus e Poderes

- **🛠️ Oficina & Loja**: gaste as moedas acumuladas para destravar novos visuais de equipamento (até o *Prisma Lendário*), **Rastros** coloridos, **Acessórios** (óculos, boné, fone DJ, crista de dino, antena espacial, coroa), novos **Personagens** (como o *Léo Espacial*) e **Poderes** permanentes (*Ímã Turbinado*, *Super Turbo+*, *Carga Radical* e *Cofre de Ouro*).
- **🎯 Missões & Troféus**: complete as 3 missões ativas para abrir o **Baú de Nível (+100 moedas)** e aumentar seu multiplicador permanente de pontos.
- **Poderes na pista**: **Super Turbo**, **Escudo**, **Ímã de Moedas 🧲**, **Pontos 2X ⭐**, letras **L-U-I-G-I** e **Modo Radical x2** (quebra caixas, placas e drones!).

---

## Como Jogar no Computador e Instalar como App (PWA)

Dê um duplo clique no arquivo **`JOGAR.bat`** na pasta do projeto:
- Ele inicia o servidor local automaticamente usando Python e abre o jogo em `http://localhost:8000`.
- Mostra também o endereço IP local da sua rede Wi-Fi para jogar no celular pelo navegador.
- Pelo Chrome/Edge (no PC ou Android) ou Safari (iOS), você pode usar **"Instalar App"** / **"Adicionar à Tela Inicial"** para abrir em tela cheia e jogar até offline.

---

## Controles (Teclado, Celular e Controle Bluetooth/USB)

| Ação | Teclado | Celular | Controle (Gamepad) |
|---|---|---|---|
| Pular (Ollie) / Lip Boost / Pulo Duplo | `Espaço`, `W` ou `↑` | Botão **PULAR** ou deslize ↑ | `A` / Cross / D-Pad ↑ |
| Abaixar / Queda rápida / Sair do Grind | `S` ou `↓` | Botão **ABAIXAR** ou deslize ↓ | D-Pad ↓ / Analógico ↓ |
| Remar (Acelerar) | `→` ou `D` | Botão **REMAR** ou deslize → | D-Pad → / Analógico → |
| Freio leve | `←` ou `A` | — | D-Pad ← / Analógico ← |
| Manobras | `Z`, `X`, `C` (`1/2/3`), `Shift` ou 2º toque em `↑`/`Espaço` | Botões de manobra | `X`, `Y`, `B`, `LB`, `RB`, `LT`, `RT` |
| Pausar / Retomar (com contagem `3·2·1`) | `P` ou `Esc` | Botão `❚❚` | `Start` |
| Mudo / Tela Cheia | `M` (som) · `F` (tela cheia) | Botões `🔊` / `⛶` | — |

Pelo botão **⚙️ Opções** (no Menu ou na Pausa), você regula separadamente o **Volume da Música**, **Efeitos Sonoros**, **Vibração no Celular** e **Tela Cheia**.

---

## Fases e Placar Universal

O cenário, clima e trilha sonora mudam suavemente conforme a distância, e cada nova fase dá **+1 vida (no Clássico) e +1.000 pontos**:

| | Fase | Distância |
|---|---|---|
| 🌇 | Skatepark ao Pôr do Sol | 0 a 600m |
| 🏙️ | Metrópole Cyberpunk Neon | 600 a 1.400m |
| 🌴 | Praia & Píer Tropical | 1.400 a 2.400m |
| 🚀 | Pista Cósmica das Estrelas (baixa gravidade!) | 2.400m em diante |

O placar guarda suas melhores marcas localmente (`localStorage`) e sincroniza com o **Placar Universal Online (Firebase Firestore)** — sempre medindo a **distância real percorrida na sessão** e filtrável por esporte.

---

## Estúdio de Personagens (100% Local e Privado)

No menu do jogo, acesse **✨ Criar avatar** para montar um skatista sem foto (escolhendo gênero, tom de pele, roupa, cabelo e acessório) ou tirar/escolher uma foto da galeria/câmera:
- Ajuste **Esquerda ↔ Direita**, **Cima ↕ Baixo**, **Zoom**, **Espelhar foto**, tamanho do rosto ou **arraste direto na prévia** com visualização ao vivo do boneco inteiro na pista.
- **Privacidade garantida**: nenhuma foto é enviada para servidores externos — tudo é processado e salvo exclusivamente no navegador do seu aparelho.

---

## Estrutura e Testes

```text
index.html               página principal, HUD, Opções e modais
css/style.css            design system neon e responsividade (Container Queries)
manifest.json / sw.js    instalação PWA e funcionamento offline
js/game_physics.js       física 60 Hz, rampas, grind e rig 2.5D articulado com IK
js/game_world.js         geração procedural, 4 biomas, clima e obstáculos
js/main.js               loop, câmera, Gamepad, contagem, HUD e fluxo de telas
js/particles.js          partículas cacheadas, faíscas e textos flutuantes
js/audio.js              canais separados de Música e SFX via Web Audio API
js/progression.js        carteira, Oficina, Missões, Baú de Nível e Troféus
js/character_manager.js  personagens e Estúdio de Personagens por foto
js/leaderboard_online.js integração segura com Firebase Firestore
tools/teste_fisica.js    suíte automatizada de física, regras e áudio
```

### Rodar os testes automatizados

```bash
node tools/teste_fisica.js
```
