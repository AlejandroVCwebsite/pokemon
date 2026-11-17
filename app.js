// =========================================================
// CANVAS AND CONSTANTS
// =========================================================

const canvas = document.getElementById("game");

if (!canvas) {
    throw new Error('Forest Quest needs a canvas element with id="game".');
}

const ctx = canvas.getContext("2d");

if (!ctx) {
    throw new Error("Your browser does not support Canvas 2D.");
}

ctx.imageSmoothingEnabled = false;

const TILE = 48;

// =========================================================
// INPUT
// =========================================================

const keys = Object.create(null);

let interactPressed = false;

window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    if (
        ["arrowup", "arrowdown", "arrowleft",
         "arrowright"].includes(key)
    ) {
        e.preventDefault();
    }

    if (!keys[key]) {
        if (key === "e") interactPressed = true;
    }

    keys[key] = true;
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }

    interactPressed = false;
});

// =========================================================
// GAME STATE
// =========================================================

let room = 0;
let score = 0;
let gameOver = false;
let victory = false;
let messageTimer = 0;
let lastTime = performance.now();

const player = {
    x: 21 * TILE + TILE / 2,
    y: 18 * TILE + TILE / 2,
    w: 28,
    h: 28,
    speed: 190,
    health: 5,
    maxHealth: 5,
    direction: "up",
    hasKey: false
};

const camera = {
    x: 0,
    y: 0,
    smoothness: 8
};

// =========================================================
// MAPS
// =========================================================

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

// Make every map rectangular.
for (let i = 0; i < maps.length; i++) {
    const width = Math.max(...maps[i].map(row => row.length));

    maps[i] = maps[i].map(row => row.padEnd(width, "#"));
}

function mapWidth() {
    return maps[room][0].length;
}

function mapHeight() {
    return maps[room].length;
}

// =========================================================
// DOOR CONNECTIONS
// =========================================================

const DOOR_LINKS = {
    "0:30:9": {
        room: 1,
        spawnX: 11,
        spawnY: 1
    },

    "1:11:0": {
        room: 0,
        spawnX: 29,
        spawnY: 9
    },

    "1:11:11": {
        room: 2,
        spawnX: 7,
        spawnY: 9
    },

    "2:7:8": {
        room: 1,
        spawnX: 11,
        spawnY: 10
    }
};

// =========================================================
// PARTICLES
// =========================================================

let particles = [];

function particle(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
            life: 0.5 + Math.random() * 0.5,
            maxLife: 1,
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

// =========================================================
// CAMERA
// =========================================================

function updateCamera(dt) {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;

    const maxX = Math.max(0, mapWidth() * TILE - canvas.width);
    const maxY = Math.max(0, mapHeight() * TILE - canvas.height);

    const clampedX = Math.max(0, Math.min(targetX, maxX));
    const clampedY = Math.max(0, Math.min(targetY, maxY));

    const smoothing = 1 - Math.exp(-camera.smoothness * dt);

    camera.x += (clampedX - camera.x) * smoothing;
    camera.y += (clampedY - camera.y) * smoothing;

    if (clampedX === 0 || clampedX === maxX) {
        camera.x = clampedX;
    }

    if (clampedY === 0 || clampedY === maxY) {
        camera.y = clampedY;
    }
}

function snapCameraToPlayer() {
    const maxX = Math.max(0, mapWidth() * TILE - canvas.width);
    const maxY = Math.max(0, mapHeight() * TILE - canvas.height);

    camera.x = Math.max(
        0,
        Math.min(player.x - canvas.width / 2, maxX)
    );

    camera.y = Math.max(
        0,
        Math.min(player.y - canvas.height / 2, maxY)
    );
}

// =========================================================
// ROOM MANAGEMENT
// =========================================================

function loadRoom(newRoom, spawnX = 7, spawnY = 9) {
    if (newRoom < 0 || newRoom >= maps.length) return;

    room = newRoom;

    player.x = spawnX * TILE + TILE / 2;
    player.y = spawnY * TILE + TILE / 2;

    player.health = Math.min(
        player.health + 1,
        player.maxHealth
    );

    particles = [];

    snapCameraToPlayer();

    showMessage("Room " + (room + 1));
}

// =========================================================
// MAP COLLISION
// =========================================================

function tileAt(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);

    if (
        tx < 0 || tx >= mapWidth() ||
        ty < 0 || ty >= mapHeight()
    ) {
        return "#";
    }

    return maps[room][ty][tx];
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
            if (isSolidTile(tx, ty)) {
                return true;
            }
        }
    }

    return false;
}

// =========================================================
// MOVEMENT
// =========================================================

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

// =========================================================
// INTERACTION
// =========================================================

function interact() {
    if (gameOver || victory) return;

    const tx = Math.floor(player.x / TILE);
    const ty = Math.floor(player.y / TILE);

    const around = [
        [tx, ty],
        [tx + 1, ty],
        [tx - 1, ty],
        [tx, ty + 1],
        [tx, ty - 1]
    ];

    for (const [x, y] of around) {
        if (
            x < 0 || x >= mapWidth() ||
            y < 0 || y >= mapHeight()
        ) {
            continue;
        }

        const tile = maps[room][y][x];

        // CHEST
        if (tile === "C") {
            replaceTile(x, y, ".");

            if (!player.hasKey) {
                player.hasKey = true;
                score += 250;

                particle(
                    x * TILE + TILE / 2,
                    y * TILE + TILE / 2,
                    "#ffe66d",
                    20
                );

                showMessage("You found the GOLDEN KEY!");
            } else {
                showMessage("The chest is empty.");
            }

            return;
        }

        // DOORS
        if (tile === "D") {
            const link = DOOR_LINKS[`${room}:${x}:${y}`];

            if (!player.hasKey) {
                showMessage("The door is locked. Find the key!");
                return;
            }

            if (link) {
                loadRoom(
                    link.room,
                    link.spawnX,
                    link.spawnY
                );
            } else {
                replaceTile(x, y, ".");
                showMessage("The door opens!");
            }

            return;
        }

        // EXIT
        if (tile === "X") {
            if (room < maps.length - 1) {
                loadRoom(room + 1);
            } else {
                victory = true;
            }

            return;
        }
    }
}

function replaceTile(x, y, replacement) {
    maps[room][y] =
        maps[room][y].substring(0, x) +
        replacement +
        maps[room][y].substring(x + 1);
}

// =========================================================
// UPDATE
// =========================================================

function update(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!gameOver && !victory) {
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

        // Normalize diagonal movement.
        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);

            dx /= length;
            dy /= length;

            movePlayer(
                dx * player.speed * dt,
                dy * player.speed * dt
            );
        }

        if (interactPressed) {
            interact();
        }

        interactPressed = false;

        updateParticles(dt);
        checkExit();
    } else {
        interactPressed = false;
    }

    if (messageTimer > 0) {
        messageTimer -= dt;

        if (messageTimer <= 0) {
            document.getElementById("message").style.display = "none";
        }
    }

    updateCamera(dt);

    draw();

    requestAnimationFrame(update);
}

// =========================================================
// EXIT CHECK
// =========================================================

function checkExit() {
    const tile = tileAt(player.x, player.y);

    if (tile !== "X") {
        return;
    }

    if (room < maps.length - 1) {
        loadRoom(room + 1);
    } else {
        victory = true;
    }
}

// =========================================================
// DRAW MAP
// =========================================================

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

            // FLOOR
            ctx.fillStyle = "#315b32";
            ctx.fillRect(px, py, TILE, TILE);

            // GRASS DETAILS
            ctx.fillStyle = "#3d6d39";

            for (let i = 0; i < 3; i++) {
                const gx = px + 7 + ((x * 13 + i * 17) % 32);
                const gy = py + 8 + ((y * 19 + i * 11) % 30);

                ctx.fillRect(gx, gy, 3, 3);
            }

            // WALLS
            if (tile === "#") {
                ctx.fillStyle = "#26332b";
                ctx.fillRect(px, py, TILE, TILE);

                ctx.fillStyle = "#34483a";
                ctx.fillRect(
                    px + 4,
                    py + 4,
                    TILE - 8,
                    10
                );

                ctx.fillStyle = "#1c261f";
                ctx.fillRect(
                    px + 5,
                    py + 25,
                    TILE - 10,
                    16
                );
            }

            if (tile === "C") drawChest(px, py);
            if (tile === "D") drawDoor(px, py);
            if (tile === "X") drawExit(px, py);
        }
    }
}

// =========================================================
// CHEST
// =========================================================

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

// =========================================================
// DOOR
// =========================================================

function drawDoor(x, y) {
    ctx.fillStyle = "#653d25";
    ctx.fillRect(x + 8, y + 4, 32, 44);

    ctx.fillStyle = "#b47b3e";
    ctx.fillRect(x + 13, y + 8, 22, 36);

    ctx.fillStyle = "#f5d65a";
    ctx.fillRect(x + 28, y + 25, 5, 5);
}

// =========================================================
// EXIT
// =========================================================

function drawExit(x, y) {
    ctx.fillStyle = "#253e77";
    ctx.fillRect(x + 5, y + 5, 38, 38);

    ctx.fillStyle = "#5e8fff";
    ctx.fillRect(x + 12, y + 12, 24, 24);

    ctx.fillStyle = "#c4e8ff";
    ctx.fillRect(x + 18, y + 8, 12, 30);
}

// =========================================================
// PLAYER
// =========================================================

function drawPlayer() {
    const x = player.x;
    const y = player.y;

    // SHADOW
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 17, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // BODY
    ctx.fillStyle = "#286b43";
    ctx.fillRect(x - 12, y - 3, 24, 22);

    // HEAD
    ctx.fillStyle = "#e4a66b";
    ctx.fillRect(x - 11, y - 18, 22, 18);

    // HAIR
    ctx.fillStyle = "#54351e";
    ctx.fillRect(x - 11, y - 20, 22, 6);

    // HAT
    ctx.fillStyle = "#3f9b54";
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 18);
    ctx.lineTo(x + 13, y - 18);
    ctx.lineTo(x + 8, y - 29);
    ctx.lineTo(x - 6, y - 29);
    ctx.closePath();
    ctx.fill();

    // EYES
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(x - 7, y - 12, 4, 4);
    ctx.fillRect(x + 3, y - 12, 4, 4);

    // SHIELD
    ctx.fillStyle = "#687f9d";
    ctx.beginPath();
    ctx.arc(x + 15, y + 4, 8, 0, Math.PI * 2);
    ctx.fill();
}

// =========================================================
// PARTICLES
// =========================================================

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life / 0.5);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 5, 5);
    }

    ctx.globalAlpha = 1;
}

// =========================================================
// HUD
// =========================================================

function drawHUD() {
    ctx.fillStyle = "rgba(10,15,15,.82)";
    ctx.fillRect(10, 10, 260, 54);

    for (let i = 0; i < player.maxHealth; i++) {
        drawHeart(
            25 + i * 30,
            36,
            i < player.health
        );
    }

    ctx.fillStyle = "#f4d35e";
    ctx.font = "16px Arial";
    ctx.fillText("Score: " + score, 25, 57);

    if (player.hasKey) {
        ctx.fillStyle = "#ffe45c";
        ctx.fillRect(230, 29, 12, 17);
        ctx.fillText("KEY", 210, 25);
    }

    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";

    ctx.fillText(
        "Room " + (room + 1) + "/3",
        canvas.width - 15,
        30
    );

    ctx.textAlign = "left";
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

// =========================================================
// MESSAGES
// =========================================================

function showMessage(text) {
    const box = document.getElementById("message");

    box.textContent = text;
    box.style.display = "block";

    messageTimer = 2;
}

// =========================================================
// WIN / GAME OVER
// =========================================================

function drawEndScreen() {
    if (!gameOver && !victory) return;

    ctx.fillStyle = "rgba(0,0,0,.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";

    if (victory) {
        ctx.fillStyle = "#f6d365";
        ctx.font = "48px Arial";
        ctx.fillText("VICTORY!", canvas.width / 2, 220);

        ctx.fillStyle = "#fff";
        ctx.font = "22px Arial";

        ctx.fillText(
            "You escaped the Forest Quest!",
            canvas.width / 2,
            265
        );

        ctx.fillText(
            "Score: " + score,
            canvas.width / 2,
            305
        );

        ctx.font = "16px Arial";

        ctx.fillText(
            "Refresh the page to play again.",
            canvas.width / 2,
            350
        );
    } else {
        ctx.fillStyle = "#e85d5d";
        ctx.font = "48px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2, 240);

        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";

        ctx.fillText(
            "Refresh the page to try again.",
            canvas.width / 2,
            290
        );

        ctx.font = "16px Arial";

        ctx.fillText(
            "Final score: " + score,
            canvas.width / 2,
            325
        );
    }

    ctx.textAlign = "left";
}

// =========================================================
// MAIN DRAW
// =========================================================

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    ctx.translate(
        -Math.round(camera.x),
        -Math.round(camera.y)
    );

    drawMap();
    drawPlayer();
    drawParticles();

    ctx.restore();

    drawHUD();
    drawEndScreen();
}

// =========================================================
// START GAME
// =========================================================

snapCameraToPlayer();
draw();
requestAnimationFrame(update);
