const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const {pathfinder, Movements, goals} = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const autoeat = require("mineflayer-auto-eat")
const config = require('./config.json');

const bot = mineflayer.createBot({
  host: config.ip,
  port: config.port,
  username: config.user,
  password: config.pass,
  owner: config.owner,
  logErrors: false
});

bot.loadPlugin(pvp);
bot.loadPlugin(armorManager);
bot.loadPlugin(pathfinder);
bot.loadPlugin(autoeat);

bot.on('spawn', () => {
  const movements = new Movements(bot, require('minecraft-data')(bot.version));
  movements.scafoldingBlocks = [];
  bot.pathfinder.setMovements(movements);

  bot.autoEat.options = {
    priority: "foodPoints",
    startAt: 16,
    bannedFood: ["rotten_flesh"],
  }
  equipSword();
});

// VARIABLES
let guardPos = null;
let home = null;

// ITEM COLLECTION

bot.on('playerCollect', (collector, itemDrop) => {
  if (collector !== bot.entity) return;

  setTimeout(() => {
    equipSword();
  }, 150);

  setTimeout(() => {
    const shield = bot.inventory.items().find(item => item.name.includes('shield'));
    if (shield) bot.equip(shield, 'off-hand');
  }, 250);
});

// KEEP SWORD
function equipSword() {
  const swords = ['wooden', 'stone', 'golden', 'iron', 'diamond', 'netherite'];
  for (var i = 0; i < swords.length; i++) {
    const sword = bot.inventory.items().find(item => item.name.includes(`${swords[i]}_sword`) && !item.name.startsWith());
    if (sword) bot.equip(sword, 'hand');
  }
}

bot.on('startedAttacking', () => {
  equipSword();
});

bot.on('goal_reached', () => {
  if (goingHome) goingHome = false;
  equipSword();
});

// COMMANDS

function say(message) {
  bot.chat(`/msg ${config.owner} ${message}`);
}

bot.on('whisper', (username, message) => {
  if (username !== config.owner) return;

  setTimeout(() => {
    switch(message) {

      case "sethome": {
        const player = bot.players[username];
        if (!player.entity) {
          say("Out of range.");
          return;
        }
        home = player.entity.position.clone();
        say("Home set at your location");
        break;
      }

      case "home": {
        say("Going home.");
        goHome();
        break;
      }

      case "guard": {
        const player = bot.players[username];
        if (!player.entity) {
          say("Out of range.");
          return;
        }
        say("Guarding that location.");
        guardArea(player.entity.position);
        break;
      }

      case "come": {
        const player = bot.players[username];
        if (!player.entity) {
          say("Out of range.");
          return;
        }
        bot.pathfinder.setGoal(new goals.GoalBlock(player.entity.position.x, player.entity.position.y, player.entity.position.z));
        break;
      }

      case "follow": {
        const player = bot.players[username];
        if (!player.entity) {
          say("Out of range.");
          return;
        }
        bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
        break;
      }

      case "stop": {
        say("Stopped.");
        stopGuarding();
        break;
      }

      default: {
        bot.chat(message);
        break;
      }
    }
  }, 150);


});

// GUARDING FUNCTIONS

function guardArea(pos) {
  guardPos = pos.clone();
  if (!bot.pvp.target) {
    moveToGuardPos();
  }
}

function moveToGuardPos() {
  bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
}

function stopGuarding() {
  guardPos = null;
  bot.pvp.stop();
  bot.pathfinder.setGoal(null);
}

// ATTACK

bot.on('physicTick', () => {
  if (!guardPos) return;
  const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 && e.position.y - bot.entity.position.y >= -3;
  const entity = bot.nearestEntity(filter);
  if (entity && entity.kind.toString().toLowerCase().includes('hostile')) bot.pvp.attack(entity);
});

bot.on('stoppedAttacking', () => {
  if (guardPos) moveToGuardPos();
});

// LOOK

bot.on('physicTick', () => {
  if (bot.pvp.target) return;
  if (bot.pathfinder.isMoving()) return;

  const entity = bot.nearestEntity(e => e.position.y - bot.entity.position.y >= -3);
  if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
});

// SELF CARE

function goHome() {
  if (home) {
    stopGuarding();
    bot.pathfinder.setGoal(new goals.GoalBlock(home.x, home.y, home.z));
  } else {
    say("No home set, continuing any active tasks.");
  }
}

let goingHome = false;

bot.on('health', () => {
  if (bot.health < 4) {
    if (!goingHome) {
      goingHome = true;
      say("Low health, returning home.");
      goHome();
    }
  }

  if (bot.food === 20) bot.autoEat.disable()
  else bot.autoEat.enable()
});

bot.on("autoeat_stopped", () => {
  setTimeout(() => {
    equipSword();
  }, 150);
});
