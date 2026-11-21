const fs = require('fs');

global.window = {
  characterManager: {
    getSelected: () => ({ width: 100, height: 130, duckHeight: 85 })
  },
  soundSystem: {
    playJump: () => {},
    playRamp: () => {},
    playTrick: () => {},
    playPavementCrumble: () => {},
    playCoin: () => {},
    playPowerup: () => {},
    playHit: () => {},
    playLand: () => {},
    playPush: () => {},
    playBoardFlip: () => {},
    playStageClear: () => {},
    playRescue: () => {},
    playGameOver: () => {},
    stopMusic: () => {},
    updateRoll: () => {},
    updateGrind: () => {},
    updateRampRide: () => {},
    updateWind: () => {}
  },
  particleSystem: {
    emitWheelDust: () => {},
    emitSlideDust: () => {},
    emitPushDust: () => {},
    emitOlliePop: () => {},
    emitRampLaunch: () => {},
    emitSparks: () => {},
    emitGrindSparks: () => {},
    emitSparkle: () => {},
    emitRoadDebris: () => {},
    emitTurboTrail: () => {},
    emitLandingDust: () => {},
    emitShockwave: () => {},
    emitSpeedBurst: () => {},
    addFloatingText: () => {},
    update: () => {},
    draw: () => {}
  }
};
const dummyCtx = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop: () => {} });
    }
    if (prop === 'createImageData') {
      return (w, h) => ({ data: new Uint8ClampedArray((w || 100) * (h || 100) * 4) });
    }
    return () => {};
  }
});

global.document = {
  getElementById: () => ({ getContext: () => dummyCtx }),
  createElement: () => ({ getContext: () => dummyCtx })
};

eval(fs.readFileSync('js/game_physics.js', 'utf8'));
eval(fs.readFileSync('js/game_world.js', 'utf8'));

const GameWorld = window.GameWorld;
const Player = window.Player;
const world = new GameWorld();
const player = new Player();
player.reset(world);

console.log('Initial player y:', player.y, 'bottom:', player.bottom, 'onGround:', player.onGround);
console.log('Platforms count:', world.platforms.length, 'platform 0:', world.platforms[0]);

for (let frame = 1; frame <= 1500; frame++) {
  world.update(player);
  player.update(world, {});
  if (frame % 50 === 0 || player.isGameOver || !player.onGround) {
    console.log(`Frame ${frame}: dist=${player.distance.toFixed(0)}, y=${player.y.toFixed(1)}, bottom=${player.bottom.toFixed(1)}, vy=${player.vy.toFixed(2)}, onGround=${player.onGround}, gameOver=${player.isGameOver}, death=${player.deathReason}`);
  }
  if (player.isGameOver) break;
}
