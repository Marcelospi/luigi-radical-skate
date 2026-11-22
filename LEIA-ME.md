# Luigi Radical Skate 🛹

Jogo de skate e esportes radicais no navegador com **4 modos de locomoção** (🛹 **Skate**, 🚲 **Bicicleta BMX**, 🛴 **Patinete** e 🛼 **Patins**), física realista, rampas com **Lip Boost**, **Grind** em corrimãos, 4 fases temáticas, áudio procedural via Web Audio API e **Estúdio de Personagens** por foto.

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

## Como Jogar no Computador

Dê um duplo clique no arquivo **`JOGAR.bat`** na pasta do projeto.

- Ele inicia o servidor local automaticamente usando Python e abre o jogo em `http://localhost:8000`.
- Mostra também o endereço IP local da sua rede Wi-Fi para jogar no celular pelo navegador.
- Quando terminar de jogar, basta fechar a janela do terminal.

---

## Controles

| Ação | Teclado | Celular |
|---|---|---|
| Pular (Ollie) / Lip Boost no topo da rampa | `Espaço`, `W` ou `↑` | Botão **PULAR** |
| Abaixar (chão) / Queda rápida (ar) / Sair do Grind | `S` ou `↓` | Botão **ABAIXAR** |
| Remar (Acelerar) | `→` ou `D` | Botão **REMAR** |
| Freio leve | `←` ou `A` | — |
| Kickflip | `Z` | Botão **FLIP** |
| Giro 360° | `X` | Botão **360°** |
| Indy Grab | `C` | Botão **GRAB** |
| Super Flip | `Espaço` novamente no ar | Botão **PULAR** no ar |
| Pausar | `P` ou `Esc` | Botão `❚❚` |
| Mudo | `M` | Botão 🔊 |

- **Ollie variável**: segurar a tecla de pulo salta mais alto.
- **Lip Boost**: aperte Pular perto do topo da rampa para decolar mais alto com impulso extra.
- **Grind em corrimãos**: pouse sobre os corrimãos para deslizar com faíscas metálicas, multiplicar o combo e pular direto saindo do trilho.
- **Combos**: encadear manobras no ar e pousar limpo rende bônus de **Pouso Perfeito**.

---

## Fases

O cenário e a iluminação mudam suavemente conforme a distância, e cada nova fase dá **+1 skate e +1.000 pontos**:

| | Fase | Distância |
|---|---|---|
| 🌇 | Skatepark ao Pôr do Sol | 0 a 600m |
| 🏙️ | Metrópole Cyberpunk Neon | 600 a 1.400m |
| 🌴 | Praia & Píer Tropical | 1.400 a 2.400m |
| 🚀 | Pista Cósmica das Estrelas | 2.400m em diante |

A **Fase 1 não tem abismos nem pistas que desabam** — ideal para pegar o ritmo. Caindo no vazio com mais de uma vida, o resgate devolve o skatista para a pista custando um skate.

O placar guarda até 40 pontuações com nome, data e personagem, salvas localmente no navegador de cada aparelho (`localStorage`).

---

## Estúdio de Personagens (100% Local e Privado)

No menu do jogo, acesse **Criar novo** para tirar uma foto na hora pela **câmera** ou escolher da galeria:

- Ajuste **Esquerda ↔ Direita**, **Cima ↕ Baixo**, **Zoom**, **Espelhar foto** ou **arraste direto na prévia** para encaixar o rosto sob o **capacete SK8 oficial** no boneco articulado (ou use a foto inteira se preferir).
- **Privacidade garantida**: nenhuma foto é enviada para servidores externos — tudo é processado e salvo exclusivamente no navegador do seu aparelho (`localStorage`).

---

## Estrutura do Projeto

```
index.html               página principal e HUD
css/style.css            visual da interface e responsividade
js/game_physics.js       física do skate, rampas, grind e rig 2.5D articulado
js/game_world.js         geração da pista, 4 biomas, texturas e iluminação
js/main.js               loop principal, câmera, telas e HUD
js/particles.js          partículas (faíscas, poeira, ondas de choque)
js/audio.js              sons realistas e música sintetizada via Web Audio API
js/character_manager.js  personagens e Estúdio de Personagens por foto
JOGAR.bat                atalho de 1 clique para abrir o jogo no Windows
```

### Rodar os testes automatizados

```bash
node tools/teste_fisica.js
```
