import { Room, Client } from "colyseus";
import { GameState, PlayerState, MapObject, EnemyState } from "../schema/GameState";
import fs from "fs";
import path from "path";
import https from "https";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input message payload sent from the client each tick (~20Hz) */
interface InputPayload {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  run?: boolean;
}

/** Per-client mutable input buffer — stored server-side, not in schema */
interface ClientInput extends InputPayload {
  sessionId: string;
}

/** Join options sent by the client when connecting */
interface JoinOptions {
  username?:     string;
  gender?:       "male" | "female";
  skinTone?:     number;
  eyeColor?:     string;
  clothesColor?: string;
  hairStyle?:    string;
  hairColor?:    string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Movement speed in pixels per second */
const PLAYER_SPEED = 200;

/** World dimensions — must match client-side constants */
const WORLD_WIDTH = 1500;
const WORLD_HEIGHT = 2500;

/** Starting spawn area (players spawn near center) */
const SPAWN_CENTER_X = WORLD_WIDTH / 2;
const SPAWN_CENTER_Y = WORLD_HEIGHT / 2;
const SPAWN_RADIUS = 200;

/**
 * A pool of visually distinct colors assigned round-robin to joining players.
 * Keeping this server-side ensures all clients agree on who has which color.
 */
const PLAYER_COLORS = [
  "#e74c3c", // red
  "#3498db", // blue
  "#2ecc71", // green
  "#f39c12", // orange
  "#9b59b6", // purple
  "#1abc9c", // teal
  "#e91e63", // pink
  "#00bcd4", // cyan
  "#ff5722", // deep orange
  "#8bc34a", // light green
];

// ---------------------------------------------------------------------------
// GameRoom
// ---------------------------------------------------------------------------

export class GameRoom extends Room<GameState> {
  /**
   * Server-side input buffer: sessionId → latest ClientInput.
   * We store inputs here (NOT in the schema) so they are never sent over the wire.
   * The simulation loop reads from this map every tick.
   */
  private inputBuffer = new Map<string, ClientInput>();

  /** Round-robin color index */
  private colorIndex = 0;

  /** Reference to the fixed-step simulation interval */
  private simulationInterval!: ReturnType<typeof setInterval>;

  /** Map to track fishing timeouts for each player */
  private playerFishingTimeout = new Map<string, any>();
  private playerPetIdleTime = new Map<string, number>();
  private cropAccumulator = 0;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  onCreate(_options: unknown): void {
    // Initialize the shared game state
    this.setState(new GameState());

    // Spawn 5 test tilled soils near spawn center for testing farming system
    const testSoils = [
      { id: "test_soil_1", x: SPAWN_CENTER_X - 64, y: SPAWN_CENTER_Y - 100 },
      { id: "test_soil_2", x: SPAWN_CENTER_X - 32, y: SPAWN_CENTER_Y - 100 },
      { id: "test_soil_3", x: SPAWN_CENTER_X,       y: SPAWN_CENTER_Y - 100 },
      { id: "test_soil_4", x: SPAWN_CENTER_X + 32, y: SPAWN_CENTER_Y - 100 },
      { id: "test_soil_5", x: SPAWN_CENTER_X + 64, y: SPAWN_CENTER_Y - 100 }
    ];

    testSoils.forEach(soil => {
      const obj = new MapObject();
      obj.id = soil.id;
      obj.assetId = "tilled_soil_dry";
      obj.x = soil.x;
      obj.y = soil.y;
      obj.depthLayer = "below";
      obj.cropType = "none";
      obj.cropStage = 0;
      obj.cropWatered = false;
      this.state.mapObjects.set(obj.id, obj);
    });

    // Load any saved map objects from disk
    this.loadMapFromDisk();

    // Maximum players per room
    this.maxClients = 50;

    // Register message handler for client input.
    // "input" is the channel name — must match client-side send call.
    this.onMessage("input", (client: Client, input: InputPayload) => {
      // Validate the incoming payload to prevent injection / malformed data
      const sanitized: ClientInput = {
        sessionId: client.sessionId,
        left:  Boolean(input?.left),
        right: Boolean(input?.right),
        up:    Boolean(input?.up),
        down:  Boolean(input?.down),
        run:   Boolean(input?.run),
      };
      this.inputBuffer.set(client.sessionId, sanitized);
    });

    // Register message handler for equipping hats.
    this.onMessage("equip_hat", (client: Client, message: { hat: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const validHats = [
        "", // no hat
        "Beret",
        "Chicken",
        "Cook",
        "Cow",
        "Deer",
        "Farm",
        "Frog",
        "Leprechaun",
        "Pirate eyepatch",
        "Pirate",
        "Santa Hat",
        "Wizard"
      ];

      const chosenHat = String(message?.hat ?? "");
      if (validHats.includes(chosenHat)) {
        player.hat = chosenHat;
        console.log(`[GameRoom] Player ${player.name} equipped hat: "${chosenHat}"`);
      }
    });

    // Register message handler for opening a pet box
    this.onMessage("open_pet_box", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const petOptions = [
        "pet_cat_black",
        "pet_cat_brown",
        "pet_cat_ginger",
        "pet_cat_gray",
        "pet_cat_light_brown",
        "pet_cat_light_gray",
        "pet_cat_pink",
        "pet_cat_white",
        "pet_dog_1",
        "pet_dog_2",
        "pet_dog_3",
        "pet_dog_4",
        "pet_dog_5",
        "pet_dog_6",
        "pet_dog_7",
        "pet_dog_8"
      ];
      const randomPet = petOptions[Math.floor(Math.random() * petOptions.length)];

      player.petType = randomPet;
      player.petX = player.x - 30;
      player.petY = player.y;
      player.petDirection = "down";
      player.petAction = "idle";
      this.playerPetIdleTime.delete(client.sessionId);

      console.log(`[GameRoom] Player ${player.name} opened a pet box and got: ${randomPet}`);
    });

    // Register message handler for planting seeds
    this.onMessage("plant_seed", (client: Client, message: { seedType: string, x: number, y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const seedType = message.seedType; // "apple", "carrot", "wheat"
      const seedCount = player.seeds.get(seedType) || 0;
      if (seedCount <= 0) {
        client.send("error", { message: "Tohumunuz yok!" });
        return;
      }

      // Find the closest tilled soil in range of (message.x, message.y)
      let targetSoil: any = null;
      let closestDist = Infinity;
      this.state.mapObjects.forEach((obj: any) => {
        if (obj.assetId && (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet")) {
          const dx = obj.x - message.x;
          const dy = obj.y - message.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            targetSoil = obj;
          }
        }
      });

      // Target soil must be within 16px of mouse click and 80px of player
      if (targetSoil && closestDist < 16) {
        const distToPlayer = Math.sqrt((targetSoil.x - player.x) ** 2 + (targetSoil.y - player.y) ** 2);
        if (distToPlayer > 80) {
          client.send("error", { message: "Çok uzaktasınız!" });
          return;
        }

        if (targetSoil.cropType !== "none") {
          client.send("error", { message: "Bu tarlada zaten ekin var!" });
          return;
        }

        // Deduct seed
        player.seeds.set(seedType, seedCount - 1);

        // Plant
        targetSoil.cropType = seedType;
        targetSoil.cropStage = 0;
        targetSoil.cropGrowthProgress = 0;
        targetSoil.cropGrowthNeeded = 10; // 10 seconds growth per stage

        client.send("seed_planted", { seedType });
        console.log(`[GameRoom] Player ${player.name} planted ${seedType} at (${targetSoil.x}, ${targetSoil.y})`);
      }
    });

    // Register message handler for buying seeds
    this.onMessage("buy_seed", (client: Client, message: { seedType: string, quantity: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const seedType = message.seedType;
      const qty = message.quantity || 1;
      const currentSeeds = player.seeds.get(seedType) || 0;
      player.seeds.set(seedType, currentSeeds + qty);
      console.log(`[GameRoom] Player ${player.name} bought ${qty} ${seedType} seeds`);
    });

    // Register message handler for selling harvests
    this.onMessage("sell_harvest", (client: Client, message: { cropType: string, quantity: number, price: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const cropType = message.cropType;
      const qty = message.quantity || 1;
      const currentCrops = player.harvests.get(cropType) || 0;
      if (currentCrops >= qty) {
        player.harvests.set(cropType, currentCrops - qty);
        const goldReward = message.price * qty;
        client.send("gold_change", { change: goldReward });
        console.log(`[GameRoom] Player ${player.name} sold ${qty} ${cropType} for ${goldReward} gold`);
      } else {
        client.send("error", { message: "Satacak yeterli mahsulünüz yok!" });
      }
    });

    // Register message handler for equipping tools
    this.onMessage("equip_tool", (client: Client, message: { tool: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const validTools = [
        "none", "bug_net", 
        "seed_apple", "seed_carrot", "seed_wheat", 
        "seed_adzuki_bean", "seed_bell_pepper", "seed_blackberry", 
        "seed_cucumber", "seed_green_beans", "seed_hot_pepper", 
        "seed_melon", "seed_pineapple", "seed_sunflower",
        "seed_tomato", "seed_watermelon", "seed_asparagus",
        "seed_blueberry", "seed_broccoli", "seed_cabbage",
        "seed_cauliflower", "seed_onion", "seed_parsnip",
        "seed_potato", "seed_rice", "seed_spring_onion",
        "seed_strawberry"
      ];
      for (let i = 1; i <= 10; i++) {
        validTools.push(`pickaxe_${i}`);
        validTools.push(`hoe_${i}`);
        validTools.push(`axe_${i}`);
        validTools.push(`sickle_${i}`);
        validTools.push(`shovel_${i}`);
        validTools.push(`watering_${i}`);
        validTools.push(`sword_${i}`);
        validTools.push(`archer_${i}`);
        validTools.push(`fishing_${i}`);
      }

      const chosenTool = String(message?.tool ?? "none");
      if (validTools.includes(chosenTool)) {
        player.equippedTool = chosenTool;
        console.log(`[GameRoom] Player ${player.name} equipped tool: "${chosenTool}"`);
      }
    });

    // Register message handler for equipping armor
    this.onMessage("equip_armor", (client: Client, message: { slot: string, itemId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const slot = String(message?.slot ?? "");
      const itemId = String(message?.itemId ?? "none");

      if (slot === "helmet") {
        player.helmet = itemId;
      } else if (slot === "chestplate") {
        player.chestplate = itemId;
      } else if (slot === "leggings") {
        player.leggings = itemId;
      } else if (slot === "boots") {
        player.boots = itemId;
      }

      this.recalculatePlayerStats(player);
      console.log(`[GameRoom] Player ${player.name} equipped ${slot}: "${itemId}". New MaxHP: ${player.maxHp}, CurrentHP: ${player.hp}`);
    });

    // Register message handler for using tools
    this.onMessage("use_tool", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const sessionId = client.sessionId;

      // If they are currently in a fishing waiting phase, using the tool again cancels fishing!
      if (player.action === "fish_wait") {
        this.cancelFishing(sessionId);
        player.action = "none";
        console.log(`[GameRoom] Player ${player.name} cancelled fishing`);
        return;
      }

      // If they are in the bite phase, using the tool reels in the fish!
      if (player.action === "fish_bite") {
        // Clear escape timeout
        const escapeTimeout = this.playerFishingTimeout.get(sessionId + "_escape");
        if (escapeTimeout) {
          escapeTimeout.clear();
          this.playerFishingTimeout.delete(sessionId + "_escape");
        }
        
        player.action = "fish_reel";
        console.log(`[GameRoom] Player ${player.name} is reeling in!`);

        // Reeling takes 1500ms
        const reelTimeout = this.clock.setTimeout(() => {
          player.action = "fish_catch";
          console.log(`[GameRoom] Player ${player.name} caught the fish!`);

          // Catch animation takes 1000ms
          const catchTimeout = this.clock.setTimeout(() => {
            player.action = "none";
            const tier = player.equippedTool.startsWith("fishing_")
              ? parseInt(player.equippedTool.replace("fishing_", ""), 10)
              : 1;
            const reward = tier * 15;
            client.send("fish_caught", { gold: reward });
            this.playerFishingTimeout.delete(sessionId + "_catch");
          }, 1000);
          this.playerFishingTimeout.set(sessionId + "_catch", catchTimeout);
          this.playerFishingTimeout.delete(sessionId + "_reel");
        }, 1500);
        this.playerFishingTimeout.set(sessionId + "_reel", reelTimeout);
        return;
      }

      // If they are already casting, reeling, catching, taking damage, or dead, ignore input
      if (player.action !== "none") return;

      // Start tool actions
      if (player.equippedTool !== "none") {
        if (player.equippedTool.startsWith("horse")) {
          player.action = "horse_eat";
          console.log(`[GameRoom] Player ${player.name}'s horse is eating...`);

          // Horse eating sequence takes 2000ms
          this.clock.setTimeout(() => {
            player.action = "none";
          }, 2000);
        } else if (player.equippedTool.startsWith("bear")) {
          player.action = "bear_attack";
          console.log(`[GameRoom] Player ${player.name}'s bear is attacking...`);

          // Bear attack sequence takes 600ms
          this.clock.setTimeout(() => {
            player.action = "none";
          }, 600);
        } else if (player.equippedTool.startsWith("fishing_")) {
          player.action = "fish_cast";
          console.log(`[GameRoom] Player ${player.name} cast their fishing line`);

          // Cast takes 1500ms (15 frames @ 100ms)
          const castTimeout = this.clock.setTimeout(() => {
            player.action = "fish_wait";
            console.log(`[GameRoom] Player ${player.name} is waiting for a bite...`);

            // Schedule a bite in 3000ms - 6000ms
            const biteTimeout = this.clock.setTimeout(() => {
              player.action = "fish_bite";
              console.log(`[GameRoom] A fish bit Player ${player.name}'s hook!`);

              // Player has 1500ms to react
              const escapeTimeout = this.clock.setTimeout(() => {
                player.action = "none";
                console.log(`[GameRoom] The fish got away from Player ${player.name}`);
                this.playerFishingTimeout.delete(sessionId + "_escape");
              }, 1500);
              this.playerFishingTimeout.set(sessionId + "_escape", escapeTimeout);
              this.playerFishingTimeout.delete(sessionId + "_bite");
            }, Math.floor(3000 + Math.random() * 3000));
            
            this.playerFishingTimeout.set(sessionId + "_bite", biteTimeout);
            this.playerFishingTimeout.delete(sessionId + "_cast");
          }, 1500);
          this.playerFishingTimeout.set(sessionId + "_cast", castTimeout);
        } else {
          // Standard tool action
          player.action = player.equippedTool;
          console.log(`[GameRoom] Player ${player.name} triggered tool action: "${player.action}"`);

          const isAxe = player.equippedTool.startsWith("axe_");
          if (isAxe) {
            // Find closest tree in range
            let closestTree: MapObject | null = null;
            let closestDist = Infinity;

            this.state.mapObjects.forEach((obj) => {
              if (obj.assetId && obj.assetId.startsWith("maple_tree_") && (obj.treeState === "grown" || obj.treeState === "")) {
                const dx = obj.x - player.x;
                const dy = obj.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestTree = obj;
                }
              }
            });

            // If a tree is within reach (60 pixels)
            if (closestTree && closestDist < 60) {
              const tree = closestTree as MapObject;
              tree.treeHp -= 1;
              tree.treeHitFlash = true;

              console.log(`[GameRoom] Player ${player.name} hit tree ${tree.id}. HP left: ${tree.treeHp}`);

              // Reset flash in 80ms
              this.clock.setTimeout(() => {
                tree.treeHitFlash = false;
              }, 80);

              // Check if tree is chopped down (10 hits)
              if (tree.treeHp <= 0) {
                // Transition directly to stump state
                tree.treeState = "stump";
                tree.treeHp = 0;
                client.send("wood_cut", { gold: 25, item: "Akçaağaç Odunu", message: "kutuk" });
                console.log(`[GameRoom] Tree ${tree.id} turned stump`);

                // Start 20-second regrowth timer
                this.clock.setTimeout(() => {
                  if (this.state.mapObjects.get(tree.id) !== tree) return;
                  if (tree.treeState === "stump") {
                    tree.treeState = "grown";
                    tree.treeHp = 10;
                    console.log(`[GameRoom] Tree ${tree.id} fully grew back!`);
                  }
                }, 20000);
              }
            }
          }

          const isPickaxe = player.equippedTool.startsWith("pickaxe_") || player.equippedTool === "pickaxe";
          if (isPickaxe) {
            // Find closest mine in range
            let closestMine: MapObject | null = null;
            let closestDist = Infinity;

            this.state.mapObjects.forEach((obj) => {
              if (obj.assetId && obj.assetId.startsWith("mineral_mine_") && !obj.assetId.startsWith("mineral_mine_double_") && (obj.treeState === "grown" || obj.treeState === "")) {
                const dx = obj.x - player.x;
                const dy = obj.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestMine = obj;
                }
              }
            });

            // If a mine is within reach (60 pixels)
            if (closestMine && closestDist < 60) {
              const mine = closestMine as MapObject;
              mine.treeHp -= 1;
              mine.treeHitFlash = true;

              console.log(`[GameRoom] Player ${player.name} hit mine ${mine.id}. HP left: ${mine.treeHp}`);

              // Reset flash in 80ms
              this.clock.setTimeout(() => {
                mine.treeHitFlash = false;
              }, 80);

              // Check if mine is depleted (10 hits)
              if (mine.treeHp <= 0) {
                mine.treeState = "stump"; // depleted
                mine.treeHp = 0;

                const typeIdx = parseInt(mine.assetId.replace("mineral_mine_", ""), 10) || 1;

                // Mineral types and reward definitions (8 types matching client's standing crystals)
                const minerals: { [key: number]: { name: string, gold: number } } = {
                  1: { name: "Bakır Cevheri",   gold: 50  },
                  2: { name: "Gümüş Cevheri",   gold: 80  },
                  3: { name: "Altın Cevheri",   gold: 100 },
                  4: { name: "Ametist Cevheri",  gold: 120 },
                  5: { name: "Yakut Cevheri",   gold: 150 },
                  6: { name: "Zümrüt Cevheri",  gold: 180 },
                  7: { name: "Safir Cevheri",   gold: 160 },
                  8: { name: "Obsidyen Cevheri", gold: 40  }
                };

                const minInfo = minerals[typeIdx] || { name: "Değerli Maden", gold: 50 };
                const rewardGold = minInfo.gold;
                const rewardName = minInfo.name;

                client.send("mine_mined", { gold: rewardGold, item: rewardName });
                console.log(`[GameRoom] Mine ${mine.id} depleted. Reward: ${rewardName}`);

                // Start 20-second regrowth timer
                this.clock.setTimeout(() => {
                  if (this.state.mapObjects.get(mine.id) !== mine) return;
                  if (mine.treeState === "stump") {
                    mine.treeState = "grown";
                    mine.treeHp = 10;
                    console.log(`[GameRoom] Mine ${mine.id} fully grew back!`);
                  }
                }, 20000);
              }
            }
          }

          const isHoe = player.equippedTool.startsWith("hoe_") || player.equippedTool === "hoe";
          if (isHoe) {
            const tx = Math.round(player.x / 32) * 32;
            const ty = Math.round(player.y / 32) * 32;
            let exists = false;
            this.state.mapObjects.forEach((obj: any) => {
              if (Math.round(obj.x) === tx && Math.round(obj.y) === ty && obj.depthLayer === "below") {
                exists = true;
              }
            });
            if (!exists) {
              const objId = `tilled_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const tilledSoil = new MapObject();
              tilledSoil.id = objId;
              tilledSoil.assetId = "tilled_soil_dry";
              tilledSoil.x = tx;
              tilledSoil.y = ty;
              tilledSoil.depthLayer = "below";
              tilledSoil.cropType = "none";
              tilledSoil.cropStage = 0;
              tilledSoil.cropWatered = false;
              this.state.mapObjects.set(objId, tilledSoil);
              console.log(`[GameRoom] Player ${player.name} tilled soil at (${tx}, ${ty})`);
            }
          }

          const isWatering = player.equippedTool.startsWith("watering_") || player.equippedTool === "watering";
          if (isWatering) {
            let closestSoil: any = null;
            let closestDist = Infinity;
            this.state.mapObjects.forEach((obj: any) => {
              if (obj.assetId && (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet")) {
                const dx = obj.x - player.x;
                const dy = obj.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestSoil = obj;
                }
              }
            });
            if (closestSoil && closestDist < 60) {
              closestSoil.cropWatered = true;
              closestSoil.assetId = "tilled_soil_wet";
              console.log(`[GameRoom] Player ${player.name} watered soil ${closestSoil.id}`);
            }
          }

          const isSickle = player.equippedTool.startsWith("sickle_") || player.equippedTool === "sickle";
          if (isSickle) {
            let closestSoil: any = null;
            let closestDist = Infinity;
            this.state.mapObjects.forEach((obj: any) => {
              if (obj.assetId && (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet") && obj.cropType !== "none") {
                const dx = obj.x - player.x;
                const dy = obj.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestSoil = obj;
                }
              }
            });
            if (closestSoil && closestDist < 60) {
              if (closestSoil.cropStage === 3) {
                const cType = closestSoil.cropType;
                const currentCount = player.harvests.get(cType) || 0;
                player.harvests.set(cType, currentCount + 1);
                client.send("harvested", { item: cType, quantity: 1 });
                console.log(`[GameRoom] Player ${player.name} harvested crop ${cType}`);
                closestSoil.cropType = "none";
                closestSoil.cropStage = 0;
                closestSoil.cropWatered = false;
                closestSoil.cropGrowthProgress = 0;
                closestSoil.assetId = "tilled_soil_dry";
              }
            }
          }

          const isSeed = player.equippedTool.startsWith("seed_");
          if (isSeed) {
            const seedType = player.equippedTool.replace("seed_", "");
            const seedCount = player.seeds.get(seedType) || 0;
            if (seedCount > 0) {
              let closestSoil: any = null;
              let closestDist = Infinity;
              this.state.mapObjects.forEach((obj: any) => {
                if (obj.assetId && (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet")) {
                  const dx = obj.x - player.x;
                  const dy = obj.y - player.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < closestDist) {
                    closestDist = dist;
                    closestSoil = obj;
                  }
                }
              });

              if (closestSoil && closestDist < 60) {
                if (closestSoil.cropType === "none") {
                  player.seeds.set(seedType, seedCount - 1);
                  closestSoil.cropType = seedType;
                  closestSoil.cropStage = 0;
                  closestSoil.cropGrowthProgress = 0;
                  closestSoil.cropGrowthNeeded = 10;

                  client.send("seed_planted", { seedType });
                  console.log(`[GameRoom] Player ${player.name} planted ${seedType} at (${closestSoil.x}, ${closestSoil.y})`);
                  
                  if (seedCount - 1 <= 0) {
                    player.equippedTool = "none";
                  }
                } else {
                  client.send("error", { message: "Bu tarlada zaten ekin var!" });
                }
              } else {
                client.send("error", { message: "Tohum ekmek için sürülmüş tarlaya yaklaşın!" });
              }
            } else {
              client.send("error", { message: "Tohumunuz yok!" });
              player.equippedTool = "none";
            }
          }

          const duration = player.equippedTool.startsWith("watering_")
            ? 1280
            : player.equippedTool.startsWith("shovel_")
            ? 500
            : player.equippedTool.startsWith("sword_")
            ? 1000
            : player.equippedTool.startsWith("archer_")
            ? 700
            : 600;
          this.clock.setTimeout(() => {
            player.action = "none";
          }, duration);
        }
      }
    });

    // Register message handler for taking damage
    this.onMessage("take_damage", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Allow damage action if they are not already in a damage stun
      if (player.action !== "damage") {
        player.action = "damage";
        console.log(`[GameRoom] Player ${player.name} took damage`);

        // Reset action back to none after 400ms (4 frames @ 100ms)
        this.clock.setTimeout(() => {
          player.action = "none";
        }, 400);
      }
    });

    // Register message handler for dying
    this.onMessage("die", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.action !== "death") {
        player.action = "death";
        player.hp = 0;
        console.log(`[GameRoom] Player ${player.name} died`);
      }
    });

    // Register message handler for respawning
    this.onMessage("respawn", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.action === "death") {
        player.action = "none";
        player.hp = 100;
        player.x = SPAWN_CENTER_X + (Math.random() - 0.5) * SPAWN_RADIUS;
        player.y = SPAWN_CENTER_Y + (Math.random() - 0.5) * SPAWN_RADIUS;
        console.log(`[GameRoom] Player ${player.name} respawned`);
      }
    });

    // Register message handler for hitting enemies (with potion boost and reach check)
    this.onMessage("hit_enemy", (client: Client, message: { enemyId: string; hasBoost?: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.action === "death") return;

      const enemy = this.state.enemies.get(message?.enemyId);
      if (!enemy || enemy.action === "dead") return;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const isArcher = player.equippedTool.startsWith("archer_");
      const isSword = player.equippedTool.startsWith("sword_");
      const reach = isArcher ? 220 : 75;

      if (dist <= reach) {
        let baseDmg = 25;
        if (isArcher) {
          const tier = parseInt(player.equippedTool.replace("archer_", ""), 10) || 1;
          baseDmg = 20 + tier * 5;
        } else if (isSword) {
          const tier = parseInt(player.equippedTool.replace("sword_", ""), 10) || 1;
          baseDmg = Math.round(tier * 12 + 8);
        } else {
          // Default melee (fists/other tools)
          baseDmg = 14;
        }

        if (message.hasBoost) {
          baseDmg = Math.round(baseDmg * 1.1); // +10% Goblin Damage Potion Boost!
        }

        enemy.hp -= baseDmg;
        enemy.hitFlash = true;

        console.log(`[GameRoom] Player ${player.name} hit enemy ${enemy.id} for ${baseDmg} dmg. Remaining HP: ${enemy.hp}`);

        this.clock.setTimeout(() => {
          if (enemy) enemy.hitFlash = false;
        }, 100);

        if (enemy.hp <= 0) {
          enemy.hp = 0;
          enemy.action = "dead";
          const goldReward = enemy.type === "goblin_merchant" ? 500 : Math.round(35 + Math.random() * 40);
          client.send("enemy_killed", { gold: goldReward, type: enemy.type });

          this.clock.setTimeout(() => {
            if (this.state.enemies.get(enemy.id) !== enemy) return;
            enemy.hp = enemy.maxHp;
            enemy.action = "idle";
            enemy.x = enemy.homeX;
            enemy.y = enemy.homeY;
          }, 20000);
        } else {
          if (enemy.action !== "attack") {
            enemy.action = "damage";
            this.clock.setTimeout(() => {
              if (enemy.action === "damage") enemy.action = "idle";
            }, 300);
          }
        }
      }
    });

    // Register message handler for picking up cargo
    this.onMessage("pick_up", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Allow pick up action if they are completely idle and not currently carrying
      if (player.action === "none" && player.equippedTool === "none") {
        player.action = "carry_pick";
        console.log(`[GameRoom] Player ${player.name} is picking up cargo...`);

        // Bending down to pick up cargo takes 500ms
        this.clock.setTimeout(() => {
          player.action = "none";
          player.equippedTool = "carrying";
          console.log(`[GameRoom] Player ${player.name} is now carrying cargo`);
        }, 500);
      }
    });

    // Register message handler for throwing cargo
    this.onMessage("throw", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Allow throw action if they are currently carrying and idle
      if (player.action === "none" && player.equippedTool === "carrying") {
        player.action = "carry_throw";
        console.log(`[GameRoom] Player ${player.name} is throwing cargo...`);

        // Throwing cargo takes 500ms
        this.clock.setTimeout(() => {
          player.action = "none";
          player.equippedTool = "none";
          console.log(`[GameRoom] Player ${player.name} threw cargo`);
        }, 500);
      }
    });

    // Register message handler for horse mounting
    this.onMessage("mount_horse", (client: Client, data?: { variant?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const targetVariant = data?.variant || 1;

      if (player.mount === `horse_${targetVariant}`) {
        // Dismount horse if equipping the same horse
        player.mount = "none";
        console.log(`[GameRoom] Player ${player.name} dismounted horse`);
      } else if (player.action === "none") {
        // Mount horse or switch horse variant
        player.mount = `horse_${targetVariant}`;
        console.log(`[GameRoom] Player ${player.name} mounted horse_${targetVariant}!`);
      }
    });

    // Register message handler for bicycle mounting
    this.onMessage("mount_bicycle", (client: Client, data?: { color?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const color = data?.color || "Red";

      if (player.mount === `bicycle_${color}`) {
        // Dismount
        player.mount = "none";
        console.log(`[GameRoom] Player ${player.name} dismounted bicycle`);
      } else if (player.action === "none") {
        // Mount bicycle
        player.mount = `bicycle_${color}`;
        console.log(`[GameRoom] Player ${player.name} mounted bicycle_${color}!`);
      }
    });

    // Register message handler for bear mounting
    this.onMessage("mount_bear", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.mount === "bear_Brown") {
        // Dismount
        player.mount = "none";
        console.log(`[GameRoom] Player ${player.name} dismounted bear`);
      } else if (player.action === "none") {
        // Mount bear
        player.mount = "bear_Brown";
        console.log(`[GameRoom] Player ${player.name} mounted grizzly bear!`);
      }
    });

    // Register message handler for climbing toggle
    this.onMessage("climb", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.action === "climb") {
        player.action = "none";
        console.log(`[GameRoom] Player ${player.name} stopped climbing`);
      } else if (player.action === "none" && player.equippedTool === "none") {
        player.action = "climb";
        console.log(`[GameRoom] Player ${player.name} started climbing`);
      }
    });

    // Register message handler for broomstick mounting
    this.onMessage("mount_broomstick", (client: Client, data?: { variant?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const variant = data?.variant || 1;

      if (player.mount === `broomstick_${variant}`) {
        // Dismount
        player.mount = "none";
        console.log(`[GameRoom] Player ${player.name} dismounted broomstick`);
      } else if (player.action === "none") {
        // Mount broomstick
        player.mount = `broomstick_${variant}`;
        console.log(`[GameRoom] Player ${player.name} mounted broomstick_${variant}!`);
      }
    });

    // Register message handler for tractor mounting
    this.onMessage("mount_tractor", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.mount === "tractor") {
        // Dismount
        player.mount = "none";
        console.log(`[GameRoom] Player ${player.name} dismounted tractor`);
      } else if (player.action === "none") {
        // Mount tractor
        player.mount = "tractor";
        console.log(`[GameRoom] Player ${player.name} mounted tractor!`);
      }
    });

    // Register message handler for diving
    this.onMessage("dive", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (player.action === "swim") {
        player.action = "swim_submerged";
        console.log(`[GameRoom] Player ${player.name} dove underwater`);
      } else if (player.action === "swim_submerged") {
        player.action = "swim";
        console.log(`[GameRoom] Player ${player.name} surfaced from underwater`);
      }
    });

    // Register message handler for editor mode toggle
    this.onMessage("editor_mode", (client: Client, message: { active: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.action = message.active ? "editor" : "none";
      console.log(`[GameRoom] Player ${player.name} action set to ${player.action}`);
    });



    // Register message handler for placing a map object
    this.onMessage("place_object", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const obj = new MapObject();
      obj.id = message.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      obj.assetId = message.assetId || "test_block";
      obj.x = Number(message.x || 0);
      obj.y = Number(message.y || 0);
      obj.scaleX = Number(message.scaleX !== undefined ? message.scaleX : 1);
      obj.scaleY = Number(message.scaleY !== undefined ? message.scaleY : 1);
      obj.rotation = Number(message.rotation || 0);
      obj.flipX = Boolean(message.flipX);
      obj.flipY = Boolean(message.flipY);
      obj.isSolid = Boolean(message.isSolid);
      obj.isWater = Boolean(message.isWater);
      obj.isClimbable = Boolean(message.isClimbable);
      obj.depthLayer = String(message.depthLayer || "same");
      obj.mapId = String(message.mapId || player.currentMap || "world_1");
      obj.triggerType = String(message.triggerType || "none");
      obj.triggerTargetX = Number(message.triggerTargetX || 0);
      obj.triggerTargetY = Number(message.triggerTargetY || 0);
      
      // Tileset crop coordinates
      obj.tileX = message.tileX !== undefined ? Number(message.tileX) : -1;
      obj.tileY = message.tileY !== undefined ? Number(message.tileY) : -1;
      obj.tileW = message.tileW !== undefined ? Number(message.tileW) : 0;
      obj.tileH = message.tileH !== undefined ? Number(message.tileH) : 0;
      
      // Anim speed/framerate
      obj.frameRate = message.frameRate !== undefined ? Number(message.frameRate) : 6;

      // Custom collision fields
      obj.solidWidth = message.solidWidth !== undefined ? Number(message.solidWidth) : 0;
      obj.solidHeight = message.solidHeight !== undefined ? Number(message.solidHeight) : 0;
      obj.solidOffsetX = message.solidOffsetX !== undefined ? Number(message.solidOffsetX) : 0;
      obj.solidOffsetY = message.solidOffsetY !== undefined ? Number(message.solidOffsetY) : 0;
      obj.patrolPath = String(message.patrolPath || "");
      obj.patrolSpeed = message.patrolSpeed !== undefined ? Number(message.patrolSpeed) : 45;
 
      if (obj.assetId && obj.assetId.startsWith("maple_tree_")) {
        obj.treeState = "grown";
        obj.treeHp = 10;
      }

      this.state.mapObjects.set(obj.id, obj);
      this.saveMapToDisk();
      console.log(`[GameRoom] Player ${player.name} placed object: ${obj.assetId} at (${obj.x}, ${obj.y})`);
    });

    // Register message handler for updating a map object
    this.onMessage("update_object", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const obj = this.state.mapObjects.get(message.id);
      if (!obj) return;

      if (message.x !== undefined) obj.x = Number(message.x);
      if (message.y !== undefined) obj.y = Number(message.y);
      if (message.scaleX !== undefined) obj.scaleX = Number(message.scaleX);
      if (message.scaleY !== undefined) obj.scaleY = Number(message.scaleY);
      if (message.rotation !== undefined) obj.rotation = Number(message.rotation);
      if (message.flipX !== undefined) obj.flipX = Boolean(message.flipX);
      if (message.flipY !== undefined) obj.flipY = Boolean(message.flipY);
      if (message.isSolid !== undefined) obj.isSolid = Boolean(message.isSolid);
      if (message.isWater !== undefined) obj.isWater = Boolean(message.isWater);
      if (message.isClimbable !== undefined) obj.isClimbable = Boolean(message.isClimbable);
      if (message.depthLayer !== undefined) obj.depthLayer = String(message.depthLayer);
      if (message.triggerType !== undefined) obj.triggerType = String(message.triggerType);
      if (message.triggerTargetX !== undefined) obj.triggerTargetX = Number(message.triggerTargetX);
      if (message.triggerTargetY !== undefined) obj.triggerTargetY = Number(message.triggerTargetY);

      // Tileset crops
      if (message.tileX !== undefined) obj.tileX = Number(message.tileX);
      if (message.tileY !== undefined) obj.tileY = Number(message.tileY);
      if (message.tileW !== undefined) obj.tileW = Number(message.tileW);
      if (message.tileH !== undefined) obj.tileH = Number(message.tileH);

      // Frame Rate
      if (message.frameRate !== undefined) obj.frameRate = Number(message.frameRate);

      // Custom Collision Fields
      if (message.solidWidth !== undefined) obj.solidWidth = Number(message.solidWidth);
      if (message.solidHeight !== undefined) obj.solidHeight = Number(message.solidHeight);
      if (message.solidOffsetX !== undefined) obj.solidOffsetX = Number(message.solidOffsetX);
      if (message.solidOffsetY !== undefined) obj.solidOffsetY = Number(message.solidOffsetY);
      if (message.patrolPath !== undefined) obj.patrolPath = String(message.patrolPath);
      if (message.patrolSpeed !== undefined) obj.patrolSpeed = Number(message.patrolSpeed);

      this.saveMapToDisk();
      console.log(`[GameRoom] Player ${player.name} updated object: ${obj.id}, patrolPath=${obj.patrolPath}, patrolSpeed=${obj.patrolSpeed}`);
    });

    // Register message handler for deleting a map object
    this.onMessage("delete_object", (client: Client, message: { id: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (this.state.mapObjects.has(message.id)) {
        this.state.mapObjects.delete(message.id);
        this.saveMapToDisk();
        console.log(`[GameRoom] Player ${player.name} deleted object: ${message.id}`);
      }
    });

    // Register message handler for loading an entire map config
    this.onMessage("load_map", (client: Client, message: { objects: any[] }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Clear existing objects
      this.state.mapObjects.clear();

      // Populate new ones
      if (Array.isArray(message.objects)) {
        message.objects.forEach((o: any) => {
          const obj = new MapObject();
          obj.id = o.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          obj.assetId = o.assetId || "test_block";
          obj.x = Number(o.x || 0);
          obj.y = Number(o.y || 0);
          obj.scaleX = Number(o.scaleX !== undefined ? o.scaleX : 1);
          obj.scaleY = Number(o.scaleY !== undefined ? o.scaleY : 1);
          obj.rotation = Number(o.rotation || 0);
          obj.flipX = Boolean(o.flipX);
          obj.flipY = Boolean(o.flipY);
          obj.isSolid = Boolean(o.isSolid);
          obj.depthLayer = String(o.depthLayer || "same");
          obj.triggerType = String(o.triggerType || "none");
          obj.triggerTargetX = Number(o.triggerTargetX || 0);
          obj.triggerTargetY = Number(o.triggerTargetY || 0);

          // Restore tileset coordinates
          obj.tileX = o.tileX !== undefined ? Number(o.tileX) : -1;
          obj.tileY = o.tileY !== undefined ? Number(o.tileY) : -1;
          obj.tileW = o.tileW !== undefined ? Number(o.tileW) : 0;
          obj.tileH = o.tileH !== undefined ? Number(o.tileH) : 0;

          // Restore framerate
          obj.frameRate = o.frameRate !== undefined ? Number(o.frameRate) : 6;

          // Restore custom collision fields
          obj.solidWidth = o.solidWidth !== undefined ? Number(o.solidWidth) : 0;
          obj.solidHeight = o.solidHeight !== undefined ? Number(o.solidHeight) : 0;
          obj.solidOffsetX = o.solidOffsetX !== undefined ? Number(o.solidOffsetX) : 0;
          obj.solidOffsetY = o.solidOffsetY !== undefined ? Number(o.solidOffsetY) : 0;

          if (obj.assetId && obj.assetId.startsWith("maple_tree_")) {
            obj.treeState = o.treeState || "grown";
            obj.treeHp = o.treeHp !== undefined ? Number(o.treeHp) : (obj.treeState === "dry" ? 5 : 10);
          }
 
          this.state.mapObjects.set(obj.id, obj);
        });
        this.saveMapToDisk();
        console.log(`[GameRoom] Player ${player.name} loaded ${message.objects.length} map objects`);
      }
    });

    // Start the authoritative simulation loop at 60Hz.
    // setInterval precision is ~1ms; for production we'd use a high-res timer
    // or colyseus' built-in clock, but this is perfect for the MVP.
    const TICK_MS = 1000 / 60; // ~16.67ms
    let lastTime = Date.now();

    this.simulationInterval = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTime;
      lastTime = now;
      this.clock.tick();
      this.simulateTick(deltaMs / 1000); // convert to seconds
    }, TICK_MS);

    console.log(`[GameRoom] Room "${this.roomId}" created.`);
  }

  onJoin(client: Client, options: JoinOptions): void {
    const player = new PlayerState();
    player.sessionId = client.sessionId;

    // Assign a color from the pool (cycling)
    player.color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;

    // Spawn near the center with slight random offset
    player.x = SPAWN_CENTER_X + (Math.random() - 0.5) * SPAWN_RADIUS;
    player.y = SPAWN_CENTER_Y + (Math.random() - 0.5) * SPAWN_RADIUS;

    // Use client-provided username (sanitize: strip non-alphanum, limit length)
    const rawName = (options?.username ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
    player.name      = rawName.length >= 3 ? rawName : `Player_${client.sessionId.substring(0, 4)}`;
    player.gender    = options?.gender === "female" ? "female" : "male";
    player.skinTone  = Math.min(4, Math.max(1, Math.round(options?.skinTone ?? 1)));
    
    // Validate eye color
    const validEyes = ["Black", "Blue", "Brown", "Green"];
    player.eyeColor = validEyes.includes(options?.eyeColor ?? "") ? (options?.eyeColor as string) : "Black";
    
    // Validate clothes color
    const validClothes = ["Blue", "Green", "Pink", "Purple", "Red"];
    player.clothesColor = validClothes.includes(options?.clothesColor ?? "") ? (options?.clothesColor as string) : "Blue";
    
    // Validate hair style
    const validStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standart"];
    player.hairStyle = validStyles.includes(options?.hairStyle ?? "") ? (options?.hairStyle as string) : "Standart";
    
    // Validate hair color
    const validColors = ["Black", "Blonde", "Brown", "Ginger"];
    player.hairColor = validColors.includes(options?.hairColor ?? "") ? (options?.hairColor as string) : "Black";

    player.hp = 100;
    player.maxHp = 100;

    // Add to the synchronized state — all other clients will receive onAdd
    this.state.players.set(client.sessionId, player);

    // Initialize an empty input buffer entry for this client
    this.inputBuffer.set(client.sessionId, {
      sessionId: client.sessionId,
      left: false,
      right: false,
      up: false,
      down: false,
      run: false,
    });

    console.log(
      `[GameRoom] ${player.name} (${client.sessionId}) joined. ` +
      `Total players: ${this.state.players.size}`
    );
  }

  onLeave(client: Client, _consented: boolean): void {
    this.cancelFishing(client.sessionId);

    // Remove from state — all other clients will receive onRemove
    this.state.players.delete(client.sessionId);
    this.inputBuffer.delete(client.sessionId);
    this.playerPetIdleTime.delete(client.sessionId);

    console.log(
      `[GameRoom] ${client.sessionId} left. ` +
      `Total players: ${this.state.players.size}`
    );
  }

  onDispose(): void {
    clearInterval(this.simulationInterval);
    console.log(`[GameRoom] Room "${this.roomId}" disposed.`);
  }

  private cancelFishing(sessionId: string): void {
    const suffixes = ["_cast", "_bite", "_escape", "_reel", "_catch"];
    suffixes.forEach(suffix => {
      const t = this.playerFishingTimeout.get(sessionId + suffix);
      if (t) {
        t.clear();
        this.playerFishingTimeout.delete(sessionId + suffix);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  /**
   * Core authoritative game loop.
   * Called 60 times per second. Reads buffered inputs, applies movement,
   * clamps to world bounds, and lets Colyseus diff + broadcast the state.
   *
   * @param delta - Time elapsed since last tick in SECONDS
   */
  private simulateTick(delta: number): void {
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      const input = this.inputBuffer.get(sessionId);
      if (!input) return;

      // Abort fishing if the player moves during the wait phase
      if (player.action === "fish_wait") {
        if (input.left || input.right || input.up || input.down) {
          this.cancelFishing(sessionId);
          player.action = "none";
          console.log(`[GameRoom] Player ${player.name} moved and aborted fishing`);
        }
      }

      // Compute velocity from input booleans
      let vx = 0;
      let vy = 0;

      const isEditor = player.action === "editor";
      const isBroomstick = player.equippedTool.startsWith("broomstick");

      let isInWaterCustom = false;
      let isOnClimbable = false;

      // Performance: only check objects near the player (within 200px)
      const CHECK_RADIUS = 200;
      this.state.mapObjects.forEach((obj) => {
        // Quick distance pre-check to skip distant objects
        if (Math.abs(obj.x - player.x) > CHECK_RADIUS || Math.abs(obj.y - player.y) > CHECK_RADIUS) return;

        const tileW = (obj.solidWidth > 0) ? obj.solidWidth : ((obj.tileW > 0) ? obj.tileW : (32 * obj.scaleX));
        const tileH = (obj.solidHeight > 0) ? obj.solidHeight : ((obj.tileH > 0) ? obj.tileH : (32 * obj.scaleY));
        const ox = obj.solidOffsetX || 0;
        const oy = obj.solidOffsetY || 0;
        
        const px = player.x;
        const py = player.y;

        // Check overlap for top-left aligned objects (tiles) AND center aligned objects (sprites):
        const minX1 = obj.x + ox - 8;
        const maxX1 = obj.x + ox + tileW + 8;
        const minY1 = obj.y + oy - 8;
        const maxY1 = obj.y + oy + tileH + 8;

        const minX2 = obj.x + ox - tileW / 2 - 8;
        const maxX2 = obj.x + ox + tileW / 2 + 8;
        const minY2 = obj.y + oy - tileH / 2 - 8;
        const maxY2 = obj.y + oy + tileH / 2 + 8;

        const overlapsTopLeft = (px >= minX1 && px <= maxX1 && py >= minY1 && py <= maxY1);
        const overlapsCenter = (px >= minX2 && px <= maxX2 && py >= minY2 && py <= maxY2);

        if (overlapsTopLeft || overlapsCenter) {
          if (obj.isWater) {
            isInWaterCustom = true;
          }
          if (obj.isClimbable) {
            isOnClimbable = true;
          }
        }
      });

      const isInWater = isInWaterCustom && !isBroomstick;

      if (isInWater) {
        const isGroundMount = player.equippedTool.startsWith("horse") || player.equippedTool.startsWith("bicycle") || player.equippedTool.startsWith("bear");
        if (isGroundMount) {
          player.equippedTool = "none";
        }
        if (player.action !== "swim" && player.action !== "swim_submerged") {
          player.action = "swim";
        }
      } else {
        if (player.action === "swim" || player.action === "swim_submerged") {
          player.action = "none";
        }
      }

      if (isOnClimbable && !isInWater) {
        if (player.action !== "climb") {
          player.action = "climb";
        }
      } else {
        if (player.action === "climb") {
          player.action = "none";
        }
      }

      const isRiding = player.mount.startsWith("horse") || player.mount.startsWith("bicycle") || player.mount.startsWith("bear") || player.mount.startsWith("broomstick") || player.mount === "tractor";
      const isSwimming = player.action === "swim";
      const isSubmerged = player.action === "swim_submerged";
      const isClimbing = player.action === "climb";

      const speed = isEditor
        ? 600
        : isSubmerged
        ? (input.run ? 120 : 80)
        : isSwimming
        ? (input.run ? 180 : 120)
        : isClimbing
        ? 150
        : isRiding 
        ? (input.run ? 500 : 350) 
        : (input.run ? 300 : PLAYER_SPEED);

      if (player.action === "none" || player.action === "climb" || player.action === "swim" || player.action === "swim_submerged" || isEditor) {
        if (input.left)  vx -= speed;
        if (input.right) vx += speed;
        if (input.up)    vy -= speed;
        if (input.down)  vy += speed;
      }

      // Normalize diagonal movement so speed is consistent in all directions
      if (vx !== 0 && vy !== 0) {
        const DIAGONAL_FACTOR = 0.7071; // 1 / sqrt(2)
        vx *= DIAGONAL_FACTOR;
        vy *= DIAGONAL_FACTOR;
      }

      // Apply velocity scaled by delta time with collision check
      if (isEditor) {
        // Spectator mode flies through everything
        player.x += vx * delta;
        player.y += vy * delta;
      } else {
        // 1. Try horizontal movement
        const oldX = player.x;
        player.x += vx * delta;

        let collidesX = false;
        this.state.mapObjects.forEach((obj) => {
          if (!obj.isSolid) return;
          if (Math.abs(obj.x - player.x) > CHECK_RADIUS || Math.abs(obj.y - player.y) > CHECK_RADIUS) return;
          if (player.action === "climb" && obj.isClimbable) {
              return;
            }
            const w = (obj.solidWidth > 0) ? obj.solidWidth : (32 * obj.scaleX);
            const h = (obj.solidHeight > 0) ? obj.solidHeight : (32 * obj.scaleY);
            const ox = obj.solidOffsetX || 0;
            const oy = obj.solidOffsetY || 0;
            
            const objX = obj.x + ox;
            const objY = obj.y + oy;
            const objHalfW = w / 2;
            const objHalfH = h / 2;
            const playerHalf = 12;

            if (
              player.x + playerHalf > objX - objHalfW &&
              player.x - playerHalf < objX + objHalfW &&
              player.y + playerHalf > objY - objHalfH &&
              player.y - playerHalf < objY + objHalfH
            ) {
              collidesX = true;
            }
        });
        if (collidesX) {
          player.x = oldX;
        }

        // 2. Try vertical movement
        const oldY = player.y;
        player.y += vy * delta;

        let collidesY = false;
        this.state.mapObjects.forEach((obj) => {
          if (!obj.isSolid) return;
          if (Math.abs(obj.x - player.x) > CHECK_RADIUS || Math.abs(obj.y - player.y) > CHECK_RADIUS) return;
          if (player.action === "climb" && obj.isClimbable) {
              return;
            }
            const w = (obj.solidWidth > 0) ? obj.solidWidth : (32 * obj.scaleX);
            const h = (obj.solidHeight > 0) ? obj.solidHeight : (32 * obj.scaleY);
            const ox = obj.solidOffsetX || 0;
            const oy = obj.solidOffsetY || 0;
            
            const objX = obj.x + ox;
            const objY = obj.y + oy;
            const objHalfW = w / 2;
            const objHalfH = h / 2;
            const playerHalf = 12;

            if (
              player.x + playerHalf > objX - objHalfW &&
              player.x - playerHalf < objX + objHalfW &&
              player.y + playerHalf > objY - objHalfH &&
              player.y - playerHalf < objY + objHalfH
            ) {
              collidesY = true;
            }
        });
        if (collidesY) {
          player.y = oldY;
        }

        // 3. Check teleport triggers intersections
        this.state.mapObjects.forEach((obj) => {
          if (obj.triggerType === "teleport") {
            const objHalfW = (32 * obj.scaleX) / 2;
            const objHalfH = (32 * obj.scaleY) / 2;
            const playerHalf = 12;

            if (
              player.x + playerHalf > obj.x - objHalfW &&
              player.x - playerHalf < obj.x + objHalfW &&
              player.y + playerHalf > obj.y - objHalfH &&
              player.y - playerHalf < obj.y + objHalfH
            ) {
              player.x = obj.triggerTargetX;
              player.y = obj.triggerTargetY;
              console.log(`[GameRoom] Teleported player ${player.name} to (${player.x}, ${player.y})`);
            }
          }


        });
      }

      // Update schema isRunning flag so clients can play run animations
      player.isRunning = Boolean(input.run) && (vx !== 0 || vy !== 0);

      // --- Map Transition & Bounds Clamping ---
      const activeMap = player.currentMap || "world_1";
      const activeWorldW = activeMap === "world_2" ? 2000 : WORLD_WIDTH;
      const activeWorldH = activeMap === "world_2" ? 2000 : WORLD_HEIGHT;

      // 1. Walk to left edge of World 1 (near left arrows) -> transition to right edge of World 2
      if (activeMap === "world_1" && player.x <= 25) {
        player.currentMap = "world_2";
        player.x = 1960;
        console.log(`[GameRoom] 🗺️ Player ${player.name} transitioned from world_1 to world_2 at (${player.x}, ${player.y})`);
      }
      // 2. Walk to right edge of World 2 -> transition to left edge of World 1
      else if (activeMap === "world_2" && player.x >= 1975) {
        player.currentMap = "world_1";
        player.x = 40;
        console.log(`[GameRoom] 🗺️ Player ${player.name} transitioned from world_2 to world_1 at (${player.x}, ${player.y})`);
      } else {
        // Clamp to active map bounds (half the player size ≈ 16px)
        const HALF_SIZE = 16;
        player.x = Math.max(HALF_SIZE, Math.min(activeWorldW - HALF_SIZE, player.x));
        player.y = Math.max(HALF_SIZE, Math.min(activeWorldH - HALF_SIZE, player.y));
      }

      // --- Authoritative Pet Companion Behavior ---
      if (player.petType) {
        // Initialize pet position near player if it's currently at origin
        if (player.petX === 0 && player.petY === 0) {
          player.petX = player.x - 30;
          player.petY = player.y;
        }

        const pdx = player.x - player.petX;
        const pdy = player.y - player.petY;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

        if (pdist > 35) {
          // Pet is too far, it walks/runs to follow the owner
          const angle = Math.atan2(pdy, pdx);
          const petSpeed = player.isRunning ? 340 : 180;
          player.petX += Math.cos(angle) * petSpeed * delta;
          player.petY += Math.sin(angle) * petSpeed * delta;
          player.petAction = "walk";

          if (Math.abs(pdx) > Math.abs(pdy)) {
            player.petDirection = pdx > 0 ? "right" : "left";
          } else {
            player.petDirection = pdy > 0 ? "down" : "up";
          }

          this.playerPetIdleTime.delete(sessionId);
        } else {
          // Pet has arrived near owner, goes into idle/sleep cycle
          if (player.petAction === "walk") {
            player.petAction = "idle";
          }
          if (player.petAction === "idle") {
            let idleStart = this.playerPetIdleTime.get(sessionId);
            if (!idleStart) {
              idleStart = Date.now();
              this.playerPetIdleTime.set(sessionId, idleStart);
            }
            if (Date.now() - idleStart > 12000) { // 12 seconds of inactivity
              player.petAction = "sleep";
            }
          }
        }
      }
    });

    // Update authoritative enemy AI and movement
    this.updateEnemies(delta);

    // Update crop growth simulation
    this.cropAccumulator += delta;
    if (this.cropAccumulator >= 1.0) {
      this.cropAccumulator -= 1.0;
      this.updateCropGrowth();
    }
  }

  // -------------------------------------------------------------------------
  // Authoritative Enemy AI & Combat Loop
  // -------------------------------------------------------------------------
  private updateEnemies(delta: number): void {
    // 1. Gather all enemy spawners placed via the Map Editor
    const spawners: MapObject[] = [];
    this.state.mapObjects.forEach((obj) => {
      if (obj.assetId && (
        obj.assetId === "spawn_archer_goblin" ||
        obj.assetId === "spawn_bomb_goblin" ||
        obj.assetId === "spawn_spear_goblin" ||
        obj.assetId === "spawn_blue_enemy" ||
        obj.assetId === "spawn_green_enemy" ||
        obj.assetId === "spawn_pink_myconid" ||
        obj.assetId === "spawn_purple_myconid" ||
        obj.assetId === "spawn_red_myconid" ||
        obj.assetId === "spawn_spike" ||
        obj.assetId === "spawn_goblin_merchant" ||
        obj.assetId.startsWith("spawn_animal_")
      )) {
        spawners.push(obj);
      }
    });

    // 2. Sync active enemies strictly with placed spawners
    const activeEnemyIdsBySpawner = new Set<string>();

    spawners.forEach((spawner) => {
      const enemyId = `enemy_${spawner.id}`;
      activeEnemyIdsBySpawner.add(enemyId);

      let enemy = this.state.enemies.get(enemyId);
      if (!enemy) {
        enemy = new EnemyState();
        enemy.id = enemyId;
        
        let maxHp = 80;
        if (spawner.assetId === "spawn_goblin_merchant") maxHp = 999;
        else if (spawner.assetId === "spawn_spike") maxHp = 150;
        else if (spawner.assetId === "spawn_red_myconid") maxHp = 250;
        else if (spawner.assetId === "spawn_purple_myconid") maxHp = 220;
        else if (spawner.assetId === "spawn_pink_myconid") maxHp = 200;
        else if (spawner.assetId === "spawn_green_enemy") maxHp = 180;
        else if (spawner.assetId === "spawn_blue_enemy") maxHp = 150;
        else if (spawner.assetId === "spawn_bomb_goblin") maxHp = 100;
        else if (spawner.assetId === "spawn_spear_goblin") maxHp = 120;
        else if (spawner.assetId.startsWith("spawn_animal_")) maxHp = 100;

        enemy.hp = maxHp;
        enemy.maxHp = maxHp;
        enemy.x = spawner.x;
        enemy.y = spawner.y;
        enemy.action = spawner.assetId === "spawn_spike" ? "hidden" : "idle";
        enemy.direction = "down";
        enemy.hitFlash = false;
        
        this.state.enemies.set(enemyId, enemy);
      }

      // Always sync attributes to handle active editor updates
      if (spawner.assetId === "spawn_goblin_merchant") {
        enemy.type = "goblin_merchant";
      } else if (spawner.assetId === "spawn_spike") {
        enemy.type = "spike";
      } else if (spawner.assetId.startsWith("spawn_animal_")) {
        enemy.type = spawner.assetId.replace("spawn_", "");
      } else {
        enemy.type = spawner.assetId.replace("spawn_", "");
      }

      enemy.homeX = spawner.x;
      enemy.homeY = spawner.y;
    });

    // Clean up enemies whose spawners were deleted or obsolete types
    this.state.enemies.forEach((enemy, id) => {
      if (!activeEnemyIdsBySpawner.has(id)) {
        this.state.enemies.delete(id);
      }
    });

    // 3. Update tethered AI behavior for each enemy
    this.state.enemies.forEach((enemy) => {
      if (enemy.action === "dead") return;

      if (enemy.type && enemy.type.startsWith("animal_")) {
        const spawner = this.state.mapObjects.get(enemy.id.replace("enemy_", ""));
        let waypoints: { x: number; y: number }[] = [];
        if (spawner && spawner.patrolPath) {
          try {
            waypoints = JSON.parse(spawner.patrolPath);
          } catch (e) {}
        }

        if (waypoints.length > 0) {
          if ((enemy as any).currentWaypointIndex === undefined || (enemy as any).currentWaypointIndex >= waypoints.length) {
            (enemy as any).currentWaypointIndex = 0;
          }
          const wp = waypoints[(enemy as any).currentWaypointIndex];
          const dx = wp.x - enemy.x;
          const dy = wp.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if ((this as any)._animTickCount === undefined) (this as any)._animTickCount = 0;
          (this as any)._animTickCount++;
          if ((this as any)._animTickCount % 100 === 0) {
            console.log(`[Animal AI Tick] ID: ${enemy.id}, Type: ${enemy.type}, Pos: (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)}), WaypointCount: ${waypoints.length}, TargetIndex: ${(enemy as any).currentWaypointIndex}, TargetPos: (${wp.x}, ${wp.y}), Dist: ${dist.toFixed(1)}`);
          }

          if (dist < 6) {
            (enemy as any).currentWaypointIndex = ((enemy as any).currentWaypointIndex + 1) % waypoints.length;
          } else {
            const speed = spawner ? spawner.patrolSpeed : 45;
            const step = speed * delta;
            if (step >= dist) {
              enemy.x = wp.x;
              enemy.y = wp.y;
            } else {
              enemy.x += (dx / dist) * step;
              enemy.y += (dy / dist) * step;
            }

            if (Math.abs(dx) > Math.abs(dy)) {
              enemy.direction = dx > 0 ? "right" : "left";
            } else {
              enemy.direction = dy > 0 ? "down" : "up";
            }
            enemy.action = "walk";
          }
        } else {
          enemy.x = enemy.homeX;
          enemy.y = enemy.homeY;
          enemy.action = "idle";
        }
        return;
      }

      if (enemy.type === "goblin_merchant") {
        enemy.x = enemy.homeX;
        enemy.y = enemy.homeY;
        enemy.action = "idle";
        return;
      }

      if (enemy.type === "spike") {
        enemy.x = enemy.homeX;
        enemy.y = enemy.homeY;

        // Find closest alive player
        let closestPlayer: PlayerState | null = null;
        let closestDist = Infinity;

        this.state.players.forEach((player) => {
          if (player.action === "death") return;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestPlayer = player;
          }
        });

        const aggroRange = 250;
        const inRange = closestPlayer && closestDist <= aggroRange;

        if (inRange) {
          const player = closestPlayer!;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;

          if (Math.abs(dx) > Math.abs(dy)) {
            enemy.direction = dx > 0 ? "right" : "left";
          } else {
            enemy.direction = dy > 0 ? "down" : "up";
          }

          if (enemy.action === "hidden") {
            enemy.action = "entering";
            this.clock.setTimeout(() => {
              if (enemy.action === "entering") {
                enemy.action = "idle";
              }
            }, 400);
          } else if (enemy.action === "idle") {
            // Trigger attack (spit)
            enemy.action = "attack";
            
            // Damage player at mid-animation
            this.clock.setTimeout(() => {
              if (enemy.action === "dead") return;
              const currentDx = player.x - enemy.x;
              const currentDy = player.y - enemy.y;
              const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
              if (player.action !== "death" && currentDist <= aggroRange + 20) {
                player.hp -= 20; // 20 projectile dmg
                if (player.hp <= 0) {
                  player.hp = 0;
                  player.action = "death";
                } else if (player.action !== "damage") {
                  player.action = "damage";
                  this.clock.setTimeout(() => {
                    if (player.action === "damage") player.action = "none";
                  }, 400);
                }
              }
            }, 350);

            // Cooldown: 1800ms
            this.clock.setTimeout(() => {
              if (enemy.action === "attack") {
                enemy.action = "idle";
              }
            }, 1800);
          } else if (enemy.action === "leaving") {
            // Interrupt leaving if player comes back
            enemy.action = "entering";
            this.clock.setTimeout(() => {
              if (enemy.action === "entering") {
                enemy.action = "idle";
              }
            }, 400);
          }
        } else {
          // No player in range
          if (enemy.action === "idle") {
            enemy.action = "leaving";
            this.clock.setTimeout(() => {
              if (enemy.action === "leaving") {
                enemy.action = "hidden";
              }
            }, 600);
          } else if (enemy.action === "entering") {
            enemy.action = "leaving";
            this.clock.setTimeout(() => {
              if (enemy.action === "leaving") {
                enemy.action = "hidden";
              }
            }, 600);
          }
        }
        return;
      }

      const homeDx = enemy.homeX - enemy.x;
      const homeDy = enemy.homeY - enemy.y;
      const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);

      // RETURNING STATE: Return directly to home tile
      if (enemy.action === "returning") {
        if (homeDist <= 8) {
          enemy.x = enemy.homeX;
          enemy.y = enemy.homeY;
          enemy.action = "idle";
          enemy.direction = "down";
        } else {
          const returnAngle = Math.atan2(homeDy, homeDx);
          const returnSpeed = 110;
          enemy.x += Math.cos(returnAngle) * returnSpeed * delta;
          enemy.y += Math.sin(returnAngle) * returnSpeed * delta;

          if (Math.abs(homeDx) > Math.abs(homeDy)) {
            enemy.direction = homeDx > 0 ? "right" : "left";
          } else {
            enemy.direction = homeDy > 0 ? "down" : "up";
          }
        }
        return;
      }

      // Check max tether distance (300px / 320px / 340px / 350px / 360px / 370px from home tile)
      const maxTether = enemy.type === "red_myconid" ? 370 : (enemy.type === "purple_myconid" ? 360 : (enemy.type === "pink_myconid" ? 350 : (enemy.type === "green_enemy" ? 340 : (enemy.type === "blue_enemy" ? 320 : 300))));
      if (homeDist > maxTether) {
        enemy.action = "returning";
        return;
      }

      // Find closest alive player
      let closestPlayer: PlayerState | null = null;
      let closestDist = Infinity;

      this.state.players.forEach((player) => {
        if (player.action === "death") return;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestPlayer = player;
        }
      });

      const aggroRange = enemy.type === "red_myconid" ? 270 : (enemy.type === "purple_myconid" ? 260 : (enemy.type === "pink_myconid" ? 250 : (enemy.type === "green_enemy" ? 240 : (enemy.type === "blue_enemy" ? 220 : 200))));
      const attackRange = enemy.type === "red_myconid" ? 80 : (enemy.type === "purple_myconid" ? 80 : (enemy.type === "pink_myconid" ? 80 : (enemy.type === "green_enemy" ? 75 : (enemy.type === "blue_enemy" ? 70 : (enemy.type === "spear_goblin" ? 60 : (enemy.type === "bomb_goblin" ? 160 : 140))))));

      if (closestPlayer && closestDist <= aggroRange) {
        const player = closestPlayer as PlayerState;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;

        if (Math.abs(dx) > Math.abs(dy)) {
          enemy.direction = dx > 0 ? "right" : "left";
        } else {
          enemy.direction = dy > 0 ? "down" : "up";
        }

        if (closestDist <= attackRange) {
          if (enemy.action !== "attack" && enemy.action !== "damage") {
            enemy.action = "attack";

            this.clock.setTimeout(() => {
              if (enemy.action === "dead") return;
              const currentDx = player.x - enemy.x;
              const currentDy = player.y - enemy.y;
              const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);

              if (player.action !== "death" && currentDist <= attackRange + 30) {
                const dmg = enemy.type === "red_myconid" ? 50 : (enemy.type === "purple_myconid" ? 45 : (enemy.type === "pink_myconid" ? 40 : (enemy.type === "green_enemy" ? 35 : (enemy.type === "blue_enemy" ? 30 : (enemy.type === "spear_goblin" ? 20 : (enemy.type === "bomb_goblin" ? 25 : 15))))));
                player.hp -= dmg;
                if (player.hp <= 0) {
                  player.hp = 0;
                  player.action = "death";
                } else if (player.action !== "damage") {
                  player.action = "damage";
                  this.clock.setTimeout(() => {
                    if (player.action === "damage") player.action = "none";
                  }, 400);
                }
              }
            }, 350);

            const cooldown = enemy.type === "bomb_goblin" ? 1600 : 1400;
            this.clock.setTimeout(() => {
              if (enemy.action === "attack") {
                enemy.action = "idle";
              }
            }, cooldown);
          }
        } else if (enemy.action !== "attack" && enemy.action !== "damage") {
          enemy.action = "run";
          const runSpeed = enemy.type === "bomb_goblin" ? 100 : 95;
          const angle = Math.atan2(dy, dx);
          enemy.x += Math.cos(angle) * runSpeed * delta;
          enemy.y += Math.sin(angle) * runSpeed * delta;
        }
      } else {
        // Player is out of aggro range
        if (homeDist > 12) {
          enemy.action = "returning";
        } else {
          enemy.x = enemy.homeX;
          enemy.y = enemy.homeY;
          enemy.action = "idle";
        }
      }
    });
  }

  private updateCropGrowth(): void {
    this.state.mapObjects.forEach((obj: any) => {
      if (obj.assetId && (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet")) {
        if (obj.cropType !== "none" && obj.cropStage < 3) {
          if (obj.cropWatered) {
            obj.cropGrowthProgress += 1;
            if (obj.cropGrowthProgress >= obj.cropGrowthNeeded) {
              obj.cropStage += 1;
              obj.cropGrowthProgress = 0;
              obj.cropWatered = false;
              obj.assetId = "tilled_soil_dry";
              console.log(`[GameRoom] Crop ${obj.id} grew to stage ${obj.cropStage}`);
            }
          }
        }
      }
    });
  }

  private recalculatePlayerStats(player: any): void {
    let baseMaxHp = 100;
    
    // Wood armor bonuses (Tier 1):
    // Helmet: +10 max HP * Tier
    // Chestplate: +15 max HP * Tier
    // Leggings: +10 max HP * Tier
    // Boots: +5 max HP * Tier
    
    if (player.helmet && player.helmet !== "none") {
      const tier = parseInt(player.helmet.split("_")[1], 10) || 1;
      baseMaxHp += tier * 10;
    }
    if (player.chestplate && player.chestplate !== "none") {
      const tier = parseInt(player.chestplate.split("_")[1], 10) || 1;
      baseMaxHp += tier * 15;
    }
    if (player.leggings && player.leggings !== "none") {
      const tier = parseInt(player.leggings.split("_")[1], 10) || 1;
      baseMaxHp += tier * 10;
    }
    if (player.boots && player.boots !== "none") {
      const tier = parseInt(player.boots.split("_")[1], 10) || 1;
      baseMaxHp += tier * 5;
    }
    
    const prevMaxHp = player.maxHp;
    player.maxHp = baseMaxHp;
    
    // Heal by difference if maxHp increased
    if (player.maxHp > prevMaxHp) {
      player.hp += (player.maxHp - prevMaxHp);
    }
    
    // Cap hp
    if (player.hp > player.maxHp) {
      player.hp = player.maxHp;
    }
  }

  // ---------------------------------------------------------------------------
  // Map Persistence: Local disk + GitHub repository backup
  // Map data is stored locally AND synced to GitHub so it survives redeployments.
  // ---------------------------------------------------------------------------

  private readonly GITHUB_TOKEN   = process.env.GITHUB_TOKEN || "";
  private readonly GITHUB_OWNER   = "sprouttale";
  private readonly GITHUB_REPO    = "sprouttale-game";
  private readonly GITHUB_PATH    = "_mapdata/world_save.json";  // NEVER touched by code commits!
  private githubFileSha: string   = "";   // needed for PUT (update) requests
  private githubSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Serialize current map objects to plain JSON array */
  private serializeMap(): any[] {
    const objects: any[] = [];
    this.state.mapObjects.forEach((obj) => {
      objects.push({
        id: obj.id, assetId: obj.assetId,
        mapId: obj.mapId || "world_1",
        x: obj.x, y: obj.y,
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        rotation: obj.rotation, flipX: obj.flipX, flipY: obj.flipY,
        isSolid: obj.isSolid, isWater: obj.isWater, isClimbable: obj.isClimbable,
        depthLayer: obj.depthLayer,
        triggerType: obj.triggerType, triggerTargetX: obj.triggerTargetX, triggerTargetY: obj.triggerTargetY,
        tileX: obj.tileX, tileY: obj.tileY, tileW: obj.tileW, tileH: obj.tileH,
        frameRate: obj.frameRate,
        solidWidth: obj.solidWidth, solidHeight: obj.solidHeight,
        solidOffsetX: obj.solidOffsetX, solidOffsetY: obj.solidOffsetY,
        treeState: obj.treeState, treeHp: obj.treeHp,
        cropType: obj.cropType, cropStage: obj.cropStage, cropWatered: obj.cropWatered
      });
    });
    return objects;
  }

  /** Load serialized objects into game state */
  private deserializeMap(objects: any[], defaultMapId: string = "world_1"): void {
    objects.forEach((o: any) => {
      const obj = new MapObject();
      obj.id            = o.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      obj.assetId       = o.assetId || "test_block";
      obj.mapId         = String(o.mapId || defaultMapId);
      obj.x             = Number(o.x || 0);
      obj.y             = Number(o.y || 0);
      obj.scaleX        = Number(o.scaleX !== undefined ? o.scaleX : 1);
      obj.scaleY        = Number(o.scaleY !== undefined ? o.scaleY : 1);
      obj.rotation      = Number(o.rotation || 0);
      obj.flipX         = Boolean(o.flipX);
      obj.flipY         = Boolean(o.flipY);
      obj.isSolid       = Boolean(o.isSolid);
      obj.isWater       = Boolean(o.isWater);
      obj.isClimbable   = Boolean(o.isClimbable);
      obj.depthLayer    = String(o.depthLayer || "same");
      obj.triggerType   = String(o.triggerType || "none");
      obj.triggerTargetX = Number(o.triggerTargetX || 0);
      obj.triggerTargetY = Number(o.triggerTargetY || 0);
      obj.tileX         = o.tileX !== undefined ? Number(o.tileX) : -1;
      obj.tileY         = o.tileY !== undefined ? Number(o.tileY) : -1;
      obj.tileW         = o.tileW !== undefined ? Number(o.tileW) : 0;
      obj.tileH         = o.tileH !== undefined ? Number(o.tileH) : 0;
      obj.frameRate     = o.frameRate !== undefined ? Number(o.frameRate) : 6;
      obj.solidWidth    = o.solidWidth !== undefined ? Number(o.solidWidth) : 0;
      obj.solidHeight   = o.solidHeight !== undefined ? Number(o.solidHeight) : 0;
      obj.solidOffsetX  = o.solidOffsetX !== undefined ? Number(o.solidOffsetX) : 0;
      obj.solidOffsetY  = o.solidOffsetY !== undefined ? Number(o.solidOffsetY) : 0;
      obj.treeState     = String(o.treeState || "");
      obj.treeHp        = Number(o.treeHp || 0);
      obj.cropType      = String(o.cropType || "none");
      obj.cropStage     = Number(o.cropStage || 0);
      obj.cropWatered   = Boolean(o.cropWatered);
      this.state.mapObjects.set(obj.id, obj);
    });
  }

  /** Save map locally to disk immediately */
  private saveMapToDisk(): void {
    try {
      const filePath = path.join(process.cwd(), "map_save.json");
      fs.writeFileSync(filePath, JSON.stringify(this.serializeMap(), null, 2), "utf8");

      // Save world_2 objects separately to world2_save.json
      const world2Path = path.join(process.cwd(), "_mapdata", "world2_save.json");
      const world2Objs = this.serializeMap().filter(o => o.mapId === "world_2");
      fs.writeFileSync(world2Path, JSON.stringify(world2Objs, null, 2), "utf8");
    } catch (err) {
      console.error("[GameRoom] Error saving map to disk:", err);
    }

    // Debounce GitHub save: wait 15s after last change before pushing to GitHub
    if (this.githubSaveTimer) clearTimeout(this.githubSaveTimer);
    this.githubSaveTimer = setTimeout(() => this.saveMapToGitHub(), 15000);
  }

  /** Push map data to GitHub repository file via API */
  private saveMapToGitHub(): void {
    try {
      const content = Buffer.from(JSON.stringify(this.serializeMap(), null, 2), "utf8").toString("base64");
      const body = JSON.stringify({
        message: "auto: update map_save.json",
        content,
        ...(this.githubFileSha ? { sha: this.githubFileSha } : {})
      });

      const req = https.request({
        hostname: "api.github.com",
        path: `/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/contents/${this.GITHUB_PATH}`,
        method: "PUT",
        headers: {
          "Authorization": `token ${this.GITHUB_TOKEN}`,
          "User-Agent": "SproutTale-Server",
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.content?.sha) {
              this.githubFileSha = json.content.sha;
              console.log(`[GameRoom] ✅ Map saved to GitHub (${this.state.mapObjects.size} objects)`);
            } else if (json.sha) {
              this.githubFileSha = json.sha;
            }
          } catch {}
        });
      });
      req.on("error", (e) => console.error("[GameRoom] GitHub save error:", e.message));
      req.write(body);
      req.end();
    } catch (err) {
      console.error("[GameRoom] Error pushing map to GitHub:", err);
    }
  }

  /** On startup: load from local disk (map_save.json or _mapdata/world_save.json); if missing, fetch from GitHub */
  private loadMapFromDisk(): void {
    // Try multiple candidate locations to handle different CWD on Render vs local
    const candidates = [
      path.join(process.cwd(), "map_save.json"),
      path.join(process.cwd(), "_mapdata", "world_save.json"),
      // __dirname in compiled dist is: server/dist/rooms → go up 3 levels to project root
      path.resolve(__dirname, "..", "..", "..", "_mapdata", "world_save.json"),
      // Extra level up in case Render nests differently
      path.resolve(__dirname, "..", "..", "..", "..", "_mapdata", "world_save.json"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const raw = fs.readFileSync(candidate, "utf8");
          const objects = JSON.parse(raw);
          if (Array.isArray(objects) && objects.length > 0) {
            this.deserializeMap(objects);
            console.log(`[GameRoom] ✅ Loaded ${objects.length} objects from ${candidate}`);
            this.fetchGitHubFileSha();
            return;
          }
        } catch (err) {
          console.error(`[GameRoom] Error reading ${candidate}:`, err);
        }
      } else {
        console.log(`[GameRoom] ⏭ Not found: ${candidate}`);
      }
    }

    // Also check for world2_save.json
    const w2Candidates = [
      path.join(process.cwd(), "_mapdata", "world2_save.json"),
      path.resolve(__dirname, "..", "..", "..", "_mapdata", "world2_save.json"),
    ];
    for (const c of w2Candidates) {
      if (fs.existsSync(c)) {
        try {
          const raw = fs.readFileSync(c, "utf8");
          const objects = JSON.parse(raw);
          if (Array.isArray(objects) && objects.length > 0) {
            this.deserializeMap(objects, "world_2");
            console.log(`[GameRoom] ✅ Loaded ${objects.length} world_2 objects from ${c}`);
          }
        } catch {}
      }
    }
  }

  /** Fetch the current SHA of the file (needed for updates) */
  private fetchGitHubFileSha(): void {
    const req = https.request({
      hostname: "api.github.com",
      path: `/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/contents/${this.GITHUB_PATH}`,
      method: "GET",
      headers: {
        "Authorization": `token ${this.GITHUB_TOKEN}`,
        "User-Agent": "SproutTale-Server",
        "Accept": "application/vnd.github.v3+json"
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.sha) { this.githubFileSha = json.sha; }
        } catch {}
      });
    });
    req.on("error", () => {});
    req.end();
  }

  /** Fetch map data from GitHub and load into state */
  private fetchMapFromGitHub(): void {
    const req = https.request({
      hostname: "api.github.com",
      path: `/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/contents/${this.GITHUB_PATH}`,
      method: "GET",
      headers: {
        "Authorization": `token ${this.GITHUB_TOKEN}`,
        "User-Agent": "SproutTale-Server",
        "Accept": "application/vnd.github.v3+json"
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.content) {
            const decoded = Buffer.from(json.content, "base64").toString("utf8");
            const objects = JSON.parse(decoded);
            if (Array.isArray(objects) && objects.length > 0) {
              this.deserializeMap(objects);
              // Cache locally for next restart
              const filePath = path.join(process.cwd(), "map_save.json");
              fs.writeFileSync(filePath, decoded, "utf8");
              console.log(`[GameRoom] ✅ Loaded ${objects.length} objects from GitHub`);
            }
            if (json.sha) { this.githubFileSha = json.sha; }
          } else {
            console.log("[GameRoom] GitHub map file is empty, starting fresh.");
          }
        } catch (err) {
          console.error("[GameRoom] Error parsing GitHub map data:", err);
        }
      });
    });
    req.on("error", (e) => console.error("[GameRoom] Error fetching from GitHub:", e.message));
    req.end();
  }
}
