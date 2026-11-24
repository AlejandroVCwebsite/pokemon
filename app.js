
let xp = 0;
let health = 100;
let gold = 50;
let currentMonster = null;

const xpText = document.getElementById("xpText");
const healthText = document.getElementById("healthText");
const goldText = document.getElementById("goldText");
const text = document.getElementById("text");
const monsterStats = document.getElementById("monsterStats");
const monsterName = document.getElementById("monsterName");
const monsterHealth = document.getElementById("monsterHealth");
const gameImage = document.getElementById("img");

const buttons = [
  document.getElementById("button1"),
  document.getElementById("button2"),
  document.getElementById("button3"),
  document.getElementById("button4")
];

const monsters = [
  { name: "Mr. Homework", health: 20, reward: 10 },
  { name: "Mrs. Test", health: 40, reward: 20 },
  { name: "The Head Teacher", health: 100, reward: 50 }
];

function updateStats() {
  xpText.textContent = xp;
  healthText.textContent = health;
  goldText.textContent = gold;
}

function showMessage(message) {
  text.textContent = message;
}

function showMonster() {
  monsterStats.style.display = "flex";
  monsterName.textContent = currentMonster.name;
  monsterHealth.textContent = currentMonster.health;
}

function hideMonster() {
  monsterStats.style.display = "none";
}

function setButtons(labels, actions) {
  buttons.forEach((button, index) => {
    button.textContent = labels[index];
    button.onclick = actions[index];
  });
}

function goDiningRoom() {
  hideMonster();
  currentMonster = null;

  setButtons(
    ["Go to Shop", "Go to Castle", "Go to Cave", "Fight Boss"],
    [goShop, goCastle, goCave, fightBoss]
  );

  gameImage.src = "start.png";

  showMessage(
    "Welcome to the BM Teacher Battle Arena! You are in the dining room. Where do you want to go?"
  );
}

function goShop() {
  hideMonster();

  setButtons(
    ["Buy Health (10 Gold)", "Buy Weapon (30 Gold)", "Fight Teachers", "Return"],
    [buyHealth, buyWeapon, goCave, goDiningRoom]
  );

  showMessage(
    "Welcome to the shop! Buy health or upgrade your weapon."
  );
}

function buyHealth() {
  if (gold >= 10) {
    if (health >= 100) {
      showMessage("Your health is already full!");
      return;
    }

    gold -= 10;
    health = Math.min(100, health + 25);
    updateStats();
    showMessage("You bought 25 health points!");
  } else {
    showMessage("Not enough gold!");
  }
}

function buyWeapon() {
  if (gold >= 30) {
    gold -= 30;
    xp += 5;
    updateStats();
    showMessage("You bought a stronger weapon! You gained 5 XP.");
  } else {
    showMessage("Not enough gold!");
  }
}

function goCastle() {
  hideMonster();

  setButtons(
    ["Train (+10 XP)", "Restore Health", "Fight Boss", "Return"],
    [train, restoreHealth, fightBoss, goDiningRoom]
  );

  showMessage(
    "You are at the castle. Prepare yourself for battle!"
  );
}

function train() {
  xp += 10;
  updateStats();
  showMessage("You trained hard and gained 10 XP!");
}

function restoreHealth() {
  health = 100;
  updateStats();
  showMessage("Your health has been restored!");
}

function goCave() {
  startFight(monsters[0]);
}

function fightBoss() {
  startFight(monsters[2]);
}

function startFight(monster) {
  currentMonster = { ...monster };
  showMonster();

  setButtons(
    ["Attack", "Dodge", "Run Away", "Return"],
    [attack, dodge, runAway, goDiningRoom]
  );

  showMessage(
    "A teacher appears! " + currentMonster.name +
    " is ready to battle. Choose your move!"
  );
}

function attack() {
  if (!currentMonster) return;

  const damage = Math.floor(Math.random() * 10) + 5;
  currentMonster.health -= damage;

  if (currentMonster.health <= 0) {
    currentMonster.health = 0;
    monsterHealth.textContent = 0;
    winFight();
    return;
  }

  const enemyDamage = Math.floor(Math.random() * 8) + 3;
  health -= enemyDamage;

  if (health <= 0) {
    health = 0;
    updateStats();
    loseGame();
    return;
  }

  updateStats();
  showMonster();

  showMessage(
    "You dealt " + damage + " damage! " +
    currentMonster.name + " dealt " + enemyDamage +
    " damage to you."
  );
}

function dodge() {
  if (!currentMonster) return;

  const success = Math.random() > 0.4;

  if (success) {
    showMessage("You dodged the teacher's attack!");
  } else {
    health -= 10;

    if (health <= 0) {
      health = 0;
      updateStats();
      loseGame();
      return;
    }

    showMessage("You failed to dodge and lost 10 health!");
  }

  updateStats();
}

function runAway() {
  currentMonster = null;
  goDiningRoom();
  showMessage("You escaped the battle safely!");
}

function winFight() {
  const reward = currentMonster.reward;

  xp += 10;
  gold += reward;
  currentMonster = null;

  updateStats();
  hideMonster();

  setButtons(
    ["Go to Shop", "Go to Castle", "Go to Cave", "Fight Boss"],
    [goShop, goCastle, goCave, fightBoss]
  );

  showMessage(
    "You defeated the teacher! You earned 10 XP and " +
    reward + " gold. Congratulations!"
  );
}

function loseGame() {
  currentMonster = null;
  hideMonster();

  setButtons(
    ["Restart Game", "Restart Game", "Restart Game", "Restart Game"],
    [restartGame, restartGame, restartGame, restartGame]
  );

  showMessage(
    "GAME OVER! The teachers defeated you. Click a button to try again."
  );
}

function restartGame() {
  xp = 0;
  health = 100;
  gold = 50;
  currentMonster = null;

  updateStats();
  goDiningRoom();

  showMessage("New game started! Good luck!");
}

updateStats();
goDiningRoom();
