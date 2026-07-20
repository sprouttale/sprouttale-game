import { Schema, type, MapSchema } from "@colyseus/schema";

// ---------------------------------------------------------------------------
// PlayerState — represents a single connected player in the room.
// The @type decorators tell Colyseus which fields to track and synchronize.
// When any of these fields change on the server, Colyseus automatically sends
// a delta-patch to all subscribed clients — no manual emit needed.
// ---------------------------------------------------------------------------
export class PlayerState extends Schema {
  /** Unique identifier matching Colyseus client.sessionId */
  @type("string")
  sessionId: string = "";

  /** World-space X position (pixels) */
  @type("float32")
  x: number = 0;

  /** World-space Y position (pixels) */
  @type("float32")
  y: number = 0;

  /** Hex color string e.g. "#e74c3c" — deterministically assigned on join */
  @type("string")
  color: string = "#ffffff";

  /** Display name shown above the player's character */
  @type("string")
  name: string = "Player";

  /** Character gender — used by clients to pick the correct sprite sheet */
  @type("string")
  gender: string = "male";

  /** Skin tone variant 1–4 — maps to 1.png … 4.png */
  @type("uint8")
  skinTone: number = 1;

  /** Eye color name */
  @type("string")
  eyeColor: string = "Black";

  /** Clothes color name */
  @type("string")
  clothesColor: string = "Blue";

  /** Hair style name */
  @type("string")
  hairStyle: string = "Standart";

  /** Hair color name */
  @type("string")
  hairColor: string = "Black";

  /** Equipped hat name (empty string if none) */
  @type("string")
  hat: string = "";

  /** Flag indicating whether the player is running */
  @type("boolean")
  isRunning: boolean = false;

  /** Current action state ("none", "pickaxe", "hoe", "bug_net") */
  @type("string")
  action: string = "none";

  /** Currently equipped tool ("none", "pickaxe", "hoe", "bug_net") */
  @type("string")
  equippedTool: string = "none";

  @type("string")
  mount: string = "none";

  @type("string")
  helmet: string = "none";

  @type("string")
  chestplate: string = "none";

  @type("string")
  leggings: string = "none";

  @type("string")
  boots: string = "none";

  /** Player health points */
  @type("int32")
  hp: number = 100;

  @type("int32")
  maxHp: number = 100;

  /** Active companion pet properties */
  @type("string")
  petType: string = "";

  @type("float32")
  petX: number = 0;

  @type("float32")
  petY: number = 0;

  @type("string")
  petDirection: string = "down";

  @type("string")
  petAction: string = "idle";

  // --- Player Farming Inventory ---
  @type({ map: "int32" })
  seeds = new MapSchema<number>();

  @type({ map: "int32" })
  harvests = new MapSchema<number>();
}

// ---------------------------------------------------------------------------
// MapObject — represents a placed decorative or collidable asset on the map.
// ---------------------------------------------------------------------------
export class MapObject extends Schema {
  @type("string")
  id: string = "";

  @type("string")
  assetId: string = "";

  @type("float32")
  x: number = 0;

  @type("float32")
  y: number = 0;

  @type("float32")
  scaleX: number = 1;

  @type("float32")
  scaleY: number = 1;

  @type("float32")
  rotation: number = 0;

  @type("boolean")
  flipX: boolean = false;

  @type("boolean")
  flipY: boolean = false;

  @type("boolean")
  isSolid: boolean = false;

  @type("boolean")
  isWater: boolean = false;

  @type("boolean")
  isClimbable: boolean = false;

  @type("string")
  depthLayer: string = "same"; // "below", "same", "above"

  @type("string")
  triggerType: string = "none"; // "none", "teleport", "spawn"

  @type("float32")
  triggerTargetX: number = 0;

  @type("float32")
  triggerTargetY: number = 0;

  // --- Tileset coordinates ---
  @type("int32")
  tileX: number = -1; // -1 if not a tileset item

  @type("int32")
  tileY: number = -1;

  @type("int32")
  tileW: number = 0;

  @type("int32")
  tileH: number = 0;

  // --- Animation frame rate / play speed ---
  @type("float32")
  frameRate: number = 6; // default 6 fps

  // --- Custom Collision Box Dimensions ---
  @type("float32")
  solidWidth: number = 0; // 0 means default (32 * scaleX)

  @type("float32")
  solidHeight: number = 0; // 0 means default (32 * scaleY)

  @type("float32")
  solidOffsetX: number = 0;

  @type("float32")
  solidOffsetY: number = 0;

  // --- Tree state fields ---
  @type("string")
  treeState: string = ""; // "", "grown", "sapling", "grow_1", "grow_2", "dry", "stump"

  @type("int32")
  treeHp: number = 0;

  @type("boolean")
  treeHitFlash: boolean = false;

  @type("string")
  patrolPath: string = ""; // JSON string representing waypoints: [{"x":100,"y":200}, ...]

  @type("float32")
  patrolSpeed: number = 45; // Speed of patrol/roam

  // --- Crop farming fields ---
  @type("string")
  cropType: string = "none"; // "none", "apple", "carrot", "wheat", etc.

  @type("int32")
  cropStage: number = 0; // 0 (Seed) to 3 (Mature)

  @type("boolean")
  cropWatered: boolean = false;

  @type("int32")
  cropGrowthProgress: number = 0;

  @type("int32")
  cropGrowthNeeded: number = 10;
}

// ---------------------------------------------------------------------------
// EnemyState — represents an authoritative monster/enemy or NPC merchant.
// ---------------------------------------------------------------------------
export class EnemyState extends Schema {
  @type("string")
  id: string = "";

  @type("string")
  type: string = ""; // "archer_goblin", "spear_goblin", "bomb_goblin", "goblin_merchant"

  @type("float32")
  x: number = 0;

  @type("float32")
  y: number = 0;

  @type("float32")
  homeX: number = 0;

  @type("float32")
  homeY: number = 0;

  @type("string")
  direction: string = "down"; // "down", "left", "right", "up"

  @type("string")
  action: string = "idle"; // "idle", "walk", "run", "attack", "damage", "dead"

  @type("int32")
  hp: number = 100;

  @type("int32")
  maxHp: number = 100;

  @type("boolean")
  hitFlash: boolean = false;
}

// ---------------------------------------------------------------------------
// GameState — the root schema for the entire room.
// MapSchema<PlayerState> acts as a synchronized dictionary:
//   key   → sessionId (string)
//   value → PlayerState instance
// All clients receive onAdd / onRemove / onChange callbacks automatically.
// ---------------------------------------------------------------------------
export class GameState extends Schema {
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type({ map: MapObject })
  mapObjects = new MapSchema<MapObject>();

  @type({ map: EnemyState })
  enemies = new MapSchema<EnemyState>();
}
