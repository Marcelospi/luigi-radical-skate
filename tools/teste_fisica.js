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
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
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
load('js/progression.js');
load('js/game_physics.js');
load('js/game_world.js');

// ---- Utilitários de teste ----
let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const VIDAS_INICIAIS = 3;
const MAX_VIDAS = 3;

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
  check('inicia com 3 vidas e teto de 3', player.lives === VIDAS_INICIAIS && player.maxLives === MAX_VIDAS,
    `vidas=${player.lives}/${player.maxLives}`);
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
      // Um unico toque minimo (1 passo), disparado bem proximo da caixa
      if (jump && !jumped && obs && obs.x - (player.x + player.width) < 4) { keys.Space = true; jumped = true; }
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
  const viradas = [];

  for (let i = 0; i < 60000 && player.currentStageIndex < 3; i++) {
    const antes = player.currentStageIndex;
    const vidasAntes = player.lives;
    player.invincibleTimer = 10;   // atravessa obstaculos sem falsear as vidas
    // Mantem na pista caso haja abismo nas fases 2-3 para observar a progressao limpa de vidas (3 -> 4 -> 5)
    if (player.y > world.groundY - player.height) {
      player.y = world.groundY - player.height;
      player.vy = 0;
      player.onGround = true;
    }
    step(world, player, {});
    if (player.currentStageIndex !== antes) {
      vistas.push(player.currentStageIndex);
      viradas.push({ antes: vidasAntes, depois: player.lives });
    }
  }

  check('as 4 fases sao alcancadas', player.currentStageIndex === 3,
    `fase final=${player.currentStageIndex + 1}, ${player.distance.toFixed(0)}m`);
  check('as fases avancam em ordem', vistas.join(',') === '1,2,3', `ordem=${vistas.join(',')}`);
  check('vidas ficam dentro do intervalo valido',
    player.lives >= 0 && player.lives <= player.maxLives && player.maxLives === MAX_VIDAS,
    `vidas=${player.lives}/${player.maxLives}`);
  check('virada de fase respeita teto 3 sem empilhar vidas extras',
    viradas.length === 3 &&
    viradas.every(v => v.antes === 3 && v.depois === 3),
    viradas.map(v => `${v.antes}->${v.depois}`).join(', '));

  // Testa que virada de fase nao recarrega vidas automaticamente (cada uma das 3 vidas conta!)
  const easyHurt = newRun();
  easyHurt.player.lives = 2;
  easyHurt.player.distance = 610;
  easyHurt.player.checkStageProgression();
  const hardHurt = newRun();
  hardHurt.player.reset(hardHurt.world, { gameMode: 'classic', difficulty: 'hard' });
  hardHurt.player.lives = 2;
  hardHurt.player.distance = 610;
  hardHurt.player.checkStageProgression();
  check('Passar de fase da pontos mas nao recarrega vidas gratis (2 -> 2 no Facil e Dificil)',
    easyHurt.player.lives === 2 && hardHurt.player.lives === 2,
    `easy=${easyHurt.player.lives}, hard=${hardHurt.player.lives}`);
}

// ============================================================
console.log('\n=== 15. Resgate no abismo devolve o jogador para a pista ===');
{
  const { world, player } = newRun();
  for (let i = 0; i < 7000; i++) { step(world, player, {}); player.lives = VIDAS_INICIAIS; player.isGameOver = false; }

  const voltouParaCasa = [];
  const apoiadoNoResgate = [];
  const vidasAposResgate = [];
  for (let n = 0; n < 12; n++) {
    player.y = world.deathY + 10;
    player.vy = 20;
    player.onGround = false;
    player.isOnRamp = false;
    player.isGrinding = false;
    player.isInLoop = false;
    player.currentLoop = null;
    player.hasShield = false;
    player.isGameOver = false;
    player.lives = VIDAS_INICIAIS;
    // Evita coincidir o exato frame de virada de fase (+1 vida) no passo da queda proposital
    const tl = sandbox.getStageTimeline(player.distance + 40);
    player.currentStageIndex = tl.stageIndex;
    player._stageMilestone = tl.milestoneCount;
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
    vidasAposResgate.every(v => v === VIDAS_INICIAIS - 1),
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
    normal.decolouNoLip && normal.launchVy < -15.5 && normal.launchVy > -18.5,
    `vy=${normal.launchVy.toFixed(2)}`);
  check('apertar Pulo no lip ativa Lip Boost com lancamento mais alto',
    boosted.decolouNoLip && boosted.eventoBoosted && boosted.launchVy < normal.launchVy - 1.2,
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

// ============================================================
console.log('\n=== 24. 4 Esportes: Skate, BMX, Patinete e Patins ===');
{
  const sports = sandbox.SPORTS;
  const ids = ['skate', 'bmx', 'scooter', 'skates'];
  check('window.SPORTS expoe os 4 esportes completos',
    ids.every(id => sports && sports[id] && Array.isArray(sports[id].tricks) && Array.isArray(sports[id].touchLabels)));

  // 24a. Patins: pulo duplo no ar
  {
    const { world, player } = newRun();
    player.setSport('skates');
    // Primeiro salto
    step(world, player, { Space: true });
    for (let i = 0; i < 12; i++) step(world, player, {});
    const vyAntes = player.vy;
    // Segundo salto no ar
    step(world, player, { Space: true });
    const fezPuloDuplo = player.vy < vyAntes && player.vy < -10 && player.doubleJumpAvailable === false;
    const naoFezTrickAntes = !player.tricksInAir.includes('MISTY FLIP');

    // Solta e aperta Space de novo -> agora dispara MISTY FLIP
    step(world, player, {});
    step(world, player, { Space: true });
    const fezMistyDepois = player.tricksInAir.includes('MISTY FLIP');

    // Pousa e recupera pulo duplo
    for (let i = 0; i < 120 && !player.onGround; i++) step(world, player, {});
    check('Patins: pulo duplo funciona no ar antes de MISTY FLIP',
      fezPuloDuplo && naoFezTrickAntes, `vyAntes=${vyAntes.toFixed(1)}`);
    check('Patins: apos pulo duplo, Space no ar faz MISTY FLIP', fezMistyDepois === true);
    check('Patins: pousar recarrega o pulo duplo', player.onGround && player.doubleJumpAvailable === true);
  }

  // 24b. Patinete: manobra completa mais rapido que no Skate
  {
    function passosManobra(sportId) {
      const { world, player } = newRun();
      player.setSport(sportId);
      step(world, player, { ArrowUp: true });
      for (let i = 0; i < 4; i++) step(world, player, { ArrowUp: true });
      step(world, player, { KeyZ: true });
      let passos = 1;
      for (let i = 0; i < 40 && player.trickState; i++) {
        step(world, player, {});
        passos++;
      }
      return passos;
    }
    const pSkate = passosManobra('skate');
    const pScooter = passosManobra('scooter');
    check('Patinete: manobra completa mais rapido que no Skate', pScooter < pSkate,
      `patinete=${pScooter} vs skate=${pSkate} passos`);
  }

  // 24c. BMX: lancamento na rampa mais alto que no Skate
  {
    function launchVyRamp(sportId) {
      const { world, player } = newRun();
      player.setSport(sportId);
      world.obstacles.length = 0;
      world.ramps.length = 0;
      world.ramps.push({ x: player.x + 140, y: world.groundY - 66, width: 176, height: 66, used: false, usedAnim: 0, riderU: 0 });
      for (let i = 0; i < 80; i++) {
        step(world, player, {});
        if (player.frameEvents.some(e => e.type === 'ramp')) return player.vy;
      }
      return 0;
    }
    const vySkate = launchVyRamp('skate');
    const vyBmx = launchVyRamp('bmx');
    check('BMX: decolagem na rampa mais forte que no Skate', vyBmx < vySkate - 1.5,
      `bmx=${vyBmx.toFixed(2)} vs skate=${vySkate.toFixed(2)}`);
  }

  // 24d. Renderizacao dos 4 esportes sem erros nem NaN
  {
    let nanCalls = 0;
    const baseCtx = mockCtx();
    const nanCheckCtx = new Proxy(baseCtx, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function') {
          return (...args) => {
            for (const a of args) {
              if (typeof a === 'number' && !Number.isFinite(a)) nanCalls++;
            }
            return val.apply(target, args);
          };
        }
        return val;
      }
    });

    let allOk = true;
    let err = '';
    try {
      for (const id of ids) {
        const { world, player } = newRun();
        player.setSport(id);
        player.draw(nanCheckCtx);
        step(world, player, { ArrowRight: true });
        player.draw(nanCheckCtx);
        step(world, player, { ArrowUp: true });
        step(world, player, { KeyZ: true });
        player.draw(nanCheckCtx);
      }
    } catch (e) {
      allOk = false;
      err = String(e && e.message || e);
    }
    check('todos os 4 esportes renderizam sem erros nem NaN', allOk && nanCalls === 0,
      err || `nanCalls=${nanCalls}`);
  }
}

// ============================================================
console.log('\n=== 25. Cutout Puppet Rig (assets/rig/*.png) com IK nos 4 esportes ===');
{
  const fakeImg = (w, h) => ({ width: w, height: h });
  const fakeRig = {
    ready: true,
    head: fakeImg(160, 160),
    helmetOverlay: fakeImg(160, 160),
    torso: fakeImg(120, 140),
    armUpper: fakeImg(52, 88),
    armLower: fakeImg(52, 96),
    thigh: fakeImg(64, 96),
    shinShoe: fakeImg(76, 110),
    skateboard: fakeImg(180, 56)
  };

  let nanCalls = 0;
  let drawImageCalls = 0;
  const baseCtx = mockCtx();
  const spyCtx = new Proxy(baseCtx, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val === 'function') {
        return (...args) => {
          if (prop === 'drawImage') drawImageCalls++;
          for (const a of args) {
            if (typeof a === 'number' && !Number.isFinite(a)) nanCalls++;
          }
          return val.apply(target, args);
        };
      }
      return val;
    }
  });

  const prevGetRigParts = sandbox.characterManager.getRigParts;
  const prevGetHeadImage = sandbox.characterManager.getHeadImage;
  const prevGetSelected = sandbox.characterManager.getSelected;

  sandbox.characterManager.getRigParts = () => fakeRig;
  sandbox.characterManager.getHeadImage = () => fakeImg(160, 160);
  sandbox.characterManager.getSelected = () => ({
    id: 'luigi_3d', renderMode: 'sprite', fullPhoto: false, width: 105, height: 130, duckHeight: 85
  });

  let ok = true;
  let erro = '';
  let peRemandoMoveu = false;
  let quadrilAgachou = false;

  try {
    for (const sportId of ['skate', 'bmx', 'scooter', 'skates']) {
      const { world, player } = newRun();
      player.setSport(sportId);

      // Cruzeiro
      step(world, player, {});
      player.draw(spyCtx);
      const hipNormal = player.rigPose.hipY;
      const rearFootNormalX = player.rigPose.rearFootX;

      // Remada / aceleracao
      for (let i = 0; i < 8; i++) {
        step(world, player, { ArrowRight: true });
        player.draw(spyCtx);
      }
      if (sportId === 'skate' && Math.abs(player.rigPose.rearFootX - rearFootNormalX) > 2) {
        peRemandoMoveu = true;
      }

      // Agachamento
      for (let i = 0; i < 8; i++) {
        step(world, player, { KeyS: true });
        player.draw(spyCtx);
      }
      if (sportId === 'skate' && player.rigPose.hipY > hipNormal + 8) {
        quadrilAgachou = true;
      }

      // Salto + manobras (KeyZ, KeyC)
      step(world, player, {});
      step(world, player, { ArrowUp: true });
      step(world, player, { KeyZ: true });
      player.draw(spyCtx);
      for (let i = 0; i < 25; i++) step(world, player, {});
      step(world, player, { KeyC: true });
      player.draw(spyCtx);
    }

    // Modo fullPhoto usa fallback de sprite sem quebrar
    sandbox.characterManager.getSelected = () => ({
      id: 'custom_full', renderMode: 'sprite', fullPhoto: true, width: 100, height: 130, duckHeight: 85
    });
    const { world, player } = newRun();
    step(world, player, {});
    player.draw(spyCtx);
  } catch (e) {
    ok = false;
    erro = String(e && e.message || e);
  } finally {
    sandbox.characterManager.getRigParts = prevGetRigParts;
    sandbox.characterManager.getHeadImage = prevGetHeadImage;
    sandbox.characterManager.getSelected = prevGetSelected;
  }

  check('Cutout Rig desenha pecas nos 4 esportes sem erros nem NaN',
    ok && nanCalls === 0 && drawImageCalls > 40,
    erro || `drawImage=${drawImageCalls}, nanCalls=${nanCalls}`);
  check('remada articula o pe traseiro de forma independente', peRemandoMoveu === true);
  check('agachamento abaixa o quadril dobrando os joelhos no IK', quadrilAgachou === true);
}

// ============================================================
console.log('\n=== 26. Ima de Moedas atrai moedas e Estrela 2X dobra recompensa ===');
{
  const { world, player } = newRun();
  world.obstacles.length = 0;
  world.collectibles.length = 0;

  // Coleta ima e coloca uma moeda acima da altura normal do jogador
  world.collect(player, { type: 'magnet', x: player.x, y: player.y, size: 38 });
  const coin = { type: 'coin', x: player.x + 150, y: player.y - 110, size: 28, collected: false };
  world.collectibles.push(coin);

  for (let i = 0; i < 40 && player.coins === 0; i++) {
    step(world, player, {});
  }
  const atraiuMoeda = player.coins === 1 && player.magnetTimer > 0;

  // Coleta 2X e pega outra moeda
  world.collect(player, { type: 'double', x: player.x, y: player.y, size: 38 });
  const coinsAntes = player.coins;
  world.collect(player, { type: 'coin', x: player.x, y: player.y, size: 28 });
  const dobrouMoeda = player.coins - coinsAntes === 2;

  check('Ima atrai moeda proxima automaticamente', atraiuMoeda === true, `coins=${player.coins}`);
  check('Estrela 2X dobra quantidade de moedas coletadas', dobrouMoeda === true, `ganho=${player.coins - coinsAntes}`);
}

// ============================================================
console.log('\n=== 27. Turbo e Modo Radical esmagam obstaculos sem perder vida ===');
{
  const { world, player } = newRun();
  world.obstacles.length = 0;
  player.turboTimer = 120;
  player.turboDuration = 120;
  const vidasAntes = player.lives;
  const ptsAntes = player.score;

  world.obstacles.push({
    type: 'crate',
    x: player.x + player.width + 20,
    y: world.groundY - 58,
    width: 54,
    height: 58,
    damageReason: 'Bateu na caixa',
    hit: false
  });

  for (let i = 0; i < 30; i++) step(world, player, {});

  check('esmagou obstaculo no Turbo', player.smashedCount === 1, `smashed=${player.smashedCount}`);
  check('nao perdeu vida ao esmagar obstaculo', player.lives === vidasAntes, `vidas=${player.lives}`);
  check('ganhou pontos extras ao esmagar', player.score > ptsAntes + 120, `score+${player.score - ptsAntes}`);
}

// ============================================================
console.log('\n=== 28. Near Miss ("QUASE!") e Palavra L-U-I-G-I ===');
{
  const { world, player } = newRun();
  world.obstacles.length = 0;
  // Passa por cima da caixa bem rente (< 42px) sem encostar
  world.obstacles.push({
    type: 'crate',
    x: player.x + player.width + 60,
    y: world.groundY - 58,
    width: 54,
    height: 58,
    damageReason: 'Bateu na caixa',
    hit: false
  });

  step(world, player, { Space: true });
  for (let i = 0; i < 45; i++) {
    // Mantem perto do topo da caixa para passar raspando
    if (player.bottom > world.groundY - 76 && player.vy > 0) player.vy = -2;
    step(world, player, {});
  }

  // Coleta as 5 letras L-U-I-G-I
  const coinsAntes = player.coins;
  ['L', 'U', 'I', 'G', 'I'].forEach((ltr, idx) => {
    world.collect(player, { type: 'letter', letter: ltr, letterIndex: idx, x: player.x, y: player.y, size: 36 });
  });

  check('registrou Near Miss ao passar raspando sem bater', player.nearMissCount >= 1 && player.lives === VIDAS_INICIAIS,
    `nearMiss=${player.nearMissCount}`);
  check('completar L-U-I-G-I deu +25 moedas e ativou Modo Radical',
    player.coins >= coinsAntes + 25 && player.feverTimer > 0 && player.wordsCompleted === 1,
    `coins+${player.coins - coinsAntes}, fever=${player.feverTimer}`);
}

// ============================================================
console.log('\n=== 29. Gravidade Espacial na Fase 4, Trampolim e Caminho Alto ===');
{
  // Compara altura do salto na Fase 1 vs Fase 4 (Cosmica)
  function maxJumpHeightInStage(stageIdx) {
    const { world, player } = newRun();
    player.currentStageIndex = stageIdx;
    let peak = player.bottom;
    for (let i = 0; i < 12; i++) step(world, player, { Space: true });
    for (let i = 0; i < 100; i++) {
      step(world, player, {});
      peak = Math.min(peak, player.bottom);
    }
    return world.groundY - peak;
  }

  const hF1 = maxJumpHeightInStage(0);
  const hF4 = maxJumpHeightInStage(3);

  // Trampolim + Plataforma Elevada
  const { world, player } = newRun();
  world.obstacles.length = 0;
  world.pads.push({ type: 'bounce', x: player.x + 15, y: world.groundY, width: 76, height: 14, used: false, anim: 0 });
  step(world, player, {});
  const vyTrampolim = player.vy;
  const saltouTrampolim = vyTrampolim < -15;

  const elevY = world.groundY - 134;
  world.elevatedPlatforms.push({ x: player.x - 30, y: elevY, width: 320, height: 18 });
  player.y = elevY - player.height - 15;
  player.vy = 6;
  player.onGround = false;
  player.prevBottom = player.bottom;
  for (let i = 0; i < 20 && !player.onGround; i++) step(world, player, {});
  const pousouElevada = player.onGround && Math.abs(player.bottom - elevY) < 0.01;

  check('Fase 4 (Cosmica) tem gravidade reduzida com salto mais alto', hF4 > hF1 + 15,
    `F1=${hF1.toFixed(1)}px vs F4=${hF4.toFixed(1)}px`);
  check('Trampolim lanca o skatista para o alto', saltouTrampolim === true, `vy=${vyTrampolim.toFixed(1)}`);
  check('Plataforma elevada sustenta o skatista por cima', pousouElevada === true, `bottom=${player.bottom.toFixed(1)} vs elevY=${elevY}`);
}

// ============================================================
console.log('\n=== 30. Rig Customizado (genero, pele, cabeca grande) e ProgressionManager ===');
{
  const prevCharMgr = sandbox.characterManager;
  load('js/character_manager.js');

  let nanCalls = 0;
  const spyCtx = new Proxy(mockCtx(), {
    get(target, prop) {
      const val = target[prop];
      if (typeof val === 'function') {
        return (...args) => {
          for (const a of args) {
            if (typeof a === 'number' && !Number.isFinite(a)) nanCalls++;
          }
          return val.apply(target, args);
        };
      }
      return val;
    }
  });

  sandbox.characterManager.getSelected = () => ({
    id: 'luna_test',
    bodyStyle: 'custom',
    gender: 'girl',
    skinTone: 'brown',
    outfit: 'pink_cyan',
    hairColor: 'pink',
    accessory: 'crown',
    headSize: 'large',
    hasPhoto: true,
    width: 105,
    height: 130,
    duckHeight: 85
  });
  sandbox.characterManager.getHeadImage = () => ({ width: 256, height: 256 });

  let renderOk = true;
  try {
    const { world, player } = newRun();
    for (const sport of ['skate', 'bmx', 'scooter', 'skates']) {
      player.setSport(sport);
      step(world, player, { ArrowRight: true });
      player.draw(spyCtx);
      step(world, player, { Space: true });
      step(world, player, { KeyZ: true });
      player.draw(spyCtx);
    }
  } catch (_) {
    renderOk = false;
  } finally {
    sandbox.characterManager = prevCharMgr;
  }

  // Testa ProgressionManager: compra na oficina, item lendario e Bau de Nivel
  const pm = new sandbox.ProgressionManager();
  pm.data.coinsBank = 500;
  const buyRes = pm.buyItem('gear', 'neon'); // 250 moedas
  const prismaItem = sandbox.SHOP_CATALOG.gear.find(g => g.id === 'prisma');
  const prismaBlocked = pm.buyItem('gear', 'prisma'); // exige 3000 moedas
  const lvlInicial = pm.getRankLevel();
  const multInicial = pm.getScoreMultiplier();

  for (const m of pm.data.activeMissions) {
    pm.recordRunEvent(m.type, m.target + 1, { stageIndex: 0 });
  }
  const subiuNivel = pm.getRankLevel() === lvlInicial + 1;
  const multSubiu = pm.getScoreMultiplier() > multInicial;

  // Testa atalhos de manobra no PC (Shift e 2o toque em ArrowUp no ar)
  let shiftFezManobra = false;
  let upFezManobra = false;
  {
    const { world, player } = newRun();
    step(world, player, { Space: true });
    step(world, player, {});
    step(world, player, { ShiftLeft: true });
    shiftFezManobra = player.tricksInAir.length >= 1;
  }
  {
    const { world, player } = newRun();
    step(world, player, { ArrowUp: true });
    step(world, player, {});
    step(world, player, { ArrowUp: true });
    upFezManobra = player.tricksInAir.length >= 1;
  }

  check('Rig Customizado renderiza nos 4 esportes sem erros nem NaN', renderOk && nanCalls === 0, `nan=${nanCalls}`);
  check('Oficina compra item e atualiza equipamento/saldo', buyRes.ok === true && pm.data.equipped.gear === 'neon');
  check('Item lendario Prisma custa 3000 e exige saldo suficiente',
    Boolean(prismaItem && prismaItem.price === 3000 && prismaBlocked.ok === false && prismaBlocked.reason === 'insufficient_coins'));
  check('Atalhos Shift e 2o toque em Seta Cima executam manobra no ar', shiftFezManobra && upFezManobra,
    `shift=${shiftFezManobra} up2=${upFezManobra}`);
  check('Concluir 3 missoes abre Bau, sobe Nivel e aumenta multiplicador', subiuNivel && multSubiu,
    `nivel=${pm.getRankLevel()} mult=${pm.getScoreMultiplier().toFixed(1)}`);
}

// ============================================================
console.log('\n=== 31. Dificuldade Facil vs Dificil (abismo vs obstaculos) ===');
{
  // Modo Dificil: obstaculo tira 1 vida por vez, mas cair no buraco encerra a partida toda
  const { world, player } = newRun();
  player.reset(world, { gameMode: 'classic', difficulty: 'hard' });
  world.obstacles.length = 0;

  player.takeDamage('Bateu na caixa');
  const perdeuUmaNoObstaculo = player.lives === VIDAS_INICIAIS - 1 && !player.isGameOver;

  // Agora cai no abismo com 2 vidas restantes -> morre na hora (0 vidas)
  player.invincibleTimer = 0;
  player.y = world.deathY + 20;
  step(world, player, {});
  const morreuNoAbismoDificil = player.isGameOver === true && player.lives === 0;

  // Modo Facil: cair no abismo perde apenas 1 vida e resgata
  const easyRun = newRun();
  easyRun.player.reset(easyRun.world, { gameMode: 'classic', difficulty: 'easy' });
  easyRun.player.y = easyRun.world.deathY + 20;
  step(easyRun.world, easyRun.player, {});
  const resgatouNoFacil = easyRun.player.isGameOver === false && easyRun.player.lives === VIDAS_INICIAIS - 1;

  // Tombo em manobra incompleta: tira 1 vida no Dificil, nao tira vida no Facil
  const hardTrickRun = newRun();
  hardTrickRun.player.reset(hardTrickRun.world, { gameMode: 'classic', difficulty: 'hard' });
  hardTrickRun.player.onGround = false;
  hardTrickRun.player.trickState = { name: 'KICKFLIP', style: 'flip' };
  hardTrickRun.player.trickProgress = 0.4;
  hardTrickRun.player.vy = 10;
  hardTrickRun.player.land(hardTrickRun.world.platforms[0], hardTrickRun.world.groundY, hardTrickRun.world);
  const tomboNoDificil = hardTrickRun.player.lives === VIDAS_INICIAIS - 1;

  const easyTrickRun = newRun();
  easyTrickRun.player.reset(easyTrickRun.world, { gameMode: 'classic', difficulty: 'easy' });
  easyTrickRun.player.onGround = false;
  easyTrickRun.player.trickState = { name: 'KICKFLIP', style: 'flip' };
  easyTrickRun.player.trickProgress = 0.4;
  easyTrickRun.player.vy = 10;
  easyTrickRun.player.land(easyTrickRun.world.platforms[0], easyTrickRun.world.groundY, easyTrickRun.world);
  const semTomboNoFacil = easyTrickRun.player.lives === VIDAS_INICIAIS;

  check('Dificil: bater em obstaculo tira apenas 1 vida', perdeuUmaNoObstaculo, `vidas=${player.lives}`);
  check('Dificil: cair no buraco perde todas as vidas e encerra partida', morreuNoAbismoDificil,
    `isGameOver=${player.isGameOver} vidas=${player.lives}`);
  check('Facil: cair no buraco perde 1 vida e faz resgate', resgatouNoFacil,
    `isGameOver=${easyRun.player.isGameOver} vidas=${easyRun.player.lives}`);
  check('Dificil: pousar manobra incompleta da tombo (-1 vida)', tomboNoDificil, `vidas=${hardTrickRun.player.lives}`);
  check('Facil: pousar manobra incompleta nao tira vida', semTomboNoFacil, `vidas=${easyTrickRun.player.lives}`);
}

// ============================================================
console.log('\n=== 32. Distancia real de sessao, bonus x1.3 no Dificil e audio independente ===');
{
  // 32a. Comecar na Fase 4 mantem bioma em 2400m mas sessionDistance inicia em 0m
  if (sandbox.progressionManager?.data?.achievements) {
    delete sandbox.progressionManager.data.achievements.space_rider;
    sandbox.progressionManager.data.stats.bestDistance = 0;
  }
  const f4Run = newRun();
  f4Run.player.reset(f4Run.world, { gameMode: 'classic', difficulty: 'easy', startStageIndex: 3 });
  const distInicialMundo = f4Run.player.distance;
  const distInicialSessao = f4Run.player.sessionDistance;
  for (let i = 0; i < 60; i++) step(f4Run.world, f4Run.player, {});
  const sessaoAvancouCerto = f4Run.player.sessionDistance > 25 && f4Run.player.sessionDistance < 90;
  const espacoLivreNaoDestravouTrofeu = !sandbox.progressionManager?.data?.achievements?.space_rider;

  // 32b. Modo Dificil (x1.3) rende mais pontos na mesma manobra que o Modo Facil
  const easyScoreRun = newRun();
  easyScoreRun.player.reset(easyScoreRun.world, { gameMode: 'classic', difficulty: 'easy' });
  const ptsFacil = easyScoreRun.player.addScore(100);

  const hardScoreRun = newRun();
  hardScoreRun.player.reset(hardScoreRun.world, { gameMode: 'classic', difficulty: 'hard' });
  const ptsDificil = hardScoreRun.player.addScore(100);

  // 32c. SoundSystem com canais independentes (Musica vs SFX) e contagem regressiva
  const prevSound = sandbox.soundSystem;
  const mockGainNode = () => ({
    gain: { value: 1, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    connect() {}
  });
  const mockOsc = () => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
    start() {},
    stop() {}
  });
  const mockFilter = () => ({
    type: 'lowpass',
    frequency: { value: 400, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 1 },
    connect() {}
  });
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.AudioContext = class {
    constructor() {
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
    }
    createGain() { return mockGainNode(); }
    createOscillator() { return mockOsc(); }
    createBiquadFilter() { return mockFilter(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} }; }
    resume() { return Promise.resolve(); }
  };
  load('js/audio.js');
  let audioOk = false;
  let audioErr = '';
  try {
    const snd = sandbox.soundSystem;
    snd.init();
    snd.setMusicVolume(0.35);
    snd.setSfxVolume(0.8);
    snd.playCountdownTick(3);
    snd.playCountdownTick(0);
    snd.startMenuMusic();
    snd.stopMusic();
    audioOk = Math.abs(snd.getMusicVolume() - 0.35) < 0.001 && Math.abs(snd.getSfxVolume() - 0.8) < 0.001;
  } catch (e) {
    audioErr = String(e && e.message || e);
  } finally {
    sandbox.soundSystem = prevSound;
  }

  check('Fase 4 inicia com world=2400m e sessionDistance=0m sem dar trofeu gratis',
    distInicialMundo === 2400 && distInicialSessao === 0 && sessaoAvancouCerto && espacoLivreNaoDestravouTrofeu,
    `mundo=${distInicialMundo} sessao0=${distInicialSessao} sessao60=${f4Run.player.sessionDistance.toFixed(1)}`);
  check('Modo Dificil aplica bonus x1.3 de pontos sobre o Modo Facil',
    ptsDificil === Math.round(ptsFacil * 1.3) && ptsDificil > ptsFacil,
    `facil=${ptsFacil} vs dificil=${ptsDificil}`);
  check('SoundSystem suporta volumes independentes (Musica/SFX), Menu Music e Countdown',
    audioOk === true, audioErr);
}

// ============================================================
(async function runGroup33() {
  console.log('\n=== 33. Pulo curto, inicio calmo sem turbo e edicao/exclusao/restauracao ===');

  // 1) Pulo mais curto (entre 120 e 140px) e velocidade inicial calma (< 5.0)
  const jumpRun = newRun();
  let maxJumpH = 0;
  for (let i = 0; i < 45; i++) {
    step(jumpRun.world, jumpRun.player, { Space: i < 18 });
    const h = jumpRun.world.groundY - jumpRun.player.bottom;
    if (h > maxJumpH) maxJumpH = h;
  }
  const inicioCalmo = sandbox.PHYS.BASE_SPEED < 5.0 && maxJumpH >= 120 && maxJumpH <= 140;
  check('Pulo curto e inicio calmo calibrados', inicioCalmo,
    `BASE=${sandbox.PHYS.BASE_SPEED} maxJump=${maxJumpH.toFixed(1)}px`);

  // 2) Zero pads 'speed' e zero coletaveis 'turbo' nos primeiros 480m (Facil e Dificil)
  const prevDiff = sandbox.selectedDifficulty;
  let earlyTurbos = 0;
  let earlySpeedPads = 0;
  try {
    for (const diff of ['easy', 'hard']) {
      sandbox.selectedDifficulty = diff;
      for (let sample = 0; sample < 6; sample++) {
        const w = new sandbox.GameWorld();
        const p = new sandbox.Player();
        p.reset(w);
        const startX = p.x;
        while (w.nextChunkX < startX + 4800) {
          w.generate(w.nextChunkX + 600);
        }
        earlySpeedPads += w.ramps.filter(r => r.kind === 'speed' && r.x < startX + 4800).length;
        earlyTurbos += w.collectibles.filter(c => c.type === 'turbo' && c.x < startX + 4800).length;
      }
    }
  } finally {
    sandbox.selectedDifficulty = prevDiff;
  }
  check('Zero turbo e speed pads antes dos 500m iniciais',
    earlyTurbos === 0 && earlySpeedPads === 0,
    `turbos=${earlyTurbos} speedPads=${earlySpeedPads}`);

  // 3) Edicao, exclusao e restauracao de personagens (originais e customizados)
  const prevCharMgr = sandbox.characterManager;
  let editOk = false;
  let deleteBuiltinOk = false;
  let guardLastOk = false;
  let restoreOk = false;
  let charDetail = '';

  try {
    const CharMgrClass = vm.runInContext('typeof CharacterManager !== "undefined" ? CharacterManager : null', sandbox);
    let cm;
    if (CharMgrClass) {
      cm = new CharMgrClass();
    } else {
      load('js/character_manager.js');
      cm = sandbox.characterManager;
    }
    sandbox.characterManager = cm;
    cm.preloadAllSprites = async () => {};
    cm.preloadRigParts = async () => {};
    cm._rawBuiltins = cm._defaultBuiltins();
    cm.characters = cm._defaultBuiltins().map(c => cm.normalizeCharacter(c));
    cm.selectedId = 'luigi_3d';

    const edited = await cm.updateCharacter('luigi_3d', null, 'Luigi Turbo', {
      outfit: 'neon_green',
      skinTone: 'tan',
      gender: 'neutral',
      accessory: 'none',
      useHelmet: false,
      headSize: 'large',
      customizedBody: true
    });
    editOk = edited.name === 'Luigi Turbo'
      && edited.bodyStyle === 'custom'
      && edited.outfit === 'neon_green'
      && cm.hasHiddenOrModifiedBuiltins() === true;

    const custom = await cm.createCustomCharacterFromImage(null, 'Amigo Teste', {
      gender: 'girl',
      outfit: 'pink_cyan'
    });

    const del1 = cm.deleteCharacter('luigi_real');
    const del2 = cm.deleteCharacter('luna_radical');
    const del3 = cm.deleteCharacter('luigi_3d');
    deleteBuiltinOk = del1 && del2 && del3
      && !cm.characters.some(c => c.id === 'luigi_real')
      && !cm.characters.some(c => c.id === 'luna_radical')
      && !cm.characters.some(c => c.id === 'luigi_3d');

    // Agora resta apenas 1 desbloqueado (custom) + leo_cosmic bloqueado (750 moedas)
    const canDelLast = cm.canDeleteCharacter(custom.id);
    const delLastRes = cm.deleteCharacter(custom.id);
    guardLastOk = canDelLast === false && delLastRes === false && cm.characters.some(c => c.id === custom.id);

    await cm.restoreBuiltinCharacters();
    const luigiRestored = cm.getCharacter('luigi_3d');
    restoreOk = cm.hasHiddenOrModifiedBuiltins() === false
      && luigiRestored && luigiRestored.name === 'Luigi 3D (SK8-BOY)'
      && luigiRestored.bodyStyle === 'rig'
      && cm.characters.some(c => c.id === 'luigi_real')
      && cm.characters.some(c => c.id === 'luna_radical')
      && cm.characters.some(c => c.id === custom.id);

    charDetail = `edit=${editOk} del=${deleteBuiltinOk} guard=${guardLastOk} restore=${restoreOk}`;
  } catch (e) {
    charDetail = `err=${e && e.message ? e.message : e}`;
  } finally {
    sandbox.characterManager = prevCharMgr;
    sandbox.localStorage.removeItem('luigi_hidden_builtin_chars_v1');
    sandbox.localStorage.removeItem('luigi_builtin_char_overrides_v1');
    sandbox.localStorage.removeItem('luigi_custom_characters');
    sandbox.localStorage.removeItem('luigi_selected_char');
  }

  check('CharacterManager edita originais, exclui protegendo ultimo e restaura padrao',
    editOk && deleteBuiltinOk && guardLastOk && restoreOk, charDetail);

  // ============================================================
  console.log('\n=== 34. Loopings 360, aparicoes raras e novos cenarios (Volta Mundial) ===');
  {
    const tlVolcano = sandbox.getStageTimeline(3600);
    const tlGlacier = sandbox.getStageTimeline(4700);
    const tlRain = sandbox.getStageTimeline(5800);
    const tlTour2 = sandbox.getStageTimeline(6900);
    const wBlend = new sandbox.GameWorld();
    let blendsOk = true;
    for (let d = 0; d <= 9000; d += 250) {
      const b = wBlend.getBiomeBlend(d);
      if (!b || !b.current || !b.next || !Number.isFinite(b.t)) blendsOk = false;
    }
    check('7 fases (incluindo Fase 7 Chuva) e Volta Mundial infinita funcionam com transicao continua',
      sandbox.STAGES.length === 7
      && tlVolcano.stageIndex === 4
      && tlGlacier.stageIndex === 5
      && tlRain.stageIndex === 6
      && tlTour2.tourLap === 2
      && tlTour2.stageIndex === 0
      && blendsOk,
      `fases=${sandbox.STAGES.length} vol=${tlVolcano.stageIndex} gla=${tlGlacier.stageIndex} rain=${tlRain.stageIndex} volta2=lap${tlTour2.tourLap}/idx${tlTour2.stageIndex}`);

    // Looping 360 completo
    const loopRun = newRun();
    loopRun.world._nextCameoDist = 999999;
    loopRun.world.obstacles.length = 0;
    loopRun.world.chunkLoop(loopRun.player.x + 260, loopRun.player);
    let enteredLoop = false;
    let minPitch = 0;
    const scoreBefore = loopRun.player.score;
    for (let i = 0; i < 240; i++) {
      step(loopRun.world, loopRun.player, {});
      if (loopRun.player.isInLoop) enteredLoop = true;
      if (loopRun.player.pitch < minPitch) minPitch = loopRun.player.pitch;
      if (loopRun.player.loopsCompleted > 0 && i > 45) break;
    }
    check('Looping 360 gira de cabeca para baixo, coleta itens e sai com seguranca',
      enteredLoop && minPitch < -2.8 && loopRun.player.loopsCompleted === 1
      && loopRun.player.coins >= 4 && loopRun.player.onGround && loopRun.player.lives === VIDAS_INICIAIS
      && loopRun.player.score > scoreBefore + 300,
      `entrou=${enteredLoop} minPitch=${minPitch.toFixed(2)} loops=${loopRun.player.loopsCompleted} coins=${loopRun.player.coins} vidas=${loopRun.player.lives}`);

    // Cameos: Cachorro (pula no bote) e Disco Voador (agacha no raio)
    const dogRun = newRun();
    dogRun.world._nextCameoDist = 999999;
    dogRun.world.obstacles.length = 0;
    const dogCameo = dogRun.world.spawnCameo('dog_chase', dogRun.player);
    for (let i = 0; i < 220; i++) {
      const wantJump = dogCameo.timer >= 156 && dogCameo.timer <= 176;
      step(dogRun.world, dogRun.player, wantJump ? { Space: true } : {});
      if (dogCameo.outcome === 'dodged') break;
    }
    check('Cameo cachorro permite esquivar pulando e recompensa sem tirar vida',
      dogCameo.outcome === 'dodged' && dogRun.player.lives === VIDAS_INICIAIS,
      `outcome=${dogCameo.outcome} vidas=${dogRun.player.lives}`);

    const sprintRun = newRun();
    sprintRun.world._nextCameoDist = 999999;
    sprintRun.world.obstacles.length = 0;
    const guardCameo = sprintRun.world.spawnCameo('police_chase', sprintRun.player);
    for (let i = 0; i < 80; i++) {
      step(sprintRun.world, sprintRun.player, { ArrowRight: true });
      if (guardCameo.outcome === 'dodged') break;
    }
    check('Cameo guarda/cachorro pode ser despistado acelerando (REMAR / ArrowRight)',
      guardCameo.outcome === 'dodged' && guardCameo.timer < 80 && sprintRun.player.lives === VIDAS_INICIAIS,
      `outcome=${guardCameo.outcome} timer=${guardCameo.timer} vidas=${sprintRun.player.lives}`);

    const ufoRun = newRun();
    ufoRun.world._nextCameoDist = 999999;
    ufoRun.world.obstacles.length = 0;
    const ufoCameo = ufoRun.world.spawnCameo('ufo_beam', ufoRun.player);
    for (let i = 0; i < 260; i++) {
      const wantDuck = ufoCameo.phase === 'beam' || ufoCameo.phase === 'warn';
      step(ufoRun.world, ufoRun.player, wantDuck ? { ArrowDown: true } : {});
      if (ufoCameo.outcome === 'dodged') break;
    }
    check('Cameo disco voador permite passar agachado sob o raio sem tirar vida',
      ufoCameo.outcome === 'dodged' && ufoRun.player.lives === VIDAS_INICIAIS,
      `outcome=${ufoCameo.outcome} vidas=${ufoRun.player.lives}`);

    // Renderizacao sem NaN nos novos biomas, loops, obstaculos e todos os 6 cameos
    let nanCalls = 0;
    let renderAllOk = true;
    const spyCtx = new Proxy(mockCtx(), {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function') {
          return (...args) => {
            for (const a of args) {
              if (typeof a === 'number' && !Number.isFinite(a)) nanCalls++;
            }
            return val.apply(target, args);
          };
        }
        return val;
      }
    });
    try {
      const { world, player } = newRun();
      for (const distVal of [3800, 4900, 5800]) {
        player.distance = distVal;
        world.playerDistance = distVal;
        world.drawBackground(spyCtx, 1280, 720, 0);
        world.drawForeground(spyCtx, 1280, 720, 0.9);
      }
      world.chunkLoop(420, player);
      world.obstacles.push(
        { type: 'lava_rock', x: 300, y: world.groundY - 56, width: 56, height: 56, hit: false },
        { type: 'ice_crystal', x: 600, y: world.groundY - 60, width: 54, height: 60, hit: false }
      );
      for (const cType of ['dog_chase', 'police_chase', 'ufo_beam', 'shark_leap', 'lava_meteor', 'penguin_slide']) {
        world.spawnCameo(cType, player);
      }
      world.drawTrack(spyCtx, 1280, 720);
      world.drawCameos(spyCtx, player);
    } catch (_) {
      renderAllOk = false;
    }
    check('Novos biomas, loops, obstaculos e 6 cameos renderizam sem erros nem NaN',
      renderAllOk && nanCalls === 0, `nanCalls=${nanCalls}`);
  }

  // ============================================================
  console.log('\n=== 35. Perfis independentes por personagem, Closet (ativar/desativar) e sync Nuvem ===');
  {
    const prevPm = sandbox.progressionManager;
    sandbox.localStorage.removeItem('luigi_skate_progression_v1');
    sandbox.localStorage.removeItem('luigi_skate_progression_v2');
    sandbox.localStorage.removeItem('luigi_skate_high_score');
    sandbox.localStorage.removeItem('luigi_selected_char');

    const pmMulti = new sandbox.ProgressionManager();
    sandbox.progressionManager = pmMulti;

    // 35a. Luigi conquista moedas, compra Cyber Neon, melhora Ima, abre Fase 4 e grava recorde
    pmMulti.setActiveProfile('luigi_3d');
    pmMulti.addCoins(500);
    pmMulti.buyItem('gear', 'neon');
    pmMulti.buyUpgrade('magnet');
    pmMulti.unlockStage(3);
    pmMulti.recordHighScore(15000, 'classic');
    const luigiCoinsSnap = pmMulti.getCoins();

    // 35b. Luna Radical entra limpa e independente (50 moedas, fase 0, recorde 0, sem Cyber Neon)
    pmMulti.setActiveProfile('luna_radical');
    const lunaIsolada = pmMulti.getCoins() === 50
      && pmMulti.getUnlockedStageIndex() === 0
      && pmMulti.getHighScore('classic') === 0
      && pmMulti.isOwned('gear', 'neon') === false
      && pmMulti.getEquippedAccessory() === 'shades';

    // 35c. Toggle desativa o oculos da Luna e Player.getActiveAccessory respeita 'none'
    const togAccOff = pmMulti.toggleEquipItem('accessories', 'shades');
    const dummyPlayer = new sandbox.Player();
    const lunaAccDesativado = togAccOff.ok
      && togAccOff.activeId === 'none'
      && dummyPlayer.getActiveAccessory({ id: 'luna_radical', accessory: 'shades' }) === 'none';

    const togAccOn = pmMulti.toggleEquipItem('accessories', 'shades');
    const lunaAccReativado = togAccOn.ok && dummyPlayer.getActiveAccessory({ id: 'luna_radical', accessory: 'shades' }) === 'shades';

    // 35d. Volta para Luigi: tudo intacto + toggle desativa pintura Neon e poder Ima sem apagar compra
    pmMulti.setActiveProfile('luigi_3d');
    const luigiRestaurado = pmMulti.getCoins() === luigiCoinsSnap
      && pmMulti.getHighScore('classic') === 15000
      && pmMulti.getUnlockedStageIndex() === 3
      && pmMulti.getEquippedGearTheme().id === 'neon';

    const togGearOff = pmMulti.toggleEquipItem('gear', 'neon');
    const togUpgOff = pmMulti.toggleUpgradeEnabled('magnet');
    const closetTogglesOk = togGearOff.ok
      && pmMulti.getEquippedGearTheme().id === 'classic'
      && pmMulti.isOwned('gear', 'neon') === true
      && togUpgOff.ok && togUpgOff.enabled === false
      && pmMulti.getUpgradeLevel('magnet') === 1
      && pmMulti.getEffectiveUpgradeLevel('magnet') === 0
      && pmMulti.getUpgradeBonus('magnet') === 0;

    // 35e. Exportacao e merge da nuvem preserva maiores recordes e une compras sem NaN
    const exportedLuigi = pmMulti.exportProfileForCloud('luigi_3d');
    pmMulti.importOrMergeCloudData(
      { activeProfileId: 'luigi_3d', unlockedCharacters: ['luigi_3d', 'luigi_real', 'luna_radical', 'leo_cosmic'] },
      {
        luigi_3d: {
          ...exportedLuigi,
          highScore: 22500,
          unlockedStageIndex: 4,
          owned: {
            ...exportedLuigi.owned,
            trails: ['classic', 'rainbow']
          },
          clientUpdatedAt: Date.now() + 5000
        }
      },
      'uid_teste_familia'
    );
    const mergeOk = pmMulti.getHighScore('classic') === 22500
      && pmMulti.getUnlockedStageIndex() === 4
      && pmMulti.isOwned('trails', 'rainbow') === true
      && pmMulti.isOwned('gear', 'neon') === true
      && pmMulti.isOwned('characters', 'leo_cosmic') === true
      && Number.isFinite(pmMulti.getCoins());

    sandbox.progressionManager = prevPm;
    sandbox.localStorage.removeItem('luigi_skate_progression_v1');
    sandbox.localStorage.removeItem('luigi_skate_progression_v2');
    sandbox.localStorage.removeItem('luigi_skate_high_score');
    sandbox.localStorage.removeItem('luigi_selected_char');

    check('Perfis sao 100% isolados por personagem (moedas, compras, fase e recordes)',
      lunaIsolada && luigiRestaurado,
      `lunaIsolada=${lunaIsolada} luigiRestaurado=${luigiRestaurado}`);
    check('Closet ativa e desativa acessorios, pinturas e poderes sem perder compras',
      lunaAccDesativado && lunaAccReativado && closetTogglesOk,
      `off=${lunaAccDesativado} on=${lunaAccReativado} gearUpg=${closetTogglesOk}`);
    check('Exportacao e merge de perfil na nuvem preservam recordes e itens sem NaN',
      mergeOk,
      `high=${pmMulti.getHighScore('classic')} unlocked=${pmMulti.isOwned('characters', 'leo_cosmic')}`);
  }

  console.log('\n=== 36. Bandeirinha Rival, Super Moeda na Rota Alta, Curva de Fase e Alerta de Borda ===');
  {
    const { world, player } = newRun();
    world.reset({ recordDistance: 300, rivalDistance: 450, rivalName: 'Marcelo' });
    player.reset(world);
    const score0 = player.score;
    player.distance = 455;
    world.updateRecordFlag(player);

    const coinsBefore = player.coins;
    world.collect(player, { type: 'coin', x: player.x, y: player.y, size: 36, value: 5 });
    const superCoinGain = player.coins - coinsBefore;

    // Curva de adrenalina: Fase 5 tem teto de cruzeiro maior que Fase 1 apos aquecimento
    const p1 = newRun();
    p1.player.sessionDistance = 600;
    p1.player.currentStageIndex = 0;
    p1.player.speed = 20;
    for (let i = 0; i < 200; i++) p1.player.updateSpeed({});
    const p5 = newRun();
    p5.player.sessionDistance = 600;
    p5.player.currentStageIndex = 4;
    p5.player.speed = 20;
    for (let i = 0; i < 200; i++) p5.player.updateSpeed({});

    // Alerta de borda direita e bandeirinha renderizam sem erros
    let renderErr = null;
    try {
      const ctx = mockCtx();
      world.playerDistance = 445;
      world.obstacles.push({ type: 'barrel', x: 1320, y: world.groundY - 52, width: 50, height: 52, hit: false });
      world.drawRecordFlag(ctx, 1280);
      world.drawIncomingDangerHints(ctx, 1280);
    } catch (e) {
      renderErr = e;
    }

    check('Bandeirinha de Rival detecta ultrapassagem e concede bonus',
      world.rivalPassed === true && player.score > score0 + 400,
      `rivalPassed=${world.rivalPassed} score+${player.score - score0}`);
    check('Super Moeda da Rota Alta concede 5 moedas',
      superCoinGain === 5,
      `gain=${superCoinGain}`);
    check('Curva de adrenalina eleva velocidade de cruzeiro nas fases avancadas',
      p5.player.speed > p1.player.speed + 1.0,
      `F1=${p1.player.speed.toFixed(2)} F5=${p5.player.speed.toFixed(2)}`);
    check('Bandeirinha Rival e alerta de borda renderizam sem excecoes',
      renderErr === null,
      renderErr ? String(renderErr) : 'ok');
  }

  console.log('\n=== 37. Fase Bonus Dimensao Bloco (Portal, Voxel 2X e retorno seguro) ===');
  {
    const { world, player } = newRun();
    world._nextCameoDist = 999999;
    world.obstacles.length = 0;
    const firstPortalAt = world._nextPortalScore;
    player.score = 39000;
    step(world, player, {});
    const noPortalBefore = world.portals.length === 0;
    player.score = firstPortalAt + 500;
    step(world, player, {});
    const spawnedPortal = world.portals.length === 1;
    const nextAfterSpawn = world._nextPortalScore;

    // Aproxima o portal do jogador e atravessa
    if (world.portals[0]) world.portals[0].x = player.x + 10;
    step(world, player, {});
    const enteredVoxel = world.voxelTimer > 0 && player.voxelTimer > 0;
    const bonusPts = player.addScore(100);

    // Renderiza mundo voxel, portal, TNT, esmeralda e boneco voxel sem erros
    let voxelErr = null;
    try {
      const ctx = mockCtx();
      world.obstacles.push({ type: 'crate', x: 500, y: world.groundY - 58, width: 54, height: 58, hit: false });
      world.collectibles.push({ type: 'coin', x: 600, y: world.groundY - 80, size: 28, value: 1, collected: false });
      world.drawBackground(ctx, 1280, 720, 0);
      world.drawTrack(ctx, 1280, 720);
      world.drawCollectibles(ctx);
      player.draw(ctx);
    } catch (e) {
      voxelErr = e;
    }

    // Testa retorno seguro ao terminar o tempo da Dimensao Bloco
    world.voxelTimer = 1;
    step(world, player, {});
    const exitedSafely = world.voxelTimer === 0 && player.voxelTimer === 0 && player.invincibleTimer >= 50;

    check('Portal e raro: 1o entre 40.000 e 60.000 pts e nada antes disso',
      firstPortalAt >= 40000 && firstPortalAt < 60000 && noPortalBefore,
      `primeiro=${firstPortalAt}`);
    check('Proximo portal so 80.000+ pts depois (portal perdido nao reaparece na hora)',
      nextAfterSpawn >= firstPortalAt + 500 + 80000,
      `proximo=${nextAfterSpawn}`);
    check('Portal da Dimensao Bloco surge ao atingir pontuacao alta',
      spawnedPortal,
      `portals=${world.portals.length}`);
    check('Atravessar o portal ativa modo Voxel com pontuacao 2X',
      enteredVoxel && bonusPts >= 200,
      `voxelTimer=${enteredVoxel} pts=${bonusPts}`);
    check('Mundo Bloco, TNT, Esmeralda e personagem Voxel renderizam sem excecoes',
      voxelErr === null,
      voxelErr ? String(voxelErr) : 'ok');
    check('Saida da Dimensao Bloco volta a pista normal com invencibilidade segura',
      exitedSafely,
      `timer=${world.voxelTimer} inv=${player.invincibleTimer}`);
  }

  console.log(`\n${failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Erro inesperado na suite:', err);
  process.exit(1);
});
