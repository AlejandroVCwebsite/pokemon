
"use strict";

// ============================================================
// CANVAS AND GAME CONSTANTS
// ============================================================

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Your browser does not support Canvas 2D.");
}

ctx.imageSmoothingEnabled = false;

const TILE = 48;
const MAP_NAMES = ["Forest Entrance", "Old Ruins", "Deep Woods"];

const $ = id => document.getElementById(id);

const keys = Object.create(null);
let interactPressed = false;
let attackPressed = false;
let lastTime = performance.now();
let messageTimer = 0;

// ============================================================
// ORIGINAL FOREST QUEST MAPS
// ============================================================

const maps = [
  [
    "########################################",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#.............................D........#",
    "#....................X.................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#.......C..............................#",
    "#......................................#",
    "#......................................#",
    "#......................................#",
    "#....................P.................#",
    "#......................................#",
    "#......................................#",
    "######################################"
  ],
  [
    "###########D############",
    "#......................#",
    "#....#####.............#",
    "#....#...#.............#",
    "#....#...#.............#",
    "#....#...#.............#",
    "#....#####.............#",
    "#......................#",
    "#......C...............#",
    "#......................#",
    "#......................#",
    "###########D############"
  ],
  [
    "########################",
    "#......................#",
    "#......................#",
    "#..####................#",
    "#..#..#................#",
    "#..#..#....X...........#",
    "#..####................#",
    "#......................#",
    "#......D...............#",
    "#......................#",
    "#......................#",
    "########################"
  ]
];

// Make all maps rectangular.
for (let i = 0; i < maps.length; i++) {
  const width = Math.max(...maps[i].map(row => row.length));
  maps[i] = maps[i].map(row => row.padEnd(width, "#"));
}

function mapWidth(roomNumber = room) {
  return maps[roomNumber][0].length;
}

function mapHeight(roomNumber = room) {
  return maps[roomNumber].length;
}

// ============================================================
// ROOM CONNECTIONS
// ============================================================

const DOOR_LINKS = {
  "0:30:9": { room: 1, spawnX: 11, spawnY: 1 },
  "1:11:0": { room: 0, spawnX: 29, spawnY: 9 },
  "1:11:11": { room: 2, spawnX: 7, spawnY: 9 },
  "2:7:8": { room: 1, spawnX: 11, spawnY: 10 }
};

// ============================================================
// PLAYER AND RPG STATS
// ============================================================

let room = 0;
let score = 0;
let gameOver = false;
let victory = false;

const player = {
  x: 21 * TILE + TILE / 2,
  y: 18 * TILE + TILE / 2,
  w: 28,
  h: 28,
  speed: 190,
  health: 100,
  maxHealth: 100,
  level: 1,
  xp: 0,
  gold: 50,
  potions: 3,
  weapon: "Wooden Sword",
  weaponDamage: 8,
  hasKey: false,
  direction: "up",
  attacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  invincible: 0
};

const camera = {
  x: 0,
  y: 0,
  smoothness: 8
};

// ============================================================
// CHARACTERS AND CREATURES
// ============================================================

// These characters appear in the forest world.
// Walk close to one and press E to interact.

const characters = [
  {
    id: "harold",
    name: "Harold",
    title: "Forest Guide",
    room: 0,
    x: 14,
    y: 5,
    type: "friendly",
    color: "#e0b16b",
    dialogue: "Welcome, adventurer! Find the golden key in the chest. You will need it to open the ancient doors."
  },
  {
    id: "ratbadger",
    name: "Rat Badger",
    title: "Forest Beast",
    room: 0,
    x: 11,
    y: 3,
    type: "enemy",
    color: "#a64f62",
    hp: 32,
    maxHp: 32,
    damage: 7,
    xp: 20,
    gold: 10,
    defeated: false
  },
  {
    id: "toth",
    name: "Toth",
    title: "Ruins Guardian",
    room: 1,
    x: 17,
    y: 4,
    type: "enemy",
    color: "#8056a8",
    hp: 55,
    maxHp: 55,
    damage: 10,
    xp: 45,
    gold: 25,
    defeated: false
  },
  {
    id: "walker",
    name: "Walker",
    title: "Wandering Merchant",
    room: 2,
    x: 17,
    y: 2,
    type: "merchant",
    color: "#4d9eae",
    dialogue: "I travel these woods looking for rare treasures. I can sell you a potion for 15 gold."
  }
];

// Additional roaming enemies are created in each room.
let enemies = [];

function makeEnemy(tx, ty, name = "Forest Creature") {
  return {
    name,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    w: 26,
    h: 26,
    speed: 55,
    health: 2,
    maxHealth: 2,
    attackTimer: 0,
    defeated: false
  };
}

function createEnemies() {
  enemies = [];

  if (room === 0) {
    enemies.push(makeEnemy(18, 7, "Forest Creature"));
    enemies.push(makeEnemy(5, 8, "Forest Creature"));
  }

  if (room === 1) {
    enemies.push(makeEnemy(3, 3, "Ruins Creature"));
    enemies.push(makeEnemy(19, 8, "Ruins Creature"));
    enemies.push(makeEnemy(7, 9, "Ruins Creature"));
  }

  if (room === 2) {
    enemies.push(makeEnemy(4, 2, "Deep Woods Beast"));
    enemies.push(makeEnemy(4, 8, "Deep Woods Beast"));
    enemies.push(makeEnemy(19, 8, "Deep Woods Beast"));
  }
}

// ============================================================
// TRAINET LOCATION MARKER
// ============================================================

const trainet = {
  room: 0,
  x: 20,
  y: 10
};

function placeTrainet() {
  const selectedRoom = Number($("trainetRoom").value);
  const x = Number($("trainetX").value);
  const y = Number($("trainetY").value);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    showMessage("Enter whole-number tile coordinates.");
    return;
  }

  if (
    selectedRoom < 0 ||
    selectedRoom >= maps.length ||
    x < 1 ||
    y < 1 ||
    x >= mapWidth(selectedRoom) - 1 ||
    y >= mapHeight(selectedRoom) - 1
  ) {
    showMessage("That Trainet position is outside the map.");
    return;
  }

  if (maps[selectedRoom][y][x] === "#") {
    showMessage("Trainet cannot be placed inside a wall.");
    return;
  }

  trainet.room = selectedRoom;
  trainet.x = x;
  trainet.y = y;

  updateTrainetText();
  showMessage("Trainet marker moved!");
}

function updateTrainetText() {
  $("trainetStatus").textContent =
    `Trainet: ${MAP_NAMES[trainet.room]} (${trainet.x}, ${trainet.y})`;
}

function placeTrainetAtPlayer() {
  trainet.room = room;
  trainet.x = Math.floor(player.x / TILE);
  trainet.y = Math.floor(player.y / TILE);

  $("trainetRoom").value = String(room);
  $("trainetX").value = trainet.x;
  $("trainetY").value = trainet.y;

  updateTrainetText();
  showMessage("Trainet marker placed at your position.");
}

function travelToTrainet() {
  if (trainet.room === room) {
    showMessage("You are already in Trainet's map!");
    return;
  }

  loadRoom(trainet.room, trainet.x, trainet.y);
  showMessage("You travelled to Trainet's marker!");
}

// ============================================================
// PARTICLES
// ============================================================

let particles = [];

function particle(x, y, color = "#ffe66d", amount = 8) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.5 + Math.random() * 0.5,
      color
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ============================================================
// INPUT
// ============================================================

window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    e.preventDefault();
  }

  if (!keys[key]) {
    if (key === "e") interactPressed = true;
    if (key === " ") attackPressed = true;
  }

  keys[key] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
  for (const key in keys) keys[key] = false;
  interactPressed = false;
  attackPressed = false;
});

// ============================================================
// COLLISION AND MAP HELPERS
// ============================================================

function tileAt(x, y, roomNumber = room) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);

  if (
    tx < 0 || tx >= mapWidth(roomNumber) ||
    ty < 0 || ty >= mapHeight(roomNumber)
  ) {
    return "#";
  }

  return maps[roomNumber][ty][tx];
}

function isSolidTile(tx, ty) {
  if (
    tx < 0 || tx >= mapWidth() ||
    ty < 0 || ty >= mapHeight()
  ) {
    return true;
  }

  const tile = maps[room][ty][tx];
  return tile === "#" || tile === "D";
}

function collidesWall(x, y, w, h) {
  const left = Math.floor((x - w / 2) / TILE);
  const right = Math.floor((x + w / 2 - 0.001) / TILE);
  const top = Math.floor((y - h / 2) / TILE);
  const bottom = Math.floor((y + h / 2 - 0.001) / TILE);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(tx, ty)) return true;
    }
  }

  return false;
}

function replaceTile(x, y, replacement) {
  maps[room][y] =
    maps[room][y].substring(0, x) +
    replacement +
    maps[room][y].substring(x + 1);
}

// ============================================================
// PLAYER MOVEMENT
// ============================================================

function movePlayer(dx, dy) {
  const nx = player.x + dx;

  if (!collidesWall(nx, player.y, player.w, player.h)) {
    player.x = nx;
  }

  const ny = player.y + dy;

  if (!collidesWall(player.x, ny, player.w, player.h)) {
    player.y = ny;
  }
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera(dt) {
  const maxX = Math.max(0, mapWidth() * TILE - canvas.width);
  const maxY = Math.max(0, mapHeight() * TILE - canvas.height);

  const targetX = Math.max(0, Math.min(player.x - canvas.width / 2, maxX));
  const targetY = Math.max(0, Math.min(player.y - canvas.height / 2, maxY));

  const smoothing = 1 - Math.exp(-camera.smoothness * dt);

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;
}

function snapCameraToPlayer() {
  const maxX = Math.max(0, mapWidth() * TILE - canvas.width);
  const maxY = Math.max(0, mapHeight() * TILE - canvas.height);

  camera.x = Math.max(0, Math.min(player.x - canvas.width / 2, maxX));
  camera.y = Math.max(0, Math.min(player.y - canvas.height / 2, maxY));
}

// ============================================================
// ROOM MANAGEMENT
// ============================================================

function loadRoom(newRoom, spawnX = 7, spawnY = 9) {
  if (newRoom < 0 || newRoom >= maps.length) return;

  room = newRoom;

  player.x = spawnX * TILE + TILE / 2;
  player.y = spawnY * TILE + TILE / 2;

  player.attacking = false;
  player.attackTimer = 0;
  player.attackCooldown = 0;

  createEnemies();

  player.health = Math.min(player.health + 5, player.maxHealth);

  particles = [];
  snapCameraToPlayer();
  updateHUD();

  showMessage(`Entered ${MAP_NAMES[room]}`);
}

// ============================================================
// RPG EXPERIENCE, LEVELS AND REWARDS
// ============================================================

function gainXP(amount) {
  player.xp += amount;

  while (player.xp >= player.level * 50) {
    player.xp -= player.level * 50;
    player.level++;

    player.maxHealth += 10;
    player.health = player.maxHealth;
    player.weaponDamage += 2;

    showMessage(`LEVEL UP! You are now level ${player.level}.`);
  }

  updateHUD();
}

function rewardEnemy(enemy) {
  player.gold += enemy.gold || 5;
  gainXP(enemy.xp || 10);
  score += 100;

  particle(enemy.x, enemy.y, "#8cff75", 16);
  showMessage(`Victory! +${enemy.xp || 10} XP and +${enemy.gold || 5} gold.`);
}

// ============================================================
// TURN-BASED BATTLE SYSTEM
// ============================================================

let battle = null;

function startBattle(enemy) {
  if (battle || gameOver || victory) return;

  battle = {
    enemy,
    playerTurn: true,
    enemyHp: enemy.hp || 24,
    enemyMaxHp: enemy.maxHp || 24,
    enemyDamage: enemy.damage || 6,
    enemyName: enemy.name,
    enemyXp: enemy.xp || 15,
    enemyGold: enemy.gold || 5
  };

  $("battlePanel").hidden = false;
  $("battleTitle").textContent = `${enemy.name} challenges you!`;
  $("battleEnemyName").textContent = enemy.name;
  $("battleLog").textContent = `${enemy.name} is ready to fight!`;

  updateBattleUI();
  showMessage(`Battle started with ${enemy.name}!`);
}

function updateBattleUI() {
  if (!battle) return;

  $("battlePlayerHealth").textContent =
    `${player.health} / ${player.maxHealth} HP`;

  $("battleEnemyHealth").textContent =
    `${battle.enemyHp} / ${battle.enemyMaxHp} HP`;

  $("enemyHealthBar").style.width =
    `${Math.max(0, battle.enemyHp / battle.enemyMaxHp * 100)}%`;

  $("potionText").textContent = player.potions;

  $("attackButton").disabled = !battle.playerTurn;
  $("heavyButton").disabled = !battle.playerTurn;
  $("potionButton").disabled = !battle.playerTurn || player.potions <= 0;
  $("runButton").disabled = !battle.playerTurn;

  updateHUD();
}

function playerBattleAttack(heavy = false) {
  if (!battle || !battle.playerTurn) return;

  const base = player.weaponDamage;
  const damage = heavy
    ? Math.floor(base * 1.8 + Math.random() * 5)
    : Math.floor(base + Math.random() * 4);

  battle.enemyHp = Math.max(0, battle.enemyHp - damage);
  battle.playerTurn = false;

  $("battleLog").textContent =
    `You ${heavy ? "use a heavy attack" : "attack"} for ${damage} damage!`;

  updateBattleUI();

  if (battle.enemyHp <= 0) {
    finishBattle(true);
    return;
  }

  window.setTimeout(enemyBattleTurn, 650);
}

function enemyBattleTurn() {
  if (!battle || gameOver) return;

  const damage = Math.max(
    1,
    battle.enemyDamage + Math.floor(Math.random() * 4) -
    Math.floor(player.level / 2)
  );

  player.health = Math.max(0, player.health - damage);

  $("battleLog").textContent =
    `${battle.enemyName} hits you for ${damage} damage!`;

  if (player.health <= 0) {
    finishBattle(false);
    return;
  }

  battle.playerTurn = true;
  updateBattleUI();
}

function usePotion() {
  if (!battle || !battle.playerTurn || player.potions <= 0) return;

  if (player.health === player.maxHealth) {
    $("battleLog").textContent = "Your health is already full.";
    return;
  }

  player.potions--;
  const healed = Math.min(35, player.maxHealth - player.health);
  player.health += healed;
  battle.playerTurn = false;

  $("battleLog").textContent = `You restored ${healed} health!`;

  updateBattleUI();
  window.setTimeout(enemyBattleTurn, 650);
}

function finishBattle(won) {
  if (!battle) return;

  const defeated = battle.enemy;

  if (won) {
    if (defeated.id) {
      defeated.defeated = true;
    } else {
      defeated.defeated = true;
      enemies = enemies.filter(enemy => enemy !== defeated);
    }

    player.gold += battle.enemyGold;
    gainXP(battle.enemyXp);

    $("battleLog").textContent =
      `You defeated ${battle.enemyName}! You earned ${battle.enemyXp} XP and ${battle.enemyGold} gold.`;

    particle(player.x, player.y, "#8cff75", 16);
    battle = null;
    $("battlePanel").hidden = true;

    showMessage(`You defeated ${defeated.name}!`);
    updateHUD();
  } else {
    gameOver = true;
    $("battleLog").textContent = "You have been defeated.";
    battle = null;
    $("battlePanel").hidden = true;
    showMessage("You have been defeated!");
  }
}

function runFromBattle() {
  if (!battle || !battle.playerTurn) return;

  battle = null;
  $("battlePanel").hidden = true;
  showMessage("You escaped from battle.");
}

// ============================================================
// QUICK REAL-TIME ATTACK WHILE EXPLORING
// ============================================================

function startQuickAttack() {
  if (battle || gameOver || victory || player.attackCooldown > 0) return;

  player.attacking = true;
  player.attackTimer = 0.18;
  player.attackCooldown = 0.4;

  const range = 48;
  let ax = player.x;
  let ay = player.y;

  if (player.direction === "up") ay -= range;
  if (player.direction === "down") ay += range;
  if (player.direction === "left") ax -= range;
  if (player.direction === "right") ax += range;

  // Check named enemies first.
  for (const character of characters) {
    if (
      character.room === room &&
      character.type === "enemy" &&
      !character.defeated
    ) {
      const ex = character.x * TILE + TILE / 2;
      const ey = character.y * TILE + TILE / 2;

      if (Math.hypot(ex - ax, ey - ay) < 45) {
        startBattle(character);
        return;
      }
    }
  }

  // Check roaming enemies.
  for (const enemy of enemies) {
    if (Math.hypot(enemy.x - ax, enemy.y - ay) < 45) {
      startBattle({
        ...enemy,
        name: enemy.name,
        hp: 24,
        maxHp: 24,
        damage: 6,
        xp: 15,
        gold: 5
      });
      return;
    }
  }
}

// ============================================================
// CHARACTER INTERACTIONS
// ============================================================

function nearbyCharacter() {
  let closest = null;
  let bestDistance = 62;

  for (const character of characters) {
    if (character.room !== room) continue;
    if (character.defeated) continue;

    const x = character.x * TILE + TILE / 2;
    const y = character.y * TILE + TILE / 2;
    const distance = Math.hypot(player.x - x, player.y - y);

    if (distance < bestDistance) {
      closest = character;
      bestDistance = distance;
    }
  }

  return closest;
}

function interactCharacter(character) {
  if (character.type === "enemy") {
    startBattle(character);
    return;
  }

  if (character.type === "merchant") {
    const buy = window.confirm(
      `${character.name}: ${character.dialogue}\n\nBuy one potion for 15 gold?`
    );

    if (buy) {
      if (player.gold >= 15) {
        player.gold -= 15;
        player.potions++;
        showMessage("You bought a potion!");
        updateHUD();
      } else {
        showMessage("You don't have enough gold.");
      }
    }

    return;
  }

  showMessage(`${character.name}: ${character.dialogue}`);
}

// ============================================================
// CHESTS, DOORS, EXITS, TRAINET AND INTERACTION
// ============================================================

function interact() {
  if (gameOver || victory || battle) return;

  const character = nearbyCharacter();

  if (character) {
    interactCharacter(character);
    return;
  }

  const tx = Math.floor(player.x / TILE);
  const ty = Math.floor(player.y / TILE);

  const around = [
    [tx, ty],
    [tx + 1, ty],
    [tx - 1, ty],
    [tx, ty + 1],
    [tx, ty - 1]
  ];

  // Check Trainet marker.
  if (trainet.room === room) {
    const distance = Math.hypot(
      player.x - (trainet.x * TILE + TILE / 2),
      player.y - (trainet.y * TILE + TILE / 2)
    );

    if (distance < 62) {
      travelToTrainet();
      return;
    }
  }

  for (const [x, y] of around) {
    if (
      x < 0 || x >= mapWidth() ||
      y < 0 || y >= mapHeight()
    ) {
      continue;
    }

    const tile = maps[room][y][x];

    if (tile === "C") {
      replaceTile(x, y, ".");

      if (!player.hasKey) {
        player.hasKey = true;
        player.gold += 25;
        score += 250;

        particle(x * TILE + TILE / 2, y * TILE + TILE / 2, "#ffe66d", 20);
        showMessage("You found the GOLDEN KEY and 25 gold!");
      } else {
        showMessage("The chest is empty.");
      }

      updateHUD();
      return;
    }

    if (tile === "D") {
      const link = DOOR_LINKS[`${room}:${x}:${y}`];

      if (!player.hasKey) {
        showMessage("The door is locked. Find the golden key!");
        return;
      }

      if (link) {
        loadRoom(link.room, link.spawnX, link.spawnY);
      } else {
        replaceTile(x, y, ".");
        showMessage("The door opens!");
      }

      return;
    }

    if (tile === "X") {
      if (enemies.length > 0) {
        showMessage("Defeat the roaming creatures first!");
        return;
      }

      if (room < maps.length - 1) {
        loadRoom(room + 1);
      } else {
        victory = true;
      }

      return;
    }
  }

  showMessage("There is nothing nearby to interact with.");
}

// ============================================================
// ROAMING ENEMY AI
// ============================================================

function updateEnemies(dt) {
  if (battle) return;

  for (const enemy of enemies) {
    enemy.attackTimer -= dt;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 240 && distance > 35) {
      const vx = dx / distance;
      const vy = dy / distance;
      const speed = enemy.speed * dt;

      const nx = enemy.x + vx * speed;

      if (!collidesWall(nx, enemy.y, enemy.w, enemy.h)) {
        enemy.x = nx;
      }

      const ny = enemy.y + vy * speed;

      if (!collidesWall(enemy.x, ny, enemy.w, enemy.h)) {
        enemy.y = ny;
      }
    }

    if (distance < 32 && enemy.attackTimer <= 0) {
      if (player.invincible <= 0) {
        player.health = Math.max(0, player.health - 5);
        player.invincible = 1;

        particle(player.x, player.y, "#ff5555");

        if (player.health <= 0) {
          gameOver = true;
        }

        updateHUD();
      }

      enemy.attackTimer = 1;
    }
  }
}

// ============================================================
// EXIT CHECK
// ============================================================

function checkExit() {
  const tile = tileAt(player.x, player.y);

  if (tile !== "X" || enemies.length !== 0) return;

  if (room < maps.length - 1) {
    loadRoom(room + 1);
  } else {
    victory = true;
  }
}

// ============================================================
// DRAWING: MAP
// ============================================================

function drawMap() {
  const map = maps[room];

  const startCol = Math.max(0, Math.floor(camera.x / TILE));
  const startRow = Math.max(0, Math.floor(camera.y / TILE));

  const endCol = Math.min(
    mapWidth(),
    Math.ceil((camera.x + canvas.width) / TILE)
  );

  const endRow = Math.min(
    mapHeight(),
    Math.ceil((camera.y + canvas.height) / TILE)
  );

  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const tile = map[y][x];
      const px = x * TILE;
      const py = y * TILE;

      ctx.fillStyle = "#315b32";
      ctx.fillRect(px, py, TILE, TILE);

      ctx.fillStyle = "#3d6d39";

      for (let i = 0; i < 3; i++) {
        const gx = px + 7 + ((x * 13 + i * 17) % 32);
        const gy = py + 8 + ((y * 19 + i * 11) % 30);
        ctx.fillRect(gx, gy, 3, 3);
      }

      if (tile === "#") {
        ctx.fillStyle = "#26332b";
        ctx.fillRect(px, py, TILE, TILE);

        ctx.fillStyle = "#34483a";
        ctx.fillRect(px + 4, py + 4, TILE - 8, 10);

        ctx.fillStyle = "#1c261f";
        ctx.fillRect(px + 5, py + 25, TILE - 10, 16);
      }

      if (tile === "C") drawChest(px, py);
      if (tile === "D") drawDoor(px, py);
      if (tile === "X") drawExit(px, py);
    }
  }

  drawTrainetMarker();
}

function drawChest(x, y) {
  ctx.fillStyle = "#8b531f";
  ctx.fillRect(x + 8, y + 17, 32, 23);

  ctx.fillStyle = "#c47b27";
  ctx.fillRect(x + 8, y + 17, 32, 9);

  ctx.fillStyle = "#ffd45c";
  ctx.fillRect(x + 22, y + 25, 5, 8);

  ctx.strokeStyle = "#42250d";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 8, y + 17, 32, 23);
}

function drawDoor(x, y) {
  ctx.fillStyle = "#653d25";
  ctx.fillRect(x + 8, y + 4, 32, 44);

  ctx.fillStyle = "#b47b3e";
  ctx.fillRect(x + 13, y + 8, 22, 36);

  ctx.fillStyle = "#f5d65a";
  ctx.fillRect(x + 28, y + 25, 5, 5);
}

function drawExit(x, y) {
  ctx.fillStyle = "#253e77";
  ctx.fillRect(x + 5, y + 5, 38, 38);

  ctx.fillStyle = "#5e8fff";
  ctx.fillRect(x + 12, y + 12, 24, 24);

  ctx.fillStyle = "#c4e8ff";
  ctx.fillRect(x + 18, y + 8, 12, 30);
}

// ============================================================
// TRAINET MARKER DRAWING
// ============================================================

function drawTrainetMarker() {
  if (trainet.room !== room) return;

  const x = trainet.x * TILE + TILE / 2;
  const y = trainet.y * TILE + TILE / 2;

  ctx.save();

  ctx.fillStyle = "rgba(255, 220, 65, 0.2)";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffe45c";
  ctx.beginPath();
  ctx.moveTo(x, y - 23);
  ctx.lineTo(x + 15, y);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x - 15, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#49330c";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("T", x, y + 4);

  ctx.fillStyle = "#fff3a1";
  ctx.font = "bold 13px Arial";
  ctx.fillText("TRAINET", x, y - 30);

  ctx.restore();
}

// ============================================================
// DRAWING: PLAYER
// ============================================================

function drawPlayer() {
  const x = player.x;
  const y = player.y;

  if (
    player.invincible > 0 &&
    Math.floor(player.invincible * 12) % 2 === 0
  ) {
    return;
  }

  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 13, 17, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#286b43";
  ctx.fillRect(x - 12, y - 3, 24, 22);

  ctx.fillStyle = "#e4a66b";
  ctx.fillRect(x - 11, y - 18, 22, 18);

  ctx.fillStyle = "#54351e";
  ctx.fillRect(x - 11, y - 20, 22, 6);

  ctx.fillStyle = "#3f9b54";
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 18);
  ctx.lineTo(x + 13, y - 18);
  ctx.lineTo(x + 8, y - 29);
  ctx.lineTo(x - 6, y - 29);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(x - 7, y - 12, 4, 4);
  ctx.fillRect(x + 3, y - 12, 4, 4);

  ctx.fillStyle = "#687f9d";
  ctx.beginPath();
  ctx.arc(x + 15, y + 4, 8, 0, Math.PI * 2);
  ctx.fill();

  if (player.attacking) {
    ctx.strokeStyle = "#e8f4ff";
    ctx.lineWidth = 6;
    ctx.lineCap = "square";
    ctx.beginPath();

    if (player.direction === "up") {
      ctx.moveTo(x - 12, y - 22);
      ctx.lineTo(x + 15, y - 45);
    } else if (player.direction === "down") {
      ctx.moveTo(x + 12, y + 18);
      ctx.lineTo(x - 15, y + 43);
    } else if (player.direction === "left") {
      ctx.moveTo(x - 17, y - 5);
      ctx.lineTo(x - 45, y + 8);
    } else {
      ctx.moveTo(x + 17, y - 5);
      ctx.lineTo(x + 45, y - 18);
    }

    ctx.stroke();
    ctx.lineCap = "butt";
  }
}

// ============================================================
// DRAWING: NAMED CHARACTERS
// ============================================================

function drawCharacters() {
  for (const character of characters) {
    if (character.room !== room || character.defeated) continue;

    const x = character.x * TILE + TILE / 2;
    const y = character.y * TILE + TILE / 2;

    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = character.color;
    ctx.fillRect(x - 12, y - 10, 24, 27);

    ctx.fillStyle = "#e6b27e";
    ctx.beginPath();
    ctx.arc(x, y - 16, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38291d";
    ctx.fillRect(x - 10, y - 24, 20, 6);

    ctx.fillStyle = "#171717";
    ctx.fillRect(x - 5, y - 17, 3, 3);
    ctx.fillRect(x + 3, y - 17, 3, 3);

    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(character.name, x, y - 34);

    if (character.type === "enemy") {
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(x - 16, y - 29, 32, 4);

      ctx.fillStyle = "#e84c4c";
      ctx.fillRect(x - 16, y - 29, 32, 4);
    }
  }

  ctx.textAlign = "left";
}

// ============================================================
// DRAWING: ROAMING ENEMIES
// ============================================================

function drawEnemies() {
  for (const enemy of enemies) {
    const x = enemy.x;
    const y = enemy.y;

    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8b3f54";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#a95163";

    ctx.beginPath();
    ctx.moveTo(x - 13, y - 8);
    ctx.lineTo(x - 8, y - 22);
    ctx.lineTo(x - 2, y - 9);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 13, y - 8);
    ctx.lineTo(x + 8, y - 22);
    ctx.lineTo(x + 2, y - 9);
    ctx.fill();

    ctx.fillStyle = "#ffd85b";
    ctx.fillRect(x - 8, y - 4, 5, 5);
    ctx.fillRect(x + 3, y - 4, 5, 5);
  }
}

// ============================================================
// DRAWING: PARTICLES AND HUD
// ============================================================

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 0.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 5, 5);
  }

  ctx.globalAlpha = 1;
}

function drawHeart(x, y, full) {
  ctx.fillStyle = full ? "#ff4f5e" : "#49252b";
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x - 9, y - 2);
  ctx.arc(x - 5, y - 3, 5, Math.PI, 0);
  ctx.arc(x + 5, y - 3, 5, Math.PI, 0);
  ctx.lineTo(x, y + 10);
  ctx.fill();
}

function drawHUD() {
  ctx.fillStyle = "rgba(10,15,15,.82)";
  ctx.fillRect(10, 10, 275, 62);

  const hearts = Math.ceil(player.health / 20);
  for (let i = 0; i < 5; i++) {
    drawHeart(25 + i * 30, 36, i < hearts);
  }

  ctx.fillStyle = "#f4d35e";
  ctx.font = "15px Arial";
  ctx.fillText(`Score: ${score}`, 25, 61);

  if (player.hasKey) {
    ctx.fillStyle = "#ffe45c";
    ctx.fillText("KEY", 210, 61);
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText(MAP_NAMES[room], canvas.width - 15, 28);
  ctx.fillText(`Room ${room + 1}/3`, canvas.width - 15, 49);
  ctx.textAlign = "left";
}

// ============================================================
// END SCREEN
// ============================================================

function drawEndScreen() {
  if (!gameOver && !victory) return;

  ctx.fillStyle = "rgba(0,0,0,.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  if (victory) {
    ctx.fillStyle = "#f6d365";
    ctx.font = "48px Arial";
    ctx.fillText("VICTORY!", canvas.width / 2, 220);

    ctx.fillStyle = "#ffffff";
    ctx.font = "22px Arial";
    ctx.fillText(
      "You escaped the Forest Quest!",
      canvas.width / 2,
      265
    );
    ctx.fillText(`Final score: ${score}`, canvas.width / 2, 305);
  } else {
    ctx.fillStyle = "#e85d5d";
    ctx.font = "48px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2, 240);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(
      "Your adventure has ended.",
      canvas.width / 2,
      290
    );
    ctx.fillText(`Final score: ${score}`, canvas.width / 2, 325);
  }

  ctx.font = "16px Arial";
  ctx.fillText(
    "Press Restart game to play again.",
    canvas.width / 2,
    370
  );

  ctx.textAlign = "left";
}

// ============================================================
// MAIN DRAW FUNCTION
// ============================================================

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawMap();
  drawCharacters();
  drawEnemies();
  drawPlayer();
  drawParticles();

  ctx.restore();

  drawHUD();
  drawEndScreen();
}

// ============================================================
// USER INTERFACE
// ============================================================

function showMessage(text) {
  const box = $("message");
  box.textContent = text;
  box.style.display = "block";
  messageTimer = 3;
}

function updateHUD() {
  $("levelText").textContent = player.level;
  $("xpText").textContent = player.xp;
  $("goldText").textContent = player.gold;
  $("weaponText").textContent = player.weapon;
  $("healthText").textContent = `${player.health} / ${player.maxHealth}`;
  $("potionText").textContent = player.potions;
  $("keyText").textContent = player.hasKey ? "Golden key" : "No key";
  $("roomText").textContent = MAP_NAMES[room];

  $("playerHealthBar").style.width =
    `${player.health / player.maxHealth * 100}%`;

  $("playerHealthBar").style.background =
    player.health <= 25 ? "#df5b5b" : "#63bd68";

  $("interactionText").textContent = getInteractionHint();
}

function getInteractionHint() {
  const character = nearbyCharacter();

  if (character) {
    if (character.type === "enemy") {
      return `${character.name} is nearby. Press E to start a battle.`;
    }

    return `${character.name} is nearby. Press E to talk.`;
  }

  if (trainet.room === room) {
    const distance = Math.hypot(
      player.x - (trainet.x * TILE + TILE / 2),
      player.y - (trainet.y * TILE + TILE / 2)
    );

    if (distance < 75) {
      return "Trainet marker: press E to travel to the configured destination.";
    }
  }

  return "Explore the map. Approach characters, creatures, chests, doors, or Trainet and press E.";
}

// ============================================================
// RESTART
// ============================================================

function restartGame() {
  room = 0;
  score = 0;
  gameOver = false;
  victory = false;
  battle = null;

  player.x = 21 * TILE + TILE / 2;
  player.y = 18 * TILE + TILE / 2;
  player.health = 100;
  player.maxHealth = 100;
  player.level = 1;
  player.xp = 0;
  player.gold = 50;
  player.potions = 3;
  player.weapon = "Wooden Sword";
  player.weaponDamage = 8;
  player.hasKey = false;
  player.direction = "up";
  player.attacking = false;
  player.attackTimer = 0;
  player.attackCooldown = 0;
  player.invincible = 0;

  for (const character of characters) {
    if (character.type === "enemy") character.defeated = false;
  }

  trainet.room = 0;
  trainet.x = 20;
  trainet.y = 10;

  $("trainetRoom").value = "0";
  $("trainetX").value = "20";
  $("trainetY").value = "10";

  updateTrainetText();
  createEnemies();
  particles = [];
  battle = null;
  $("battlePanel").hidden = true;

  snapCameraToPlayer();
  updateHUD();
  showMessage("A new adventure begins!");
}

// ============================================================
// BUTTON EVENTS
// ============================================================

$("moveTrainetButton").addEventListener("click", placeTrainet);
$("placeAtPlayerButton").addEventListener("click", placeTrainetAtPlayer);
$("interactButton").addEventListener("click", interact);
$("restartButton").addEventListener("click", restartGame);

$("attackButton").addEventListener("click", () => playerBattleAttack(false));
$("heavyButton").addEventListener("click", () => playerBattleAttack(true));
$("potionButton").addEventListener("click", usePotion);
$("runButton").addEventListener("click", runFromBattle);

// ============================================================
// MAIN UPDATE LOOP
// ============================================================

function update(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!gameOver && !victory && !battle) {
    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
      dy--;
      player.direction = "up";
    }

    if (keys["s"] || keys["arrowdown"]) {
      dy++;
      player.direction = "down";
    }

    if (keys["a"] || keys["arrowleft"]) {
      dx--;
      player.direction = "left";
    }

    if (keys["d"] || keys["arrowright"]) {
      dx++;
      player.direction = "right";
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;

      movePlayer(
        dx * player.speed * dt,
        dy * player.speed * dt
      );
    }

    if (attackPressed || keys[" "]) {
      startQuickAttack();
    }

    if (interactPressed) {
      interact();
    }

    updateEnemies(dt);
    updateParticles(dt);
    checkExit();

    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.invincible = Math.max(0, player.invincible - dt);

    if (player.attackTimer <= 0) {
      player.attacking = false;
    }
  } else {
    updateParticles(dt);
  }

  attackPressed = false;
  interactPressed = false;

  if (messageTimer > 0) {
    messageTimer -= dt;

    if (messageTimer <= 0) {
      $("message").style.display = "none";
    }
  }

  updateCamera(dt);
  updateHUD();
  draw();

  requestAnimationFrame(update);
}

// ============================================================
// START GAME
// ============================================================

createEnemies();
snapCameraToPlayer();
updateTrainetText();
updateHUD();
draw();

requestAnimationFrame(update);
