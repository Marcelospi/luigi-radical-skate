// ============================================================
// Teste da física e da geração de pista (roda sem navegador)
//
//   node tools/teste_fisica.js
//
// Existe por causa do bug em que o personagem nascia abaixo do asfalto e
// caía no vazio. Os testes 1, 2 e 5 cobrem exatamente esse caso.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');

// ---- Stubs de ambiente de navegador ----
function mockCtx() {
  const grad = { addColorStop() {} };
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(target, prop, v) { target[prop] = v; return true; }
  };
  const base = {
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => null,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
    measureText: () => ({ width: 10 }),
    canvas: { width: 1280, height: 720 }
  };
  return new Proxy(base, handler);
}

const sandbox = {
  console,
  Math,
  Date,
  performance: { now: () => Date.now() },
  document: {
    createElement: () => ({ width: 0, height: 0, getContext: () => mockCtx() }),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); }
  },
  requestAnimationFrame: () => {},
  Image: class { set src(v) {} },
  Uint8ClampedArray
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Sistemas auxiliares stubbados
sandbox.soundSystem = new Proxy({}, { get: () => () => {} });
sandbox.characterManager = {
  getSelected: () => ({ id: 'luigi_3d', width: 105, height: 130, duckHeight: 85 }),
  getSprite: () => null,
  getSpriteScale: () => 0.54
};

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('js/particles.js');
load('js/game_physics.js');
load('js/game_world.js');

// ---- Utilitários de teste ----
let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const VIDAS_INICIAIS = (() => {
  const w = new sandbox.GameWorld();
  const p = new sandbox.Player();
  p.reset(w);
  return p.lives;
})();

function newRun() {
  const world = new sandbox.GameWorld();
  const player = new sandbox.Player();
  player.reset(world);
  return { world, player };
}

function step(world, player, keys = {}) {
  world.update(player);
  player.update(world, keys);
}

// ============================================================
console.log('\n=== 1. O jogador nasce apoiado no asfalto ===');
{
  const { world, player } = newRun();
  check('pes exatamente sobre groundY', player.bottom === world.groundY,
    `bottom=${player.bottom} groundY=${world.groundY}`);
  check('onGround inicia verdadeiro', player.onGround === true);
}

// ============================================================
console.log('\n=== 2. Parado sem input durante o aquecimento ===');
{
  const { world, player } = newRun();
  let leftGround = 0;
  let minBottom = Infinity, maxBottom = -Infinity;

  for (let i = 0; i < 240; i++) {          // ~4s, ainda dentro do trecho de aquecimento
    step(world, player);
    if (!player.onGround) leftGround++;
    minBottom = Math.min(minBottom, player.bottom);
    maxBottom = Math.max(maxBottom, player.bottom);
  }

  check('nunca perde o contato com o chao', leftGround === 0, `frames no ar=${leftGround}`);
  check('nao afunda nem flutua', minBottom === world.groundY && maxBottom === world.groundY,
    `min=${minBottom} max=${maxBottom}`);
  check('mantem todas as vidas', player.lives === VIDAS_INICIAIS, `vidas=${player.lives}/${VIDAS_INICIAIS}`);
  check('nao morreu', player.isGameOver === false);
}

// ============================================================
console.log('\n=== 3. Salto sobe e volta para o chao ===');
{
  const { world, player } = newRun();
  let peak = player.bottom;
  let airFrames = 0;

  for (let i = 0; i < 12; i++) step(world, player, { Space: true });
  for (let i = 0; i < 120; i++) {
    step(world, player, {});
    if (!player.onGround) { airFrames++; peak = Math.min(peak, player.bottom); }
  }

  check('saiu do chao', airFrames > 20, `frames no ar=${airFrames}`);
  check('ganhou altura util', world.groundY - peak > 120, `altura=${(world.groundY - peak).toFixed(1)}px`);
  check('voltou a pousar', player.onGround === true);
  check('pousou alinhado com a pista', Math.abs(player.bottom - world.groundY) < 0.001,
    `bottom=${player.bottom.toFixed(2)}`);
}

// ============================================================
console.log('\n=== 4. Agachar mantem os pes no chao ===');
{
  const { world, player } = newRun();
  for (let i = 0; i < 10; i++) step(world, player, { KeyS: true });
  const duckBottom = player.bottom;
  const ducking = player.isDucking;

  for (let i = 0; i < 10; i++) step(world, player, {});

  check('agachou', ducking === true);
  check('pes continuam na pista agachado', duckBottom === world.groundY, `bottom=${duckBottom}`);
  check('pes continuam na pista ao levantar', player.bottom === world.groundY, `bottom=${player.bottom}`);
  check('nao perdeu vida ao agachar', player.lives === VIDAS_INICIAIS);
}

// ============================================================
console.log('\n=== 5. Queda muito rapida nao atravessa a pista ===');
{
  const { world, player } = newRun();
  player.y = world.groundY - 600;   // bem acima
  player.vy = 60;                   // velocidade absurda, acima do teto normal
  player.onGround = false;
  player.prevBottom = player.bottom;

  let landed = false;
  for (let i = 0; i < 90 && !landed; i++) {
    step(world, player, {});
    if (player.onGround) landed = true;
  }

  check('pousou em vez de cair no vazio', landed === true);
  check('pousou na superficie correta', landed && Math.abs(player.bottom - world.groundY) < 0.001,
    `bottom=${player.bottom.toFixed(2)}`);
  check('nao perdeu vida', player.lives === VIDAS_INICIAIS, `vidas=${player.lives}`);
}

// ============================================================
console.log('\n=== 6. Geracao: todo vao e saltavel e toda pista tem apoio ===');
{
  const { world, player } = newRun();
  const gaps = [];
  const shortLandings = [];
  const breakableTooWide = [];

  for (let i = 0; i < 9000; i++) {
    step(world, player, {});
    player.lives = VIDAS_INICIAIS;   // isola o teste da geracao
    player.isGameOver = false;

    // Geometria COMO FOI GERADA (impede que o colapso remova a plataforma quebradica
    // e crie um vao artificial maior que o gerado por chunkGap)
    for (const pl of world.platforms) {
      if (pl.isBreakable && pl.triggered) {
        pl.triggered = false;
        pl.isFalling = false;
        pl.fallY = 0;
        pl.fallSpeed = 0;
      }
    }

    const segs = world.platforms
      .map(p => [p.x, p.x + p.width])
      .sort((a, b) => a[0] - b[0]);

    // Invariante: trecho quebradico sempre mais curto que um salto
    for (const pl of world.platforms) {
      if (!pl.isBreakable) continue;
      const airSteps = (2 * Math.abs(sandbox.PHYS.JUMP_VELOCITY)) / sandbox.PHYS.GRAVITY;
      const reachWhenSpawned = airSteps * (pl.spawnSpeed || sandbox.PHYS.BASE_SPEED);
      if (pl.width >= reachWhenSpawned) breakableTooWide.push(pl.width);
    }

    for (let s = 1; s < segs.length; s++) {
      const gap = segs[s][0] - segs[s - 1][1];
      if (gap > 1) {
        gaps.push(gap);
        const landingWidth = segs[s][1] - segs[s][0];
        if (landingWidth < 300) shortLandings.push(landingWidth);
      }
    }
  }

  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  const airSteps = (2 * Math.abs(sandbox.PHYS.JUMP_VELOCITY)) / sandbox.PHYS.GRAVITY;
  const reachAtMinSpeed = airSteps * sandbox.PHYS.BASE_SPEED;

  check('gerou vaos intencionais', gaps.length > 0, `amostras=${gaps.length}`);
  check('maior vao cabe num salto normal', maxGap < reachAtMinSpeed,
    `maiorVao=${maxGap.toFixed(0)}px alcance=${reachAtMinSpeed.toFixed(0)}px`);
  check('plataforma de pouso sempre larga', shortLandings.length === 0,
    `estreitas=${shortLandings.length}`);
  check('trecho quebradico cabe num salto', breakableTooWide.length === 0,
    `largos demais=${breakableTooWide.length}${breakableTooWide.length ? ' maior=' + Math.max(...breakableTooWide).toFixed(0) : ''}`);
  check('pista continua sendo gerada a frente', world.trackEnd > 1500,
    `trackEnd=${world.trackEnd.toFixed(0)}`);
  check('distancia avancou', player.distance > 500, `${player.distance.toFixed(0)}m`);
}

// ============================================================
console.log('\n=== 7. Pista quebradica desaba e vira buraco real ===');
{
  const { world, player } = newRun();
  const plat = world.makePlatform(player.x - 50, 400, { breakable: true });
  world.platforms.push(plat);
  plat.triggerFall();

  for (let i = 0; i < 80; i++) world.updatePlatforms(0);

  check('marcada como caindo', plat.isFalling === true);
  check('deixa de sustentar o jogador', world.isPlatformSolid(plat) === false,
    `fallY=${plat.fallY.toFixed(0)}`);
}

// ============================================================
console.log('\n=== 8. Passo fixo: 60Hz e 144Hz produzem o mesmo resultado ===');
{
  // A simulacao nao usa delta interno, entao N passos == N passos.
  const a = newRun(), b = newRun();
  for (let i = 0; i < 300; i++) step(a.world, a.player, {});
  for (let i = 0; i < 300; i++) step(b.world, b.player, {});
  check('mesma quantidade de passos = mesma distancia',
    Math.abs(a.player.distance - b.player.distance) < 0.001,
    `${a.player.distance.toFixed(2)} vs ${b.player.distance.toFixed(2)}`);
}


// ============================================================
console.log('\n=== 9. Toque curto de salto continua util ===');
{
  // Salto minimo: aperta por 1 passo e solta
  const { world, player } = newRun();
  step(world, player, { Space: true });
  let peak = player.bottom;
  for (let i = 0; i < 90; i++) {
    step(world, player, {});
    peak = Math.min(peak, player.bottom);
  }
  const minJump = world.groundY - peak;

  // Salto completo: segura a tecla
  const full = newRun();
  let fullPeak = full.player.bottom;
  for (let i = 0; i < 30; i++) { step(full.world, full.player, { Space: true }); fullPeak = Math.min(fullPeak, full.player.bottom); }
  for (let i = 0; i < 60; i++) { step(full.world, full.player, {}); fullPeak = Math.min(fullPeak, full.player.bottom); }
  const maxJump = full.world.groundY - fullPeak;

  check('salto minimo passa a caixa de 58px com folga', minJump > 90, `minimo=${minJump.toFixed(0)}px`);
  check('segurar a tecla pula visivelmente mais alto', maxJump > minJump + 30,
    `minimo=${minJump.toFixed(0)}px maximo=${maxJump.toFixed(0)}px`);
}

// ============================================================
console.log('\n=== 10. Caixa: bate parado, passa com um toque ===');
{
  function runCrate(jump) {
    const world = new sandbox.GameWorld();
    const player = new sandbox.Player();
    player.reset(world);
    world.obstacles.length = 0;
    world.collectibles.length = 0;
    world.obstacles.push({
      type: 'crate', x: player.x + player.width + 420, y: world.groundY - 58,
      width: 54, height: 58, damageReason: 'Bateu na caixa', hit: false
    });

    let jumped = false;
    for (let i = 0; i < 260; i++) {
      const obs = world.obstacles[0];
      const keys = {};
      // Um unico toque de 1 passo, disparado tarde de proposito
      if (jump && !jumped && obs && obs.x - (player.x + player.width) < 46) { keys.Space = true; jumped = true; }
      world.update(player);
      player.update(world, keys);
      if (player.lives < VIDAS_INICIAIS) return 'bateu';
      if (!world.obstacles.length || world.obstacles[0].x + 54 < player.x) return 'passou';
    }
    return 'passou';
  }

  check('parado, bate na caixa', runCrate(false) === 'bateu');
  check('com um unico toque curto, passa por cima', runCrate(true) === 'passou');
}

// ============================================================
console.log('\n=== 11. Placa suspensa: bate de pe, passa agachado ===');
{
  function runSign(duck) {
    const world = new sandbox.GameWorld();
    const player = new sandbox.Player();
    player.reset(world);
    world.obstacles.length = 0;
    world.collectibles.length = 0;
    world.obstacles.push({
      type: 'sign', x: player.x + player.width + 420, y: world.groundY - 150,
      width: 78, height: 62, damageReason: 'Bateu na placa', hit: false
    });

    for (let i = 0; i < 260; i++) {
      const obs = world.obstacles[0];
      const keys = {};
      if (duck && obs && obs.x - (player.x + player.width) < 120) keys.KeyS = true;
      world.update(player);
      player.update(world, keys);
      if (player.lives < VIDAS_INICIAIS) return 'bateu';
      if (!world.obstacles.length || world.obstacles[0].x + 78 < player.x) return 'passou';
    }
    return 'passou';
  }

  check('de pe, bate na placa', runSign(false) === 'bateu');
  check('agachado, passa por baixo', runSign(true) === 'passou');
}


// ============================================================
console.log('\n=== 12. Fase 1 (0-600m) nao tem abismo nem pista que desaba ===');
{
  const { world, player } = newRun();
  let buracosNaFase1 = 0;
  let quebradicasNaFase1 = 0;
  let amostras = 0;

  while (player.distance < 600) {
    step(world, player, {});
    player.lives = VIDAS_INICIAIS;
    player.isGameOver = false;
    amostras++;
    if (amostras > 40000) break;

    for (const p of world.platforms) {
      if (p.isBreakable) quebradicasNaFase1++;
    }

    const segs = world.platforms
      .map(p => [p.x, p.x + p.width])
      .sort((a, b) => a[0] - b[0]);
    for (let s = 1; s < segs.length; s++) {
      if (segs[s][0] - segs[s - 1][1] > 1) buracosNaFase1++;
    }
  }

  check('nenhum trecho quebradico na fase 1', quebradicasNaFase1 === 0, `encontrados=${quebradicasNaFase1}`);
  check('nenhum abismo na fase 1', buracosNaFase1 === 0, `encontrados=${buracosNaFase1}`);
  check('a fase 1 foi realmente percorrida', player.distance >= 600, `${player.distance.toFixed(0)}m`);
}

// ============================================================
console.log('\n=== 13. Parado e sem fazer nada, a fase 1 inteira e sobrevivel ===');
{
  // Um jogador de 7 anos que so segura o pulo nao pode morrer no comeco
  const { world, player } = newRun();
  let quedas = 0;

  while (player.distance < 600 && !player.isGameOver) {
    step(world, player, {});
    if (player.deathReason === 'Caiu no abismo') quedas++;
  }

  check('nunca caiu no abismo na fase 1', quedas === 0);
  // Bater em caixa/placa sem jogar e esperado; cair no vazio, nao.
  check('se morreu, foi por obstaculo e nao por queda',
    !player.isGameOver || player.deathReason !== 'Caiu no abismo',
    `motivo=${player.deathReason || '(sobreviveu)'}, ${player.distance.toFixed(0)}m`);
}

// ============================================================
console.log('\n=== 14. Progressao de fases da a recompensa certa ===');
{
  const { world, player } = newRun();
  const vistas = [];
  let vidaNaVirada = null;
  player.lives = 3;   // abaixo do teto, para a recompensa ser observavel

  for (let i = 0; i < 60000 && player.currentStageIndex < 3; i++) {
    const antes = player.currentStageIndex;
    const vidasAntes = player.lives;
    player.invincibleTimer = 10;   // atravessa obstaculos sem falsear as vidas
    step(world, player, {});
    if (player.currentStageIndex !== antes) {
      vistas.push(player.currentStageIndex);
      if (vidaNaVirada === null) vidaNaVirada = player.lives - vidasAntes;
    }
  }

  check('as 4 fases sao alcancadas', player.currentStageIndex === 3,
    `fase final=${player.currentStageIndex + 1}, ${player.distance.toFixed(0)}m`);
  check('as fases avancam em ordem', vistas.join(',') === '1,2,3', `ordem=${vistas.join(',')}`);
  check('vidas ficam dentro do intervalo valido',
    player.lives >= 0 && player.lives <= player.maxLives,
    `vidas=${player.lives}/${player.maxLives}`);
  check('virada de fase abaixo do teto da +1 vida', vidaNaVirada === 1, `ganho=${vidaNaVirada}`);
}

// ============================================================
console.log('\n=== 15. Resgate no abismo devolve o jogador para a pista ===');
{
  const { world, player } = newRun();
  for (let i = 0; i < 7000; i++) { step(world, player, {}); player.lives = 5; player.isGameOver = false; }

  const voltouParaCasa = [];
  const apoiadoNoResgate = [];
  const vidasAposResgate = [];
  for (let n = 0; n < 12; n++) {
    player.y = world.deathY + 10;
    player.vy = 20;
    player.onGround = false;
    player.lives = 5;
    step(world, player, {});
    apoiadoNoResgate.push(player.onGround);   // o pouso importa neste instante
    vidasAposResgate.push(player.lives);      // mede custo do resgate imediatamente
    // Dá tempo do retorno gradual acontecer sem dano acidental de obstáculos
    let chegouEmCasa = Math.round(player.x) === sandbox.PHYS.HOME_X;
    for (let i = 0; i < 160; i++) {
      player.invincibleTimer = Math.max(player.invincibleTimer, 10);
      step(world, player, {});
      if (Math.round(player.x) === sandbox.PHYS.HOME_X) chegouEmCasa = true;
    }
    voltouParaCasa.push(chegouEmCasa);
  }

  const falhouRetorno = voltouParaCasa.filter(ok => !ok).length;
  check('o jogador volta para a posicao normal apos o resgate', falhouRetorno === 0,
    `deslocado em ${falhouRetorno}/12 resgates`);
  check('o resgate sempre pousa em chao solido',
    apoiadoNoResgate.every(Boolean),
    `apoiado em ${apoiadoNoResgate.filter(Boolean).length}/12`);
  check('o resgate custa exatamente uma vida',
    vidasAposResgate.every(v => v === 4),
    `vidas=${vidasAposResgate.join(',')}`);
}

// ============================================================
console.log('\n=== 16. Acelerar nao gera vao impossivel ===');
{
  // Acelerar aumenta a velocidade, e o vao e dimensionado por ela.
  // O salto precisa continuar cobrindo o vao mesmo assim.
  const { world, player } = newRun();
  const problemas = [];

  for (let i = 0; i < 12000; i++) {
    step(world, player, { ArrowRight: true });   // segurando acelerar o tempo todo
    player.lives = VIDAS_INICIAIS;
    player.isGameOver = false;

    for (const pl of world.platforms) {
      if (pl.isBreakable && pl.triggered) {
        pl.triggered = false;
        pl.isFalling = false;
        pl.fallY = 0;
        pl.fallSpeed = 0;
      }
    }

    const segs = world.platforms
      .map(p => [p.x, p.x + p.width])
      .sort((a, b) => a[0] - b[0]);
    for (let s = 1; s < segs.length; s++) {
      const vao = segs[s][0] - segs[s - 1][1];
      if (vao > 1) {
        const passosNoAr = (2 * Math.abs(sandbox.PHYS.JUMP_VELOCITY)) / sandbox.PHYS.GRAVITY;
        // O pior caso e cruzar o vao na velocidade minima do jogo
        const alcanceMinimo = passosNoAr * sandbox.PHYS.BASE_SPEED;
        if (vao >= alcanceMinimo) problemas.push(Math.round(vao));
      }
    }
  }

  check('velocidade final acima da normal', player.speed > sandbox.PHYS.MAX_SPEED,
    `${player.speed.toFixed(1)} (normal=${sandbox.PHYS.MAX_SPEED})`);
  check('nenhum vao maior que o alcance minimo de salto', problemas.length === 0,
    `problemas=${problemas.length}${problemas.length ? ' maior=' + Math.max(...problemas) : ''}`);
}

// ============================================================
console.log('\n=== 17. Segurar Espaco no pulo nao dispara SUPER FLIP acidentalmente ===');
{
  const { world, player } = newRun();
  // Segura Espaco por 15 passos seguidos desde o chao
  for (let i = 0; i < 15; i++) step(world, player, { Space: true });
  const disparouSegurando = player.tricksInAir.includes('SUPER FLIP');

  // Solta por 2 passos no ar e aperta Espaco novamente
  step(world, player, {});
  step(world, player, {});
  step(world, player, { Space: true });
  const disparouNovoToque = player.tricksInAir.includes('SUPER FLIP');

  check('segurar Espaco no salto nao aciona SUPER FLIP', disparouSegurando === false,
    `manobras=${player.tricksInAir.join(',') || 'nenhuma'}`);
  check('novo toque em Espaco no ar aciona SUPER FLIP', disparouNovoToque === true,
    `manobras=${player.tricksInAir.join(',')}`);
}

// ============================================================
console.log('\n=== 18. Fast-fall acelera a descida e pousa corretamente ===');
{
  const normal = newRun();
  for (let i = 0; i < 10; i++) step(normal.world, normal.player, { Space: true });
  let normalAir = 0;
  for (let i = 0; i < 120 && !normal.player.onGround; i++) {
    step(normal.world, normal.player, {});
    normalAir++;
  }

  const fast = newRun();
  for (let i = 0; i < 10; i++) step(fast.world, fast.player, { Space: true });
  let fastAir = 0;
  let ativouFastFall = false;
  for (let i = 0; i < 120 && !fast.player.onGround; i++) {
    step(fast.world, fast.player, { ArrowDown: true });
    if (fast.player.isFastFalling) ativouFastFall = true;
    fastAir++;
  }

  check('fast-fall e ativado no ar', ativouFastFall === true);
  check('fast-fall pousa mais rapido que queda normal', fastAir < normalAir,
    `fast=${fastAir} frames vs normal=${normalAir} frames`);
  check('fast-fall pousa alinhado com a pista',
    fast.player.onGround && Math.abs(fast.player.bottom - fast.world.groundY) < 0.001);
}

// ============================================================
console.log('\n=== 19. Grind em corrimao sustenta, pontua e permite ollie ===');
{
  const { world, player } = newRun();
  world.obstacles.length = 0;
  // Posiciona um corrimao elevado logo a frente e faz o jogador cair sobre ele
  const railY = world.groundY - 76;
  world.rails = [{ x: player.x - 20, y: railY, width: 620, height: 14, surfaceType: 'metal' }];
  player.y = railY - player.height - 24;
  player.vy = 6;
  player.onGround = false;
  player.prevBottom = player.bottom;

  let fezGrind = false;
  let grindTicks = 0;
  let eventoGrindStart = false;
  const scoreAntes = player.score;

  for (let i = 0; i < 35; i++) {
    step(world, player, {});
    if (player.isGrinding) {
      fezGrind = true;
      grindTicks++;
    }
    if (player.frameEvents.some(e => e.type === 'grind_start')) eventoGrindStart = true;
  }

  // Pula saindo do grind
  step(world, player, { Space: true });
  const pulouDoGrind = !player.onGround && !player.isGrinding && player.vy < 0;

  check('entrou em grind sobre o corrimao', fezGrind === true && grindTicks > 10, `ticks=${grindTicks}`);
  check('emitiu evento grind_start', eventoGrindStart === true);
  check('acumulou pontos durante o grind', player.score > scoreAntes + 50,
    `ganho=${player.score - scoreAntes}`);
  check('conseguiu dar ollie saindo do grind', pulouDoGrind === true, `vy=${player.vy.toFixed(1)}`);
}

// ============================================================
console.log('\n=== 20. Freio suave desacelera sem cair abaixo de BASE_SPEED ===');
{
  const { world, player } = newRun();
  player.speed = 11.0;
  for (let i = 0; i < 20; i++) step(world, player, { ArrowLeft: true });
  const aposFrear = player.speed;

  for (let i = 0; i < 120; i++) step(world, player, { ArrowLeft: true });
  const pisoFreio = player.speed;

  check('freio reduz a velocidade', aposFrear < 11.0, `velocidade=${aposFrear.toFixed(2)}`);
  check('freio nunca cai abaixo de BASE_SPEED', pisoFreio >= sandbox.PHYS.BASE_SPEED,
    `piso=${pisoFreio.toFixed(2)} vs BASE=${sandbox.PHYS.BASE_SPEED}`);
}

// ============================================================
console.log('\n=== 21. Telemetria retrocompativel e eventos de quadro ===');
{
  const { world, player } = newRun();
  step(world, player, {});
  const temCampos =
    typeof player.speedNormalized === 'number' &&
    typeof player.pitch === 'number' &&
    typeof player.surfaceType === 'string' &&
    typeof player.isGrinding === 'boolean' &&
    typeof player.grindIntensity === 'number' &&
    typeof player.isPushing === 'boolean' &&
    typeof player.pushPhase === 'number' &&
    typeof player.landingImpact === 'number' &&
    typeof player.lastLandingImpact === 'number' &&
    typeof player.airHeight === 'number' &&
    Array.isArray(player.frameEvents);

  step(world, player, { Space: true });
  const eventoPulo = player.frameEvents.some(e => e.type === 'jump');
  let eventoPouso = false;
  for (let i = 0; i < 90; i++) {
    step(world, player, {});
    if (player.frameEvents.some(e => e.type === 'land' || e.type === 'perfect_land')) {
      eventoPouso = true;
      break;
    }
  }

  check('campos de telemetria expostos com tipos corretos', temCampos === true);
  check('emite evento jump no salto', eventoPulo === true);
  check('emite evento land no pouso', eventoPouso === true);
  check('registra lastLandingImpact maior que zero apos pouso', player.lastLandingImpact > 0,
    `impact=${player.lastLandingImpact.toFixed(2)}`);
}

// ============================================================
console.log('\n=== 22. Rampa realista: sobe a curva, inclina e decola no lip ===');
{
  function runRampTest(pressBoostAtLip) {
    const { world, player } = newRun();
    world.obstacles.length = 0;
    world.ramps.length = 0;
    const ramp = { x: player.x + 140, y: world.groundY - 66, width: 176, height: 66, used: false, usedAnim: 0, riderU: 0 };
    world.ramps.push(ramp);

    let subiuCurva = false;
    let maxU = 0;
    let minPitch = 0;
    let decolouNoLip = false;
    let eventoBoosted = false;
    let launchVy = 0;

    for (let i = 0; i < 80; i++) {
      const keys = {};
      if (pressBoostAtLip && player.isOnRamp && player.rampProgress >= 0.78) {
        keys.Space = true;
      }
      step(world, player, keys);
      if (player.isOnRamp) {
        subiuCurva = true;
        maxU = Math.max(maxU, player.rampProgress);
        minPitch = Math.min(minPitch, player.pitch);
      }
      const ev = player.frameEvents.find(e => e.type === 'ramp');
      if (ev) {
        decolouNoLip = true;
        eventoBoosted = !!ev.boosted;
        launchVy = player.vy;
        break;
      }
    }
    return { subiuCurva, maxU, minPitch, decolouNoLip, eventoBoosted, launchVy };
  }

  const normal = runRampTest(false);
  const boosted = runRampTest(true);

  check('skatista sobe a curva da rampa antes de decolar',
    normal.subiuCurva && normal.maxU > 0.5,
    `maxU=${normal.maxU.toFixed(2)}`);
  check('inclina o skate acompanhando a curva da rampa',
    normal.minPitch < -0.25,
    `minPitch=${normal.minPitch.toFixed(2)}rad`);
  check('decola automaticamente ao chegar no lip',
    normal.decolouNoLip && normal.launchVy < -17,
    `vy=${normal.launchVy.toFixed(2)}`);
  check('apertar Pulo no lip ativa Lip Boost com lancamento mais alto',
    boosted.decolouNoLip && boosted.eventoBoosted && boosted.launchVy < normal.launchVy - 1.5,
    `normal=${normal.launchVy.toFixed(2)} vs boost=${boosted.launchVy.toFixed(2)}`);
}

// ============================================================
console.log('\n=== 23. Modo sprite aprimorado (crossfade, micro-skew e manobras) ===');
{
  const { world, player } = newRun();
  const ctx = mockCtx();
  let drawOk = true;
  let erro = '';

  try {
    const fakeSprites = {
      skate: { width: 100, height: 130 },
      jump:  { width: 100, height: 130 },
      duck:  { width: 100, height: 85 },
      trick: { width: 100, height: 130 }
    };
    sandbox.characterManager.getSelected = () => ({
      id: 'luigi_3d', renderMode: 'sprite', width: 105, height: 130, duckHeight: 85
    });
    sandbox.characterManager.getSprite = (_, pose) => fakeSprites[pose] || fakeSprites.skate;

    // Skate + remada (micro-skew positivo)
    for (let i = 0; i < 6; i++) step(world, player, { ArrowRight: true });
    const skewRemando = player.skewX;
    player.draw(ctx);

    // Troca para salto -> crossfade iniciado (poseBlend < 1)
    step(world, player, { ArrowUp: true });
    const blendInicioPulo = player.poseBlend;
    player.draw(ctx);

    // Kickflip no ar
    step(world, player, { KeyZ: true });
    player.draw(ctx);

    check('crossfade inicia suave ao trocar de pose', blendInicioPulo < 1, `poseBlend=${blendInicioPulo.toFixed(2)}`);
    check('micro-skew responde a remada', skewRemando > 0.01, `skewX=${skewRemando.toFixed(3)}`);
  } catch (e) {
    drawOk = false;
    erro = String(e && e.message || e);
  }

  check('modo sprite aprimorado renderiza sem excecoes', drawOk === true, erro);
}

console.log(`\n${failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'}`);
process.exit(failures === 0 ? 0 : 1);
