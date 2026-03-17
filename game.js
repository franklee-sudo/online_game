"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const timerBox = document.getElementById("timerBox");
const killCountEl = document.getElementById("killCount");
const goldCountEl = document.getElementById("goldCount");
const shardCountEl = document.getElementById("shardCount");
const hpFill = document.getElementById("hpFill");
const hpText = document.getElementById("hpText");
const xpFill = document.getElementById("xpFill");
const xpText = document.getElementById("xpText");
const levelText = document.getElementById("levelText");
const weaponSlots = document.getElementById("weaponSlots");
const bossBarWrap = document.getElementById("bossBarWrap");
const bossBarFill = document.getElementById("bossBarFill");
const bossName = document.getElementById("bossName");

const menuScreen = document.getElementById("menuScreen");
const classScreen = document.getElementById("classScreen");
const upgradeScreen = document.getElementById("upgradeScreen");
const pauseScreen = document.getElementById("pauseScreen");
const resultScreen = document.getElementById("resultScreen");
const classGrid = document.getElementById("classGrid");
const upgradeChoices = document.getElementById("upgradeChoices");
const warningOverlay = document.getElementById("warningOverlay");
const frenzyBanner = document.getElementById("frenzyBanner");
const messageToast = document.getElementById("messageToast");
const resultTitle = document.getElementById("resultTitle");
const resultReason = document.getElementById("resultReason");
const resultStats = document.getElementById("resultStats");

const startBtn = document.getElementById("startBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const restartBtn = document.getElementById("restartBtn");
const backMenuResultBtn = document.getElementById("backMenuResultBtn");
const resumeBtn = document.getElementById("resumeBtn");
const pauseBackMenuBtn = document.getElementById("pauseBackMenuBtn");

const GAME_DURATION = 600; // 10 minutes
const BOSS_SPAWN_TIME = 300; // 5 minutes
const FRENZY_TIME = 285; // 4m45s
const WARNING_DURATION = 2.5;
const XP_NORMAL = 15;
const XP_ELITE = 45;
const XP_BOSS = 220;
const XP_GROWTH = 1.22;
const CHEST_MAX_ON_MAP = 2;
const CHEST_CHANCE_NORMAL = 0.018;
const CHEST_CHANCE_ELITE = 0.06;
const OMNI_SHOT_DURATION = 10;

const RADIUS = {
  player: 16,
  enemy: 14,
  elite: 18,
  crusher: 22,
  boss: 48,
};

const CLASS_LIST = [
  {
    id: "warrior",
    name: "战士",
    icon: "⚔️",
    color: "#ff7b7b",
    desc: "攻击力 +20%\n最大生命 +50",
    apply(player) {
      player.damageMultiplier *= 1.2;
      player.maxHp += 50;
      player.hp += 50;
    },
  },
  {
    id: "mage",
    name: "法师",
    icon: "🔮",
    color: "#64a6ff",
    desc: "技能冷却 -20%\n经验获取 +30%",
    apply(player) {
      player.cooldownMultiplier *= 0.8;
      player.xpMultiplier *= 1.3;
    },
  },
  {
    id: "ranger",
    name: "游侠",
    icon: "🏹",
    color: "#66ffad",
    desc: "移动速度 +30%\n暴击率 +10%",
    apply(player) {
      player.speed *= 1.3;
      player.critChance += 0.1;
    },
  },
];

const WEAPON_NAMES = {
  magic: "魔法弹",
  boomerang: "回旋镖",
  lightning: "闪电",
};

const game = {
  running: false,
  paused: false,
  state: "menu",
  selectedClass: null,
  time: 0,
  kills: 0,
  gold: 0,
  shards: 0,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  drops: [],
  floatingTexts: [],
  particles: [],
  lightningArcs: [],
  lightningFlash: 0,
  upgradesPending: 0,
  currentUpgradeChoices: [],
  spawnTimer: 0,
  spawnScale: 1,
  warningActive: false,
  warningTimer: 0,
  frenzyStarted: false,
  bossSpawned: false,
  bossDefeated: false,
  lightningThreatUnlocked: false,
  toastTimer: 0,
  player: null,
};

const keys = {};
let lastFrame = performance.now();

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function showScreen(target) {
  for (const screen of [menuScreen, classScreen, upgradeScreen, pauseScreen, resultScreen]) {
    screen.classList.remove("active");
  }
  if (target) {
    target.classList.add("active");
  }
}

function showToast(text, duration = 2) {
  messageToast.textContent = text;
  messageToast.classList.remove("hidden");
  game.toastTimer = duration;
}

function formatTime(seconds) {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function createClassSelection() {
  classGrid.innerHTML = "";
  CLASS_LIST.forEach((item) => {
    const card = document.createElement("div");
    card.className = "classOption";
    card.style.borderColor = item.color;
    card.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="name" style="color:${item.color}">${item.name}</div>
      <div class="desc">${item.desc.replaceAll("\n", "<br/>")}</div>
    `;
    card.addEventListener("click", () => {
      startGame(item);
    });
    classGrid.appendChild(card);
  });
}

function initPlayer() {
  return {
    x: 0,
    y: 0,
    speed: 220,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 90,
    attackSpeedBonus: 0,
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    xpMultiplier: 1,
    critChance: 0.05,
    critDamage: 1.7,
    regen: 0,
    pickupRange: 110,
    invuln: 0,
    hitBlink: 0,
    upgradeFlash: 0,
    omniShotTimer: 0,
    weapons: {
      magic: {
        id: "magic",
        level: 1,
        timer: 0,
      },
    },
  };
}

function resetGameState() {
  game.running = true;
  game.paused = false;
  game.state = "game";
  game.time = 0;
  game.kills = 0;
  game.gold = 0;
  game.shards = 0;
  game.enemies = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.drops = [];
  game.floatingTexts = [];
  game.particles = [];
  game.lightningArcs = [];
  game.lightningFlash = 0;
  game.upgradesPending = 0;
  game.currentUpgradeChoices = [];
  game.spawnTimer = 0;
  game.spawnScale = 1;
  game.warningActive = false;
  game.warningTimer = 0;
  game.frenzyStarted = false;
  game.bossSpawned = false;
  game.bossDefeated = false;
  game.lightningThreatUnlocked = false;
  warningOverlay.classList.add("hidden");
  frenzyBanner.classList.add("hidden");
  messageToast.classList.add("hidden");
  game.toastTimer = 0;
  bossBarWrap.classList.add("hidden");
  game.player = initPlayer();
}

function createLightningArc(x1, y1, x2, y2, config = {}) {
  const segments = config.segments || 8;
  const jitter = config.jitter || 20;
  const points = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseX = x1 + dx * t;
    const baseY = y1 + dy * t;
    const edgeFactor = Math.sin(Math.PI * t);
    const offset = (Math.random() * 2 - 1) * jitter * edgeFactor;
    points.push({
      x: baseX + nx * offset,
      y: baseY + ny * offset,
    });
  }

  game.lightningArcs.push({
    points,
    life: config.life || 0.16,
    maxLife: config.life || 0.16,
    width: config.width || 3.2,
    glow: config.glow || 16,
    color: config.color || "#8bf4ff",
  });
}

function startGame(classData) {
  game.selectedClass = classData.id;
  resetGameState();
  classData.apply(game.player);
  showScreen(null);
  hud.classList.remove("hidden");
  updateHud();
  showToast(`职业已选择：${classData.name}`);
}

function backToMenu() {
  game.running = false;
  game.state = "menu";
  hud.classList.add("hidden");
  bossBarWrap.classList.add("hidden");
  warningOverlay.classList.add("hidden");
  frenzyBanner.classList.add("hidden");
  messageToast.classList.add("hidden");
  showScreen(menuScreen);
}

function resumeGameFromPause() {
  if (game.state !== "paused") {
    return;
  }
  game.paused = false;
  game.state = "game";
  showScreen(null);
  showToast("继续游戏", 1.1);
}

function togglePause() {
  if (!game.running) {
    return;
  }
  if (game.state === "game" && !game.paused) {
    game.paused = true;
    game.state = "paused";
    showScreen(pauseScreen);
    return;
  }
  if (game.state === "paused") {
    resumeGameFromPause();
  }
}

function worldToScreen(x, y, camX, camY) {
  return {
    x: x - camX + window.innerWidth / 2,
    y: y - camY + window.innerHeight / 2,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawnEnemy(type = "normal") {
  const p = game.player;
  const angle = Math.random() * Math.PI * 2;
  const dist = 520 + Math.random() * 260;
  const x = p.x + Math.cos(angle) * dist;
  const y = p.y + Math.sin(angle) * dist;
  const tScale = 1 + game.time * 0.0018;

  if (type === "elite") {
    game.enemies.push({
      type: "elite",
      x,
      y,
      vx: 0,
      vy: 0,
      hp: Math.round(120 * tScale),
      maxHp: Math.round(120 * tScale),
      speed: 86 + game.time * 0.065,
      damage: 16 + Math.floor(game.time * 0.02),
      radius: RADIUS.elite,
      touchCd: 0,
    });
    return;
  }

  if (type === "crusher") {
    game.enemies.push({
      type: "crusher",
      x,
      y,
      vx: 0,
      vy: 0,
      hp: Math.round(250 * tScale),
      maxHp: Math.round(250 * tScale),
      speed: 92 + game.time * 0.05,
      damage: 24 + Math.floor(game.time * 0.028),
      radius: RADIUS.crusher,
      touchCd: 0,
      burstCd: 3.8 + Math.random() * 1.5,
      burstTimer: 0,
      burstVx: 0,
      burstVy: 0,
      isBursting: false,
    });
    return;
  }

  game.enemies.push({
    type: "normal",
    x,
    y,
    vx: 0,
    vy: 0,
    hp: Math.round(30 * tScale),
    maxHp: Math.round(30 * tScale),
    speed: 114 + game.time * 0.08,
    damage: 8 + Math.floor(game.time * 0.015),
    radius: RADIUS.enemy,
    touchCd: 0,
  });
}

function spawnBoss() {
  if (game.bossSpawned || game.bossDefeated) {
    return;
  }

  const p = game.player;
  const angle = Math.random() * Math.PI * 2;
  const dist = 700;
  game.enemies.push({
    type: "boss",
    name: "深渊统御者",
    x: p.x + Math.cos(angle) * dist,
    y: p.y + Math.sin(angle) * dist,
    vx: 0,
    vy: 0,
    hp: 2500,
    maxHp: 2500,
    speed: 100,
    damage: 30,
    radius: RADIUS.boss,
    touchCd: 0,
    chargeCd: 5.6,
    chargeTimer: 0,
    radialCd: 6.8,
    aimedCd: 4.4,
    spiralCd: 10.5,
    spiralActive: false,
    spiralTick: 0,
    spiralShotsLeft: 0,
    spiralAngle: Math.random() * Math.PI * 2,
    isCharging: false,
  });
  game.bossSpawned = true;
  showToast("Boss 已降临！");
}

function spawnBossBullet(enemy, angle, speed, radius, damage, life, color, kind = "orb") {
  game.enemyProjectiles.push({
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    life,
    damage,
    color,
    kind,
  });
}

function fireBossRadial(enemy) {
  const count = 20;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    spawnBossBullet(enemy, angle, 205, 11, 18, 5, "#ff9c9c", "radial");
  }
  addFloatingText("扩散弹幕!", enemy.x, enemy.y - 38, "#ff8585", 22);
}

function fireBossAimedSpread(enemy, player) {
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const count = 7;
  const spread = 0.19;
  const start = -((count - 1) / 2) * spread;
  for (let i = 0; i < count; i++) {
    const angle = base + start + i * spread;
    const speed = 232 + (i % 2) * 18;
    spawnBossBullet(enemy, angle, speed, 10, 16, 4.2, "#ffb8a1", "fan");
  }
  addFloatingText("扇形齐射!", enemy.x, enemy.y - 58, "#ffd2a6", 21);
}

function startBossSpiral(enemy) {
  enemy.spiralActive = true;
  enemy.spiralTick = 0.06;
  enemy.spiralShotsLeft = 16;
  enemy.spiralAngle = Math.random() * Math.PI * 2;
  addFloatingText("螺旋弹幕!", enemy.x, enemy.y - 78, "#ff9be2", 22);
}

function updateBossSpiral(enemy, dt) {
  if (!enemy.spiralActive) {
    return;
  }
  enemy.spiralTick -= dt;
  while (enemy.spiralTick <= 0 && enemy.spiralShotsLeft > 0) {
    const angle = enemy.spiralAngle;
    spawnBossBullet(enemy, angle, 220, 9, 14, 5.5, "#ff88cf", "spiral");
    spawnBossBullet(enemy, angle + Math.PI, 220, 9, 14, 5.5, "#ff88cf", "spiral");
    enemy.spiralAngle += 0.44;
    enemy.spiralShotsLeft -= 1;
    enemy.spiralTick += 0.13;
  }
  if (enemy.spiralShotsLeft <= 0) {
    enemy.spiralActive = false;
  }
}

function triggerBossWarning() {
  game.warningActive = true;
  game.warningTimer = WARNING_DURATION;
  warningOverlay.classList.remove("hidden");
}

function spawnDrops(enemy) {
  const commonXp =
    enemy.type === "boss"
      ? XP_BOSS
      : enemy.type === "crusher"
        ? 72
        : enemy.type === "elite"
          ? XP_ELITE
          : XP_NORMAL;
  game.drops.push({
    type: "xp",
    x: enemy.x + (Math.random() - 0.5) * 18,
    y: enemy.y + (Math.random() - 0.5) * 18,
    value: commonXp,
    radius: 7,
    attract: false,
  });

  if (Math.random() < (enemy.type === "boss" ? 1 : enemy.type === "crusher" ? 0.62 : 0.42)) {
    game.drops.push({
      type: "gold",
      x: enemy.x + (Math.random() - 0.5) * 24,
      y: enemy.y + (Math.random() - 0.5) * 24,
      value: enemy.type === "boss" ? 30 : enemy.type === "crusher" ? 8 : enemy.type === "elite" ? 5 : 2,
      radius: 8,
      attract: false,
    });
  }

  if (Math.random() < (enemy.type === "boss" ? 1 : 0.2)) {
    game.drops.push({
      type: "shard",
      x: enemy.x + (Math.random() - 0.5) * 18,
      y: enemy.y + (Math.random() - 0.5) * 18,
      value: enemy.type === "boss" ? 5 : 1,
      radius: 8,
      attract: false,
    });
  }
}

function activeChestCount() {
  let count = 0;
  for (const drop of game.drops) {
    if (drop.type === "chest" && !drop._collected) {
      count += 1;
    }
  }
  return count;
}

function maybeSpawnMagicChest(enemy, killType) {
  if (killType !== "magic") {
    return;
  }
  if (activeChestCount() >= CHEST_MAX_ON_MAP) {
    return;
  }

  const chance = enemy.type === "elite" ? CHEST_CHANCE_ELITE : CHEST_CHANCE_NORMAL;
  if (Math.random() > chance) {
    return;
  }

  game.drops.push({
    type: "chest",
    chestType: Math.random() < 0.72 ? "omni_shot" : "nuke",
    x: enemy.x + (Math.random() - 0.5) * 24,
    y: enemy.y + (Math.random() - 0.5) * 24,
    value: 1,
    radius: 13,
    attract: false,
  });
}

function addFloatingText(text, x, y, color = "#fff", size = 18) {
  game.floatingTexts.push({
    text,
    x,
    y,
    vy: -35,
    life: 0.8,
    maxLife: 0.8,
    color,
    size,
  });
}

function addHitParticles(x, y, color, count = 8, spread = 120) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * spread;
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function applyDamageToEnemy(enemy, amount, source = null, opts = {}) {
  const hitType = source?.type || opts.hitType || null;
  if (hitType) {
    enemy.lastHitType = hitType;
  }
  let damage = amount * game.player.damageMultiplier;
  let isCrit = false;
  if (Math.random() < game.player.critChance && !opts.noCrit) {
    damage *= game.player.critDamage;
    isCrit = true;
  }
  damage = Math.round(damage);
  enemy.hp -= damage;

  addFloatingText(
    `${damage}`,
    enemy.x,
    enemy.y - enemy.radius - 8,
    isCrit ? "#ffd66c" : "#d8ecff",
    isCrit ? 24 : 18,
  );
  addHitParticles(enemy.x, enemy.y, isCrit ? "#ffd25a" : "#75c0ff", isCrit ? 12 : 7, isCrit ? 200 : 120);

  if (source && source.splashRadius > 0) {
    applySplashDamage(enemy, source.splashRadius, damage * source.splashRatio, hitType);
  }

  if (enemy.hp <= 0) {
    handleEnemyDeath(enemy, enemy.lastHitType || hitType || "unknown");
    return true;
  }
  return false;
}

function applySplashDamage(centerEnemy, radius, damage, sourceType = "magic") {
  if (damage <= 0) {
    return;
  }
  addHitParticles(centerEnemy.x, centerEnemy.y, "#5df4ff", 14, 180);
  for (const enemy of game.enemies) {
    if (enemy === centerEnemy || enemy.hp <= 0) {
      continue;
    }
    const d = Math.hypot(enemy.x - centerEnemy.x, enemy.y - centerEnemy.y);
    if (d <= radius) {
      enemy.hp -= Math.round(damage);
      addFloatingText(`${Math.round(damage)}`, enemy.x, enemy.y - enemy.radius, "#87f5ff", 16);
      enemy.lastHitType = sourceType;
      if (enemy.hp <= 0) {
        handleEnemyDeath(enemy, sourceType);
      }
    }
  }
}

function handleEnemyDeath(enemy, killType = "unknown") {
  if (enemy._dead) {
    return;
  }
  enemy._dead = true;
  game.kills += 1;

  if (enemy.type === "boss") {
    game.bossDefeated = true;
    bossBarWrap.classList.add("hidden");
    showToast("Boss 已击败！奖励掉落");
    for (let i = 0; i < 10; i++) {
      game.drops.push({
        type: i % 3 === 0 ? "gold" : "xp",
        x: enemy.x + (Math.random() - 0.5) * 120,
        y: enemy.y + (Math.random() - 0.5) * 120,
        value: i % 3 === 0 ? 10 : 40,
        radius: 8,
        attract: false,
      });
    }
  } else {
    spawnDrops(enemy);
    maybeSpawnMagicChest(enemy, killType);
  }

  addHitParticles(enemy.x, enemy.y, enemy.type === "boss" ? "#ff5d5d" : "#9ad7ff", enemy.type === "boss" ? 28 : 10, 260);
  game.enemies = game.enemies.filter((e) => e !== enemy);
}

function nearestEnemy(fromX, fromY) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const d = Math.hypot(enemy.x - fromX, enemy.y - fromY);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

function nearestEnemyInRange(fromX, fromY, range, exclude = null) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    if (exclude && exclude.has(enemy)) continue;
    const d = Math.hypot(enemy.x - fromX, enemy.y - fromY);
    if (d < bestDist && d <= range) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

function nearestEnemies(fromX, fromY, count) {
  const candidates = [];
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    candidates.push({ enemy, d: Math.hypot(enemy.x - fromX, enemy.y - fromY) });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, count).map((item) => item.enemy);
}

function getWeaponStats(id, level) {
  if (id === "magic") {
    const stats = {
      cooldown: 0.8,
      damage: 20,
      speed: 560,
      count: 1,
      spread: 0,
      pierce: 0,
      splashRadius: 0,
      splashRatio: 0,
      color: "#7fd3ff",
      radius: 5,
      life: 1.4,
    };
    if (level >= 2) stats.damage += 8;
    if (level >= 3) {
      stats.count = 3;
      stats.spread = 0.35;
    }
    if (level >= 4) stats.cooldown *= 0.8;
    if (level >= 5) {
      stats.splashRadius = 80;
      stats.splashRatio = 0.4;
    }
    if (level >= 6) {
      stats.count = 5;
      stats.spread = 0.56;
    }
    if (level >= 7) {
      stats.pierce += 1;
      stats.damage += 15;
    }
    return stats;
  }

  if (id === "boomerang") {
    const stats = {
      cooldown: 2.1,
      damage: 25,
      speed: 290,
      count: 1,
      spread: 0,
      pierce: 99,
      splashRadius: level >= 4 ? 65 : 0,
      splashRatio: level >= 4 ? 0.3 : 0,
      color: "#e99644",
      radius: 8,
      life: 2.1,
      boomerang: true,
    };
    if (level >= 2) stats.cooldown *= 0.85;
    if (level >= 3) stats.count = 2;
    if (level >= 5) stats.count = 3;
    if (level >= 6) stats.damage += 16;
    return stats;
  }

  if (id === "lightning") {
    const stats = {
      cooldown: 2.6,
      damage: 40,
      beams: 1,
      chains: 1,
      range: 320,
      color: "#8bf4ff",
    };
    if (level >= 2) stats.cooldown *= 0.84;
    if (level >= 3) {
      stats.beams = 2;
      stats.chains = 2;
    }
    if (level >= 4) stats.damage += 15;
    if (level >= 5) {
      stats.beams = 3;
      stats.chains = 3;
    }
    if (level >= 6) stats.cooldown *= 0.88;
    return stats;
  }

  return null;
}

function fireWeapon(weapon) {
  const p = game.player;
  const target = nearestEnemy(p.x, p.y);

  if (weapon.id === "lightning") {
    const stats = getWeaponStats(weapon.id, weapon.level);
    const starters = nearestEnemies(p.x, p.y, stats.beams);
    if (starters.length === 0) {
      return;
    }
    const globalHitSet = new Set();
    for (const start of starters) {
      let current = start;
      let hitCount = 0;
      let from = { x: p.x, y: p.y };
      while (current && hitCount <= stats.chains) {
        if (globalHitSet.has(current)) {
          current = nearestEnemyInRange(from.x, from.y, stats.range, globalHitSet);
          if (!current) {
            break;
          }
        }
        createLightningArc(from.x, from.y, current.x, current.y, {
          segments: 8 + stats.chains,
          jitter: 18 + stats.chains * 4,
          life: 0.18,
          width: 4.2,
          glow: 24,
          color: "#89f6ff",
        });
        createLightningArc(from.x, from.y, current.x, current.y, {
          segments: 10 + stats.chains,
          jitter: 10 + stats.chains * 2,
          life: 0.12,
          width: 2.2,
          glow: 10,
          color: "#c8feff",
        });

        globalHitSet.add(current);
        applyDamageToEnemy(current, stats.damage, null, { noCrit: false, hitType: "lightning" });
        addHitParticles(current.x, current.y, stats.color, 24, 220);
        addFloatingText("⚡", current.x, current.y - 18, "#b7f4ff", 26);
        game.lightningFlash = Math.max(game.lightningFlash, 0.1);

        from = { x: current.x, y: current.y };
        current = nearestEnemyInRange(current.x, current.y, stats.range, globalHitSet);
        hitCount += 1;
      }
    }
    return;
  }

  const stats = getWeaponStats(weapon.id, weapon.level);
  if (weapon.id === "magic" && p.omniShotTimer > 0) {
    const omniCount = 10;
    const baseAngle = game.time * 2.4;
    for (let i = 0; i < omniCount; i++) {
      const angle = baseAngle + (Math.PI * 2 * i) / omniCount;
      game.projectiles.push({
        type: weapon.id,
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * stats.speed,
        vy: Math.sin(angle) * stats.speed,
        life: Math.max(0.9, stats.life * 0.9),
        damage: Math.round(stats.damage * 0.72),
        radius: stats.radius,
        pierce: Math.max(0, stats.pierce),
        splashRadius: stats.splashRadius,
        splashRatio: stats.splashRatio,
        color: "#9de8ff",
        boomerang: false,
        initialLife: stats.life,
        hitSet: new Set(),
      });
    }
    addHitParticles(p.x, p.y, "#8de9ff", 8, 120);
    return;
  }

  const baseAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.random() * Math.PI * 2;
  const count = stats.count;
  const offsetStart = -((count - 1) / 2);

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + offsetStart * stats.spread + i * stats.spread;
    game.projectiles.push({
      type: weapon.id,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * stats.speed,
      vy: Math.sin(angle) * stats.speed,
      life: stats.life,
      damage: stats.damage,
      radius: stats.radius,
      pierce: stats.pierce,
      splashRadius: stats.splashRadius,
      splashRatio: stats.splashRatio,
      color: stats.color,
      boomerang: Boolean(stats.boomerang),
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: stats.boomerang ? (Math.random() < 0.5 ? -1 : 1) * (8.5 + Math.random() * 3) : 0,
      initialLife: stats.life,
      hitSet: new Set(),
    });
  }
}

function updateWeapons(dt) {
  const p = game.player;
  for (const weapon of Object.values(p.weapons)) {
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      fireWeapon(weapon);
      const stats = getWeaponStats(weapon.id, weapon.level);
      const cooldown = Math.max(0.08, stats.cooldown * p.cooldownMultiplier / (1 + p.attackSpeedBonus));
      weapon.timer = cooldown;
    }
  }
}

function updatePlayer(dt) {
  const p = game.player;
  let dx = 0;
  let dy = 0;
  if (keys.KeyW || keys.ArrowUp) dy -= 1;
  if (keys.KeyS || keys.ArrowDown) dy += 1;
  if (keys.KeyA || keys.ArrowLeft) dx -= 1;
  if (keys.KeyD || keys.ArrowRight) dx += 1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  p.x += dx * p.speed * dt;
  p.y += dy * p.speed * dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hitBlink = Math.max(0, p.hitBlink - dt);
  p.upgradeFlash = Math.max(0, p.upgradeFlash - dt);
  p.omniShotTimer = Math.max(0, p.omniShotTimer - dt);

  if (p.regen > 0) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  }
}

function updateEnemySpawning(dt) {
  const dangerScale = 1 + Math.floor(game.time / 20) * 0.1;
  const baseRate = 0.84 / (dangerScale * game.spawnScale);
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    const lightningOn = hasWeapon("lightning");
    if (lightningOn && !game.lightningThreatUnlocked) {
      game.lightningThreatUnlocked = true;
      showToast("警告：高压怪出现（稀有精英）", 2.2);
    }

    const eliteChance = Math.min(0.28, 0.05 + game.time / 260);
    spawnEnemy(Math.random() < eliteChance ? "elite" : "normal");

    if (lightningOn) {
      const crusherCount = game.enemies.filter((e) => e.type === "crusher").length;
      const crusherChance = Math.min(0.12, 0.045 + game.time / 2000);
      if (crusherCount < 3 && Math.random() < crusherChance) {
        spawnEnemy("crusher");
      }
    }

    if (Math.random() < Math.min(0.34, 0.12 + game.time / 1100)) {
      spawnEnemy("normal");
    }
    if (game.time < 40 && Math.random() < 0.26) {
      spawnEnemy("normal");
    }
    if (game.time > 240 && Math.random() < 0.08) {
      spawnEnemy("normal");
    }
    game.spawnTimer = Math.max(0.11, baseRate);
  }
}

function updateEnemies(dt) {
  const p = game.player;
  for (const enemy of game.enemies) {
    if (enemy._dead) continue;
    enemy.touchCd = Math.max(0, enemy.touchCd - dt);

    if (enemy.type === "boss") {
      bossBarWrap.classList.remove("hidden");
      bossName.textContent = enemy.name;
      bossBarFill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;

      enemy.chargeCd -= dt;
      enemy.radialCd -= dt;
      enemy.aimedCd -= dt;
      enemy.spiralCd -= dt;
      if (enemy.chargeCd <= 0 && !enemy.isCharging) {
        enemy.isCharging = true;
        enemy.chargeTimer = 0.86;
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.vx = Math.cos(angle) * 390;
        enemy.vy = Math.sin(angle) * 390;
        enemy.chargeCd = 5.8;
        addFloatingText("冲锋！", enemy.x, enemy.y - 60, "#ffad6d", 24);
      }
      if (enemy.radialCd <= 0) {
        fireBossRadial(enemy);
        enemy.radialCd = 7.1;
      }
      if (enemy.aimedCd <= 0) {
        fireBossAimedSpread(enemy, p);
        enemy.aimedCd = 4.6;
      }
      if (enemy.spiralCd <= 0 && !enemy.spiralActive) {
        startBossSpiral(enemy);
        enemy.spiralCd = 11.2;
      }
      updateBossSpiral(enemy, dt);

      if (enemy.isCharging) {
        enemy.chargeTimer -= dt;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        if (enemy.chargeTimer <= 0) {
          enemy.isCharging = false;
        }
      } else {
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      }
    } else if (enemy.type === "crusher") {
      enemy.burstCd -= dt;
      if (enemy.burstCd <= 0 && !enemy.isBursting) {
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.isBursting = true;
        enemy.burstTimer = 0.56;
        enemy.burstVx = Math.cos(angle) * 340;
        enemy.burstVy = Math.sin(angle) * 340;
        enemy.burstCd = 3.6 + Math.random() * 1.4;
        addFloatingText("突进!", enemy.x, enemy.y - 28, "#ffb37a", 20);
      }

      if (enemy.isBursting) {
        enemy.burstTimer -= dt;
        enemy.x += enemy.burstVx * dt;
        enemy.y += enemy.burstVy * dt;
        if (enemy.burstTimer <= 0) {
          enemy.isBursting = false;
        }
      } else {
        const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      }
    } else {
      const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
    }

    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < enemy.radius + RADIUS.player && enemy.touchCd <= 0) {
      if (p.invuln <= 0) {
        p.hp -= enemy.damage;
        p.invuln = 0.4;
        p.hitBlink = 0.15;
        addFloatingText(`-${enemy.damage}`, p.x, p.y - 30, "#ff9a9a", 22);
        addHitParticles(p.x, p.y, "#ff8a8a", 10, 160);
      }
      enemy.touchCd = 0.55;
    }
  }
}

function updateProjectiles(dt) {
  for (const p of game.projectiles) {
    p.life -= dt;
    if (p.boomerang) {
      p.rotation += p.spinSpeed * dt;
    }

    if (p.boomerang && p.life < p.initialLife * 0.5) {
      const angle = Math.atan2(game.player.y - p.y, game.player.x - p.x);
      const speed = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    for (const enemy of game.enemies) {
      if (enemy._dead || p.hitSet.has(enemy)) continue;
      const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (d <= enemy.radius + p.radius) {
        p.hitSet.add(enemy);
        applyDamageToEnemy(enemy, p.damage, p);
        p.pierce -= 1;
        if (p.pierce < 0) {
          p.life = 0;
          break;
        }
      }
    }
  }

  game.projectiles = game.projectiles.filter((p) => p.life > 0);
}

function updateEnemyProjectiles(dt) {
  const p = game.player;
  for (const bullet of game.enemyProjectiles) {
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (Math.hypot(bullet.x - p.x, bullet.y - p.y) <= bullet.radius + RADIUS.player) {
      if (p.invuln <= 0) {
        p.hp -= bullet.damage;
        p.invuln = 0.25;
        p.hitBlink = 0.14;
        addFloatingText(`-${bullet.damage}`, p.x, p.y - 25, "#ff9090", 20);
      }
      bullet.life = 0;
    }
  }
  game.enemyProjectiles = game.enemyProjectiles.filter((b) => b.life > 0);
}

function gainXp(rawAmount) {
  const p = game.player;
  let amount = Math.round(rawAmount * p.xpMultiplier);
  p.xp += amount;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = Math.round(p.xpToNext * XP_GROWTH);
    game.upgradesPending += 1;
  }
}

function activateOmniShotBuff() {
  const p = game.player;
  p.omniShotTimer = Math.max(p.omniShotTimer, OMNI_SHOT_DURATION);
  showToast("宝箱效果：法球风暴 10秒（10方向发射）", 2.2);
  addHitParticles(p.x, p.y, "#9de8ff", 20, 220);
  addFloatingText("法球风暴!", p.x, p.y - 46, "#9de8ff", 26);
}

function triggerNukeChest() {
  let cleared = 0;
  const enemiesSnapshot = [...game.enemies];
  for (const enemy of enemiesSnapshot) {
    if (enemy.type === "boss") {
      const bossDamage = Math.round(enemy.maxHp * 0.12);
      enemy.hp -= bossDamage;
      addFloatingText(`-${bossDamage}`, enemy.x, enemy.y - enemy.radius - 10, "#ffbf7d", 22);
      addHitParticles(enemy.x, enemy.y, "#ff9c6a", 22, 240);
      if (enemy.hp <= 0) {
        handleEnemyDeath(enemy, "nuke");
      }
      continue;
    }
    handleEnemyDeath(enemy, "nuke");
    cleared += 1;
  }
  game.enemyProjectiles = [];
  addHitParticles(game.player.x, game.player.y, "#ffd08a", 26, 280);
  showToast(`宝箱效果：清屏！清除 ${cleared} 个敌人`, 2);
}

function collectDrop(drop) {
  if (drop.type === "xp") {
    gainXp(drop.value);
  } else if (drop.type === "gold") {
    game.gold += drop.value;
  } else if (drop.type === "chest") {
    if (drop.chestType === "nuke") {
      triggerNukeChest();
    } else {
      activateOmniShotBuff();
    }
  } else {
    game.shards += drop.value;
    gainXp(drop.value * 10);
  }
}

function updateDrops(dt) {
  const p = game.player;
  for (const drop of game.drops) {
    const d = Math.hypot(drop.x - p.x, drop.y - p.y);
    if (d < p.pickupRange) {
      drop.attract = true;
    }
    if (drop.attract) {
      const speed = 220 + Math.max(0, (p.pickupRange - d) * 1.7);
      const angle = Math.atan2(p.y - drop.y, p.x - drop.x);
      drop.x += Math.cos(angle) * speed * dt;
      drop.y += Math.sin(angle) * speed * dt;
    }

    if (d <= drop.radius + RADIUS.player) {
      collectDrop(drop);
      drop._collected = true;
      addHitParticles(
        drop.x,
        drop.y,
        drop.type === "gold" ? "#ffe566" : drop.type === "xp" ? "#72cdff" : drop.type === "chest" ? "#ffc97a" : "#86ffff",
        drop.type === "chest" ? 14 : 7,
        drop.type === "chest" ? 140 : 80,
      );
    }
  }
  game.drops = game.drops.filter((d) => !d._collected);
}

function updateFloatingTexts(dt) {
  for (const t of game.floatingTexts) {
    t.life -= dt;
    t.y += t.vy * dt;
  }
  game.floatingTexts = game.floatingTexts.filter((t) => t.life > 0);
}

function updateParticles(dt) {
  for (const p of game.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

function updateLightningArcs(dt) {
  for (const arc of game.lightningArcs) {
    arc.life -= dt;
  }
  game.lightningArcs = game.lightningArcs.filter((arc) => arc.life > 0);
  game.lightningFlash = Math.max(0, game.lightningFlash - dt);
}

function triggerUpgrade() {
  if (game.upgradesPending <= 0 || game.state !== "game") {
    return;
  }
  game.paused = true;
  game.state = "upgrade";
  game.upgradesPending -= 1;
  game.currentUpgradeChoices = buildUpgradeChoices(3);
  renderUpgradeChoices();
  showScreen(upgradeScreen);
}

function hasWeapon(id) {
  return Boolean(game.player.weapons[id]);
}

function weaponLevel(id) {
  return hasWeapon(id) ? game.player.weapons[id].level : 0;
}

function buildUpgradePool() {
  const pool = [];
  const p = game.player;

  const push = (id, title, desc, apply, weight = 1) => {
    pool.push({ id, title, desc, apply, weight });
  };

  if (weaponLevel("magic") < 7) {
    push(
      "magic_up",
      `升级：魔法弹 Lv.${weaponLevel("magic")} -> Lv.${weaponLevel("magic") + 1}`,
      "强化弹道，后续可进化三发、多发与溅射",
      () => {
        p.weapons.magic.level += 1;
      },
      1.5,
    );
  }
  if (!hasWeapon("boomerang")) {
    push("unlock_boom", "新武器：回旋镖", "发射回旋镖切割路径上的敌人", () => {
      p.weapons.boomerang = { id: "boomerang", level: 1, timer: 0.4 };
    }, 1.2);
  } else if (weaponLevel("boomerang") < 6) {
    push(
      "boom_up",
      `升级：回旋镖 Lv.${weaponLevel("boomerang")} -> Lv.${weaponLevel("boomerang") + 1}`,
      "增加回旋镖数量、伤害与范围效果",
      () => {
        p.weapons.boomerang.level += 1;
      },
    );
  }

  if (!hasWeapon("lightning")) {
    push("unlock_light", "新武器：闪电", "瞬发连锁电击，可同时打击多个目标", () => {
      p.weapons.lightning = { id: "lightning", level: 1, timer: 0.1 };
    }, 1.2);
  } else if (weaponLevel("lightning") < 6) {
    push(
      "light_up",
      `升级：闪电 Lv.${weaponLevel("lightning")} -> Lv.${weaponLevel("lightning") + 1}`,
      "缩短冷却、提升伤害与连锁数，并提升主电弧数量（最高3道）",
      () => {
        p.weapons.lightning.level += 1;
      },
    );
  }

  push("hp_up", "体魄强化", "最大生命 +25，并立即回复 30 生命", () => {
    p.maxHp += 25;
    p.hp = Math.min(p.maxHp, p.hp + 30);
  });
  push("regen_up", "生命恢复", "每秒生命恢复 +1.2", () => {
    p.regen += 1.2;
  });
  push("speed_up", "步伐强化", "移动速度 +24", () => {
    p.speed += 24;
  });
  push("pickup_up", "磁吸强化", "拾取范围 +26", () => {
    p.pickupRange += 26;
  });
  push("atk_speed_up", "攻速强化", "攻击速度 +12%", () => {
    p.attackSpeedBonus += 0.12;
  });
  push("crit_up", "暴击强化", "暴击率 +8%，暴伤 +0.15", () => {
    p.critChance += 0.08;
    p.critDamage += 0.15;
  });

  return pool;
}

function weightedPick(pool) {
  const total = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight || 1;
    if (r <= 0) {
      return item;
    }
  }
  return pool[pool.length - 1];
}

function buildUpgradeChoices(count) {
  const pool = buildUpgradePool();
  const chosen = [];
  const used = new Set();

  while (chosen.length < count && pool.length > 0) {
    const candidate = weightedPick(pool);
    if (!used.has(candidate.id)) {
      chosen.push(candidate);
      used.add(candidate.id);
    }
    const idx = pool.findIndex((x) => x.id === candidate.id);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return chosen;
}

function renderUpgradeChoices() {
  upgradeChoices.innerHTML = "";
  game.currentUpgradeChoices.forEach((choice, idx) => {
    const card = document.createElement("div");
    card.className = "upgradeOption";
    card.innerHTML = `
      <div class="title">${choice.title}</div>
      <div class="desc">${choice.desc}</div>
      <div class="key">按 ${idx + 1}</div>
    `;
    card.addEventListener("click", () => chooseUpgrade(idx));
    upgradeChoices.appendChild(card);
  });
}

function chooseUpgrade(index) {
  if (game.state !== "upgrade") return;
  const choice = game.currentUpgradeChoices[index];
  if (!choice) return;
  choice.apply();
  game.player.upgradeFlash = 0.6;
  showToast(`强化成功：${choice.title}`, 1.8);

  game.state = "game";
  game.paused = false;
  showScreen(null);

  if (game.upgradesPending > 0) {
    setTimeout(triggerUpgrade, 0);
  }
}

function checkMilestones() {
  if (!game.frenzyStarted && game.time >= FRENZY_TIME) {
    game.frenzyStarted = true;
    game.spawnScale = 2.2;
    frenzyBanner.classList.remove("hidden");
    showToast("怪物狂潮！生成速度 x2.2", 2.2);
  }
  if (game.frenzyStarted && game.time >= BOSS_SPAWN_TIME) {
    game.spawnScale = 1.1;
    frenzyBanner.classList.add("hidden");
  }

  if (!game.warningActive && !game.bossSpawned && game.time >= BOSS_SPAWN_TIME) {
    triggerBossWarning();
  }

  if (game.warningActive) {
    game.warningTimer -= game.delta;
    if (game.warningTimer <= 0) {
      game.warningActive = false;
      warningOverlay.classList.add("hidden");
      spawnBoss();
    }
  }
}

function evaluateEndCondition() {
  if (game.player.hp <= 0) {
    finishGame(false, "生命值归零");
    return;
  }

  if (game.time >= GAME_DURATION) {
    if (game.bossDefeated) {
      finishGame(true, "坚持 10 分钟并击败 Boss，挑战成功！");
    } else {
      finishGame(false, "时间到，但 Boss 未被击败");
    }
  }
}

function finishGame(isWin, reason) {
  game.running = false;
  game.paused = true;
  game.state = "result";
  hud.classList.add("hidden");
  bossBarWrap.classList.add("hidden");
  warningOverlay.classList.add("hidden");
  frenzyBanner.classList.add("hidden");
  messageToast.classList.add("hidden");

  resultTitle.textContent = isWin ? "挑战胜利" : "游戏结束";
  resultReason.textContent = reason;
  resultStats.innerHTML = `
    <div>职业：${CLASS_LIST.find((c) => c.id === game.selectedClass)?.name || "-"}</div>
    <div>生存时间：${formatTime(game.time)}</div>
    <div>击杀数：${game.kills}</div>
    <div>等级：${game.player.level}</div>
    <div>金币：${game.gold}</div>
    <div>精华：${game.shards}</div>
    <div>Boss击败：${game.bossDefeated ? "是" : "否"}</div>
  `;
  showScreen(resultScreen);
}

function updateHud() {
  if (!game.player) return;
  const p = game.player;
  timerBox.textContent =
    p.omniShotTimer > 0 ? `${formatTime(game.time)} | 法球风暴 ${p.omniShotTimer.toFixed(1)}s` : formatTime(game.time);
  killCountEl.textContent = `${game.kills}`;
  goldCountEl.textContent = `${game.gold}`;
  shardCountEl.textContent = `${game.shards}`;
  levelText.textContent = `${p.level}`;
  hpFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  hpText.textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;
  xpFill.style.width = `${Math.min(100, (p.xp / p.xpToNext) * 100)}%`;
  xpText.textContent = `${Math.round(p.xp)} / ${p.xpToNext}`;

  const entries = Object.values(p.weapons);
  weaponSlots.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "weaponSlot";
    if (entries[i]) {
      const w = entries[i];
      slot.innerHTML = `<strong>${WEAPON_NAMES[w.id] || w.id}</strong><br/>Lv.${w.level}`;
    } else {
      slot.innerHTML = `<span style="opacity:.48">空槽 ${i + 1}</span>`;
    }
    weaponSlots.appendChild(slot);
  }
}

function drawBackground(camX, camY) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const grid = 64;
  const offX = -((camX % grid) + grid) % grid;
  const offY = -((camY % grid) + grid) % grid;

  ctx.save();
  ctx.fillStyle = "#0a1133";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.strokeStyle = "rgba(130, 175, 255, 0.09)";
  ctx.lineWidth = 1;
  for (let x = offX; x < window.innerWidth; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, window.innerHeight);
    ctx.stroke();
  }
  for (let y = offY; y < window.innerHeight; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(window.innerWidth, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(145, 194, 255, 0.18)";
  ctx.lineWidth = 2;
  const origin = worldToScreen(0, 0, camX, camY);
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, window.innerHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(window.innerWidth, origin.y);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(camX, camY) {
  const p = game.player;
  const s = worldToScreen(p.x, p.y, camX, camY);
  ctx.save();

  if (p.upgradeFlash > 0) {
    const alpha = p.upgradeFlash / 0.6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 28 + alpha * 20, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,230,110,${0.65 * alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  if (p.omniShotTimer > 0) {
    const alpha = 0.3 + Math.min(0.4, p.omniShotTimer / OMNI_SHOT_DURATION);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 42, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(133,239,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.translate(s.x, s.y);
  ctx.fillStyle = p.hitBlink > 0 ? "#ff7f7f" : "#6f85ff";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(16, 16);
  ctx.lineTo(-16, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#dce8ff";
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#13224f";
  ctx.beginPath();
  ctx.arc(-3, -5, 1.2, 0, Math.PI * 2);
  ctx.arc(3, -5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemies(camX, camY) {
  for (const enemy of game.enemies) {
    const s = worldToScreen(enemy.x, enemy.y, camX, camY);
    if (enemy.type === "boss") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 92, 92, 0.55)";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#8f1c1c";
      ctx.fill();
      ctx.fillStyle = "#ffd0d0";
      ctx.beginPath();
      ctx.arc(s.x - 12, s.y - 8, 6, 0, Math.PI * 2);
      ctx.arc(s.x + 12, s.y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (enemy.type === "crusher") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 95, 85, 0.24)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#a7392b";
      ctx.fill();

      ctx.fillStyle = "#ffd5ab";
      ctx.beginPath();
      ctx.arc(s.x - 6, s.y - 4, 3.3, 0, Math.PI * 2);
      ctx.arc(s.x + 6, s.y - 4, 3.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#520c0c";
      ctx.beginPath();
      ctx.arc(s.x - 6, s.y - 4, 1.4, 0, Math.PI * 2);
      ctx.arc(s.x + 6, s.y - 4, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.type === "elite" ? "#d87f2d" : "#6ba746";
      ctx.fill();
      ctx.fillStyle = "#ffe4bb";
      ctx.beginPath();
      ctx.arc(s.x, s.y - enemy.radius * 0.15, enemy.radius * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    const barW = enemy.type === "boss" ? 110 : 44;
    const barH = enemy.type === "boss" ? 10 : 6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(s.x - barW / 2, s.y - enemy.radius - 16, barW, barH);
    ctx.fillStyle = enemy.type === "boss" ? "#ff6969" : "#63ff60";
    ctx.fillRect(s.x - barW / 2, s.y - enemy.radius - 16, barW * hpRatio, barH);
  }
}

function drawBoomerangProjectile(screenPos, projectile) {
  const velAngle = Math.atan2(projectile.vy, projectile.vx);
  const spinAngle = projectile.rotation || 0;
  const angle = velAngle + spinAngle;

  const speed = Math.hypot(projectile.vx, projectile.vy);
  const trailLen = Math.min(28, 10 + speed * 0.03);
  const tx = Math.cos(velAngle) * trailLen;
  const ty = Math.sin(velAngle) * trailLen;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 188, 114, 0.42)";
  ctx.beginPath();
  ctx.moveTo(screenPos.x - tx, screenPos.y - ty);
  ctx.lineTo(screenPos.x, screenPos.y);
  ctx.stroke();

  ctx.translate(screenPos.x, screenPos.y);
  ctx.rotate(angle);
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(255, 160, 90, 0.72)";

  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.rotate(sign * 0.76);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(9, -9, 22, -2);
    ctx.quadraticCurveTo(16, 3, 2, 4);
    ctx.quadraticCurveTo(0, 2, 0, -3);
    ctx.closePath();
    ctx.fillStyle = "#c86f24";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(2, -1.5);
    ctx.quadraticCurveTo(10, -5.5, 18, -1.5);
    ctx.quadraticCurveTo(12, 1, 3, 1.5);
    ctx.closePath();
    ctx.fillStyle = "#ffbf7a";
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe8b8";
  ctx.fill();
  ctx.restore();
}

function drawProjectiles(camX, camY) {
  for (const p of game.projectiles) {
    const s = worldToScreen(p.x, p.y, camX, camY);

    if (p.boomerang) {
      drawBoomerangProjectile(s, p);
      if (p.splashRadius > 0) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 187, 96, 0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      continue;
    }

    ctx.beginPath();
    ctx.arc(s.x, s.y, p.radius + (p.splashRadius > 0 ? 1.4 : 0), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    if (p.splashRadius > 0) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(112, 255, 255, 0.65)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  for (const bullet of game.enemyProjectiles) {
    const s = worldToScreen(bullet.x, bullet.y, camX, camY);
    const glowColor =
      bullet.kind === "spiral" ? "rgba(255, 121, 220, 0.95)" : bullet.kind === "fan" ? "rgba(255, 184, 124, 0.95)" : "rgba(255, 128, 128, 0.95)";
    const ringColor =
      bullet.kind === "spiral" ? "rgba(255, 180, 242, 0.82)" : bullet.kind === "fan" ? "rgba(255, 226, 166, 0.82)" : "rgba(255, 210, 210, 0.82)";
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;
    ctx.beginPath();
    ctx.arc(s.x, s.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = bullet.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(s.x, s.y, bullet.radius + 2.4, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightningArcs(camX, camY) {
  if (game.lightningArcs.length === 0) {
    return;
  }

  ctx.save();
  for (const arc of game.lightningArcs) {
    const alpha = Math.max(0, arc.life / arc.maxLife);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = arc.color;
    ctx.lineWidth = arc.width;
    ctx.shadowBlur = arc.glow;
    ctx.shadowColor = arc.color;
    ctx.beginPath();
    arc.points.forEach((point, idx) => {
      const s = worldToScreen(point.x, point.y, camX, camY);
      if (idx === 0) {
        ctx.moveTo(s.x, s.y);
      } else {
        ctx.lineTo(s.x, s.y);
      }
    });
    ctx.stroke();
  }
  ctx.restore();
}

function drawDrops(camX, camY) {
  for (const d of game.drops) {
    const s = worldToScreen(d.x, d.y, camX, camY);
    if (d.type === "chest") {
      ctx.save();
      ctx.fillStyle = d.chestType === "nuke" ? "#ff9267" : "#f6c76f";
      ctx.strokeStyle = "#6c441a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(s.x - 10, s.y - 8, 20, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2e1a07";
      ctx.fillRect(s.x - 10, s.y - 1, 20, 3);
      ctx.fillStyle = "#fff5cf";
      ctx.font = '900 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(d.chestType === "nuke" ? "爆" : "风", s.x, s.y - 14);
      ctx.restore();
      continue;
    }

    ctx.beginPath();
    ctx.arc(s.x, s.y, d.radius, 0, Math.PI * 2);
    if (d.type === "xp") ctx.fillStyle = "#67c9ff";
    else if (d.type === "gold") ctx.fillStyle = "#ffd66a";
    else ctx.fillStyle = "#7bf1ff";
    ctx.fill();
  }
}

function drawParticles(camX, camY) {
  for (const p of game.particles) {
    const s = worldToScreen(p.x, p.y, camX, camY);
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color.replace(")", `,${alpha})`).replace("rgb", "rgba");
    if (!ctx.fillStyle.includes("rgba")) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawFloatingTexts(camX, camY) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of game.floatingTexts) {
    const s = worldToScreen(t.x, t.y, camX, camY);
    const alpha = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = `900 ${t.size}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(t.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function render() {
  if (!game.player) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    return;
  }
  const camX = game.player.x;
  const camY = game.player.y;
  drawBackground(camX, camY);

  if (game.lightningFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.16, game.lightningFlash * 1.8);
    ctx.fillStyle = "#8be8ff";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }

  drawDrops(camX, camY);
  drawProjectiles(camX, camY);
  drawLightningArcs(camX, camY);
  drawEnemies(camX, camY);
  drawPlayer(camX, camY);
  drawParticles(camX, camY);
  drawFloatingTexts(camX, camY);
}

function tick(now) {
  const elapsed = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = Math.min(elapsed, 0.05);
  game.delta = dt;

  if (game.running && !game.paused && game.state === "game") {
    game.time += dt;
    updatePlayer(dt);
    updateEnemySpawning(dt);
    updateWeapons(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEnemyProjectiles(dt);
    updateDrops(dt);
    updateFloatingTexts(dt);
    updateParticles(dt);
    updateLightningArcs(dt);
    checkMilestones();
    evaluateEndCondition();
    if (game.upgradesPending > 0 && game.state === "game") {
      triggerUpgrade();
    }
  } else {
    updateFloatingTexts(dt);
    updateParticles(dt);
    updateLightningArcs(dt);
  }

  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) {
      messageToast.classList.add("hidden");
    }
  }

  updateHud();
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (game.state === "game" || game.state === "paused") {
      e.preventDefault();
      togglePause();
      return;
    }
  }
  keys[e.code] = true;
  if (game.state === "upgrade") {
    if (e.code === "Digit1") chooseUpgrade(0);
    if (e.code === "Digit2") chooseUpgrade(1);
    if (e.code === "Digit3") chooseUpgrade(2);
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

startBtn.addEventListener("click", () => {
  showScreen(classScreen);
});

backToMenuBtn.addEventListener("click", () => {
  showScreen(menuScreen);
});

restartBtn.addEventListener("click", () => {
  const cls = CLASS_LIST.find((x) => x.id === game.selectedClass) || CLASS_LIST[0];
  startGame(cls);
});

backMenuResultBtn.addEventListener("click", () => {
  backToMenu();
});

resumeBtn.addEventListener("click", () => {
  resumeGameFromPause();
});

pauseBackMenuBtn.addEventListener("click", () => {
  backToMenu();
});

createClassSelection();
resizeCanvas();
showScreen(menuScreen);
requestAnimationFrame(tick);
