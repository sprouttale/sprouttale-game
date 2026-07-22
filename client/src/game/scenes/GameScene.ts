import Phaser from "phaser";
import type { Room } from "colyseus.js";

// ---------------------------------------------------------------------------
// Constants — must match server-side values
// ---------------------------------------------------------------------------
export const WORLD_WIDTH  = 1500;
export const WORLD_HEIGHT = 2500;

/** Size of each grid cell in pixels */
const GRID_SIZE = 16;

/** How often to send input to the server (milliseconds).
 *  20Hz = every 50ms. Keeps bandwidth low without feeling laggy. */
const INPUT_SEND_INTERVAL_MS = 50;



/** Animation frame change speed for walking */
const FRAME_DELAY_MS = 120;

// ---------------------------------------------------------------------------
// Helper mapping functions for walk/idle assets
// ---------------------------------------------------------------------------
function getIdleHairKey(style: string, color: string): string {
  const mappedStyle = style === "Standart" ? "Standard" : style;
  return `idle_hair_${mappedStyle}_${color}`;
}

function getIdleHatKey(hat: string): string {
  if (hat === "Santa Hat") return "idle_hat_Santa hat";
  if (hat === "Pirate eyepatch") return "idle_hat_pirate eye patch";
  return `idle_hat_${hat}`;
}

function getWalkHairKey(style: string, color: string): string {
  const mappedStyle = style === "Standart" ? "Standard" : style;
  return `hair_${mappedStyle}_${color}`;
}

function getWalkHatKey(hat: string): string {
  if (hat === "Santa Hat") return "hat_Santa Hat";
  if (hat === "Pirate eyepatch") return "hat_pirate eye patch";
  return `hat_${hat}`;
}

function getRunHairKey(style: string, color: string): string {
  const mappedStyle = style === "Standart" ? "Standard" : style;
  return `run_hair_${mappedStyle}_${color}`;
}

function getRunHatKey(hat: string): string {
  if (hat === "Santa Hat") return "run_hat_Santa Hat";
  if (hat === "Pirate eyepatch") return "run_hat_pirate eye patch";
  return `run_hat_${hat}`;
}

function getToolHairKey(style: string, color: string, action: string): string {
  const mappedStyle = style === "Standart" ? "Standard" : style;
  if (action.startsWith("axe_") || action.startsWith("sickle_")) {
    return `axe_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("shovel_")) {
    return `shovel_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("watering_")) {
    return `watering_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("sword_")) {
    return `sword_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("archer_")) {
    return `archer_hair_${mappedStyle}_${color}`;
  }
  if (action === "damage") {
    return `damage_hair_${mappedStyle}_${color}`;
  }
  if (action === "death") {
    return `death_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("fish_")) {
    return `${action}_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("carry_")) {
    return `${action}_hair_${mappedStyle}_${color}`;
  }
  if (action.startsWith("horse_")) {
    return `${action}_hair_${mappedStyle}_${color}`;
  }
  return `tool_hair_${mappedStyle}_${color}`;
}

function getToolWeaponKey(action: string, equippedTool: string): string {
  if (action.startsWith("pickaxe_") || action.startsWith("hoe_") || action === "bug_net") {
    return `weapon_${action}`;
  }
  if (action.startsWith("axe_") || action.startsWith("sickle_")) {
    return `weapon_${action}`;
  }
  if (action.startsWith("shovel_")) {
    return `weapon_${action}`;
  }
  if (action.startsWith("watering_")) {
    return `weapon_${action}`;
  }
  if (action.startsWith("sword_")) {
    return `weapon_${action}`;
  }
  if (action.startsWith("archer_")) {
    return `weapon_${action}`;
  }
  if (action === "damage") {
    return "weapon_blood_fx";
  }
  if (action.startsWith("fish_")) {
    const tier = equippedTool.startsWith("fishing_")
      ? parseInt(equippedTool.replace("fishing_", ""), 10)
      : 1;
    return `weapon_${action}_${tier}`;
  }
  return "";
}

function getToolHatKey(hat: string, action: string): string {
  if (action === "death") {
    if (hat === "Santa Hat") return "death_hat_Santa Hat";
    if (hat === "Pirate eyepatch") return "death_hat_pirate eye patch";
    return `death_hat_${hat}`;
  }
  if (action.startsWith("fish_")) {
    if (hat === "Santa Hat") return `${action}_hat_Santa Hat`;
    if (hat === "Pirate eyepatch") return `${action}_hat_pirate eye patch`;
    return `${action}_hat_${hat}`;
  }
  if (action.startsWith("carry_")) {
    if (hat === "Santa Hat") return `${action}_hat_Santa Hat`;
    if (hat === "Pirate eyepatch") return `${action}_hat_pirate eye patch`;
    return `${action}_hat_${hat}`;
  }
  if (action.startsWith("horse_")) {
    if (hat === "Santa Hat") return `${action}_hat_Santa Hat`;
    if (hat === "Pirate eyepatch") return `${action}_hat_pirate eye patch`;
    return `${action}_hat_${hat}`;
  }
  if (hat === "Santa Hat") return "hat_Santa Hat";
  if (hat === "Pirate eyepatch") return "hat_pirate eye patch";
  return `hat_${hat}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape of a player received from Colyseus state */
interface RemotePlayerData {
  x: number;
  y: number;
  color: string;
  name: string;
  sessionId: string;
  gender: string;
  skinTone: number;
  eyeColor: string;
  clothesColor: string;
  hairStyle: string;
  hairColor: string;
  hat: string;
  isRunning?: boolean;
  petType?: string;
  petX?: number;
  petY?: number;
  petDirection?: string;
  petAction?: string;
  currentMap?: string;
  onChange?: (callback: () => void) => void;
}

/** Per-player render container managed by the scene */
interface PlayerSprite {
  container:     Phaser.GameObjects.Container;
  bodySprite:    Phaser.GameObjects.Sprite;
  eyesSprite:    Phaser.GameObjects.Sprite;
  clothesSprite: Phaser.GameObjects.Sprite;
  hairSprite:    Phaser.GameObjects.Sprite;
  hatSprite:     Phaser.GameObjects.Sprite;
  nameLabel:     Phaser.GameObjects.Text;
  /** Used to smoothly interpolate toward the authoritative position */
  targetX:    number;
  targetY:    number;
  
  // Animation tracking states
  lastX:      number;
  lastY:      number;
  row:        number; // 0 = Down, 1 = Side, 2 = Up
  walkFrame:  number; // current frame inside animation loop
  animTimer:  number; // accumulated time
  facingDir:  "down" | "up" | "left" | "right";
  toolSprite: Phaser.GameObjects.Sprite;
  arrowSprite: Phaser.GameObjects.Sprite;
  cargoText?: Phaser.GameObjects.Text;
  horseSprite?: Phaser.GameObjects.Sprite;
  saddleSprite?: Phaser.GameObjects.Sprite;
  horseShadowSprite?: Phaser.GameObjects.Sprite;
  shadowSprite?: Phaser.GameObjects.Ellipse;
  bicycleSprite?: Phaser.GameObjects.Sprite;
  bearSprite?: Phaser.GameObjects.Sprite;
  broomstickSprite?: Phaser.GameObjects.Sprite;
  tractorSprite?: Phaser.GameObjects.Sprite;
  actionElapsed?: number;
  lastActionUsed?: string;
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------
export interface EnemySpriteData {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  nameLabel: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  type: string;
  lastAttackTime?: number;
}

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private playerSprites = new Map<string, PlayerSprite>();
  private enemySprites = new Map<string, EnemySpriteData>();
  private petSprites = new Map<string, { sprite: Phaser.GameObjects.Sprite; targetX: number; targetY: number }>();

  // ---- Input ---------------------------------------------------------------
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private lastInputSentAt = 0;

  // ---- State ---------------------------------------------------------------
  private localSessionId = "";
  private localSprite: PlayerSprite | null = null;
  private sceneReady = false;
  private pendingSpawns: Array<{ data: RemotePlayerData; sessionId: string }> = [];
  public currentMapId: string = "world_1";

  // ---- Graphics layers -----------------------------------------------------
  private groundLayer!: Phaser.GameObjects.Graphics;

  // ---- Map Editor variables ------------------------------------------------
  private belowPlayerGroup!: Phaser.GameObjects.Group;
  private samePlayerGroup!: Phaser.GameObjects.Group;
  private abovePlayerGroup!: Phaser.GameObjects.Group;
  private editorOutline!: Phaser.GameObjects.Graphics;
  private editorPreviewRect!: Phaser.GameObjects.Rectangle;
  private editorPreviewWood!: Phaser.GameObjects.Sprite;
  private editorPreviewTile!: Phaser.GameObjects.Sprite;
  private editorPreviewWell!: Phaser.GameObjects.Sprite;
  private editorPreviewFountain!: Phaser.GameObjects.Sprite;
  private editorPreviewHouse!: Phaser.GameObjects.Sprite;
  private editorPreviewTree!: Phaser.GameObjects.Sprite;
  private editorPreviewTreeWater2!: Phaser.GameObjects.Sprite;
  private editorPreviewPlant!: Phaser.GameObjects.Sprite;
  private fillRegionGfx!: Phaser.GameObjects.Graphics;
  private fillRegionStart: { x: number; y: number } | null = null;
  private placedObjectSprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite>();

  constructor() {
    super({ key: "GameScene" });
  }

  // -------------------------------------------------------------------------
  // preload() — load all character spritesheets before starting
  // -------------------------------------------------------------------------
  preload(): void {
    console.log("[GameScene] Preloading spritesheets...");

    // Preload genders and colors
    const genders = ["male", "female"];
    const skinTones = [1, 2, 3, 4];
    const eyeColors = ["Black", "Blue", "Brown", "Green"];
    const clothesColors = ["Blue", "Green", "Pink", "Purple", "Red"];
    const colors = ["Black", "Blonde", "Brown", "Ginger"];

    // Preload walk skins (genderless, 32x32)
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `body_${t}`,
        `/assets/walk/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // Preload walk eyes (gender x colors, 32x32)
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `eyes_${g}_${c}`,
          `/assets/walk/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // Preload walk clothes (stored under Farm, 32x32)
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `clothes_${c}`,
        `/assets/walk/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // Preload walk hairs (styles x colors, 32x32)
    const walkHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    walkHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `hair_${s}_${c}`,
          `/assets/walk/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // Preload walk hats (32x32)
    const walkHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
    walkHats.forEach((h) => {
      this.load.spritesheet(
        `hat_${h}`,
        `/assets/walk/hats/${h}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // Preload run assets (32x32)
    // 1. Run Skins (genderless)
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `run_body_${t}`,
        `/assets/run/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Run Eyes (gender x colors)
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `run_eyes_${g}_${c}`,
          `/assets/run/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Run Clothes (stored under Farm)
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `run_clothes_${c}`,
        `/assets/run/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Run Hair (styles x colors)
    const runHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    runHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `run_hair_${s}_${c}`,
          `/assets/run/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Run Hats
    const runHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
    runHats.forEach((h) => {
      this.load.spritesheet(
        `run_hat_${h}`,
        `/assets/run/hats/${h}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // Preload tool action assets (32x32)
    // 1. Tool Skins (genderless)
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `tool_body_${t}`,
        `/assets/tools/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Tool Eyes (gender x colors)
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `tool_eyes_${g}_${c}`,
          `/assets/tools/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Tool Clothes (stored under Farm)
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `tool_clothes_${c}`,
        `/assets/tools/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Tool Hair (styles x colors)
    const toolHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    toolHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `tool_hair_${s}_${c}`,
          `/assets/tools/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Tool Weapons (pickaxes, hoes, bug nets)
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_pickaxe_${i}`, `/assets/tools/weapons/pickaxe/${i}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`weapon_hoe_${i}`, `/assets/tools/weapons/hoe/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }
    this.load.spritesheet("weapon_bug_net", "/assets/tools/weapons/bug_net.png", { frameWidth: 32, frameHeight: 32 });

    // Preload tools2 (Axe & Sickle) action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `axe_body_${t}`,
        `/assets/tools2/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `axe_eyes_${g}_${c}`,
          `/assets/tools2/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `axe_clothes_${c}`,
        `/assets/tools2/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const tool2HairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    tool2HairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `axe_hair_${s}_${c}`,
          `/assets/tools2/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Weapons (Axe, Sickle)
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_axe_${i}`, `/assets/tools2/weapons/axe/${i}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`weapon_sickle_${i}`, `/assets/tools2/weapons/sickle/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Preload tools3 (Shovel) action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `shovel_body_${t}`,
        `/assets/tools3/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `shovel_eyes_${g}_${c}`,
          `/assets/tools3/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `shovel_clothes_${c}`,
        `/assets/tools3/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const tool3HairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    tool3HairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `shovel_hair_${s}_${c}`,
          `/assets/tools3/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Weapons (Shovel)
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_shovel_${i}`, `/assets/tools3/weapons/shovel/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Preload watering can action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `watering_body_${t}`,
        `/assets/watering/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `watering_eyes_${g}_${c}`,
          `/assets/watering/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `watering_clothes_${c}`,
        `/assets/watering/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const wateringHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    wateringHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `watering_hair_${s}_${c}`,
          `/assets/watering/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Weapons (Watering Can)
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_watering_${i}`, `/assets/watering/weapons/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Preload sword attack action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `sword_body_${t}`,
        `/assets/sword_attack/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `sword_eyes_${g}_${c}`,
          `/assets/sword_attack/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `sword_clothes_${c}`,
        `/assets/sword_attack/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const swordHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    swordHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `sword_hair_${s}_${c}`,
          `/assets/sword_attack/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Weapons (Swords 1-10)
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_sword_${i}`, `/assets/sword_attack/weapons/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Preload archer action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `archer_body_${t}`,
        `/assets/archer/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `archer_eyes_${g}_${c}`,
          `/assets/archer/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `archer_clothes_${c}`,
        `/assets/archer/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const archerHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    archerHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `archer_hair_${s}_${c}`,
          `/assets/archer/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Weapons (Bows 1-10) and Arrow Fx
    for (let i = 1; i <= 10; i++) {
      this.load.spritesheet(`weapon_archer_${i}`, `/assets/archer/weapons/${i}.png`, { frameWidth: 32, frameHeight: 32 });
    }
    this.load.spritesheet(`weapon_arrow_fx`, `/assets/archer/weapons/Arrow Fx.png`, { frameWidth: 32, frameHeight: 32 });

    // Preload damage action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `damage_body_${t}`,
        `/assets/damage/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `damage_eyes_${g}_${c}`,
          `/assets/damage/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `damage_clothes_${c}`,
        `/assets/damage/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const damageHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    damageHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `damage_hair_${s}_${c}`,
          `/assets/damage/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Blood FX sheet
    this.load.spritesheet(`weapon_blood_fx`, `/assets/damage/blood_fx.png`, { frameWidth: 32, frameHeight: 32 });

    // Preload death action assets (32x32)
    // 1. Skins
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `death_body_${t}`,
        `/assets/death/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Eyes
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `death_eyes_${g}_${c}`,
          `/assets/death/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Clothes
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `death_clothes_${c}`,
        `/assets/death/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Hair
    const deathHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    deathHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `death_hair_${s}_${c}`,
          `/assets/death/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Hats
    const deathHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
    deathHats.forEach((h) => {
      this.load.spritesheet(
        `death_hat_${h}`,
        `/assets/death/hats/${h}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });
    // Preload fishing assets (32x32)
    const fishingPhases = ["cast", "wait", "bite", "reel", "catch"];
    fishingPhases.forEach((phase) => {
      // 1. Skins
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `fish_${phase}_body_${t}`,
          `/assets/fishing/${phase}/skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Eyes
      genders.forEach((g) => {
        eyeColors.forEach((c) => {
          this.load.spritesheet(
            `fish_${phase}_eyes_${g}_${c}`,
            `/assets/fishing/${phase}/eyes/${g}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Clothes
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `fish_${phase}_clothes_${c}`,
          `/assets/fishing/${phase}/clothes/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Hair
      const fishingHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      fishingHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `fish_${phase}_hair_${s}_${c}`,
            `/assets/fishing/${phase}/hair/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Hats
      const fishingHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      fishingHats.forEach((h) => {
        this.load.spritesheet(
          `fish_${phase}_hat_${h}`,
          `/assets/fishing/${phase}/hats/${h}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 6. Weapons (Rods 1-10)
      for (let i = 1; i <= 10; i++) {
        this.load.spritesheet(
          `weapon_fish_${phase}_${i}`,
          `/assets/fishing/${phase}/weapons/${i}.png`,
          { frameWidth: 64, frameHeight: 64 }
        );
      }
    });

    // Sweat & Fish FX
    this.load.spritesheet("weapon_sweat_fx", "/assets/fishing/reel/Fx sweating.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("weapon_fish_fx", "/assets/fishing/catch/weapons/Fish FX.png", { frameWidth: 64, frameHeight: 64 });

    // Preload carrying assets (32x32)
    const carryingPhases = [
      { key: "carrying_idle", dir: "idle" },
      { key: "carrying_walk", dir: "walk" },
      { key: "carrying_run", dir: "run" },
      { key: "carry_pick", dir: "pick_up" },
      { key: "carry_throw", dir: "throw" }
    ];
    carryingPhases.forEach((p) => {
      // 1. Skins
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p.key}_body_${t}`,
          `/assets/carrying/${p.dir}/skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Eyes
      genders.forEach((g) => {
        eyeColors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_eyes_${g}_${c}`,
            `/assets/carrying/${p.dir}/eyes/${g}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Clothes
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `${p.key}_clothes_${c}`,
          `/assets/carrying/${p.dir}/clothes/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Hair
      const carryingHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      carryingHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_hair_${s}_${c}`,
            `/assets/carrying/${p.dir}/hair/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Hats
      const carryingHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      carryingHats.forEach((h) => {
        this.load.spritesheet(
          `${p.key}_hat_${h}`,
          `/assets/carrying/${p.dir}/hats/${h}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // Preload horse riding assets
    const horsePhases = [
      { key: "horse_idle", dir: "idle" },
      { key: "horse_walk", dir: "walk" },
      { key: "horse_run", dir: "run" },
      { key: "horse_lower", dir: "lower" },
      { key: "horse_eating", dir: "eating" }
    ];
    horsePhases.forEach((p) => {
      // 1. Character Skins (32x32)
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p.key}_body_${t}`,
          `/assets/horse/${p.dir}/skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Character Eyes (32x32)
      genders.forEach((g) => {
        eyeColors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_eyes_${g}_${c}`,
            `/assets/horse/${p.dir}/eyes/${g}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Character Clothes (32x32)
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `${p.key}_clothes_${c}`,
          `/assets/horse/${p.dir}/clothes/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Character Hair (32x32)
      const horseHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      horseHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_hair_${s}_${c}`,
            `/assets/horse/${p.dir}/hair/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Character Hats (32x32)
      const horseHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      horseHats.forEach((h) => {
        this.load.spritesheet(
          `${p.key}_hat_${h}`,
          `/assets/horse/${p.dir}/hats/${h}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 6. Horse Body (32x48)
      for (let i = 1; i <= 5; i++) {
        this.load.spritesheet(
          `horse_body_${p.key}_${i}`,
          `/assets/horse/${p.dir}/horse/${i}.png`,
          { frameWidth: 32, frameHeight: 48 }
        );
      }

      // 7. Horse Saddle (32x48)
      const saddleColors = ["Black", "Blue", "Brown", "Green", "Pink"];
      saddleColors.forEach((sc) => {
        this.load.spritesheet(
          `horse_saddle_${p.key}_${sc}`,
          `/assets/horse/${p.dir}/horse/saddle/${sc}.png`,
          { frameWidth: 32, frameHeight: 48 }
        );
      });

      // 8. Horse Shadow (32x48)
      this.load.spritesheet(
        `horse_shadow_${p.key}`,
        `/assets/horse/${p.dir}/horse/Shadow.png`,
        { frameWidth: 32, frameHeight: 48 }
      );
    });

    // Preload bicycle riding assets (32x32)
    const bicyclePhases = [
      { key: "bicycle_idle", dir: "idle" },
      { key: "bicycle_run", dir: "run" }
    ];
    bicyclePhases.forEach((p) => {
      // 1. Character Skins (32x32)
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p.key}_body_${t}`,
          `/assets/bicycle/${p.dir}/Skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Character Eyes (32x32)
      genders.forEach((g) => {
        const genderDir = g === "male" ? "Male" : "Female";
        eyeColors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_eyes_${g}_${c}`,
            `/assets/bicycle/${p.dir}/Eyes/${genderDir}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Character Clothes (32x32)
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `${p.key}_clothes_${c}`,
          `/assets/bicycle/${p.dir}/Clothers/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Character Hair (32x32)
      const bicycleHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      bicycleHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_hair_${s}_${c}`,
            `/assets/bicycle/${p.dir}/Hair's/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Character Hats (32x32)
      const bicycleHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      bicycleHats.forEach((h) => {
        const fileHat = h === "Santa Hat" ? "Santa hat" : h;
        this.load.spritesheet(
          `${p.key}_hat_${h}`,
          `/assets/bicycle/${p.dir}/Acc/${fileHat}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 6. Bicycle Body (32x32)
      const bicycleColors = ["Blue", "Green", "Orange", "Pink", "Red"];
      bicycleColors.forEach((color) => {
        this.load.spritesheet(
          `bicycle_body_${p.key}_${color}`,
          `/assets/bicycle/${p.dir}/Bicycle/All/${color}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // Preload bear riding assets (32x32 skins, 32x48 bear bodies)
    const bearPhases = [
      { key: "bear_idle", dir: "idle" },
      { key: "bear_walk", dir: "walk" },
      { key: "bear_run", dir: "run" },
      { key: "bear_attack", dir: "attack" },
      { key: "bear_hit", dir: "hit" },
      { key: "bear_dead", dir: "dead" }
    ];
    bearPhases.forEach((p) => {
      // 1. Character Skins (32x32)
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p.key}_body_${t}`,
          `/assets/bear/${p.dir}/Skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Character Eyes (32x32)
      genders.forEach((g) => {
        const genderDir = g === "male" ? "Male" : "Female";
        eyeColors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_eyes_${g}_${c}`,
            `/assets/bear/${p.dir}/Eyes/${genderDir}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Character Clothes (32x32)
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `${p.key}_clothes_${c}`,
          `/assets/bear/${p.dir}/Clothers/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Character Hair (32x32)
      const bearHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      bearHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `${p.key}_hair_${s}_${c}`,
            `/assets/bear/${p.dir}/Hair/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Character Hats (32x32)
      const bearHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      bearHats.forEach((h) => {
        const fileHat = h === "Santa Hat" ? "Santa hat" : h;
        this.load.spritesheet(
          `${p.key}_hat_${h}`,
          `/assets/bear/${p.dir}/Acc/${fileHat}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 6. Bear Body (32x48)
      this.load.spritesheet(
        `bear_body_${p.key}_Brown`,
        `/assets/bear/${p.dir}/Bear/Brown.png`,
        { frameWidth: 32, frameHeight: 48 }
      );
    });

    // Preload idle assets (32x32)
    // 1. Idle Skins (genderless)
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `idle_body_${t}`,
        `/assets/idle/skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Idle Eyes (gender x colors)
    genders.forEach((g) => {
      eyeColors.forEach((c) => {
        this.load.spritesheet(
          `idle_eyes_${g}_${c}`,
          `/assets/idle/eyes/${g}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 3. Idle Clothes (colors, stored under Farm)
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `idle_clothes_${c}`,
        `/assets/idle/clothes/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 4. Idle Hair (styles x colors)
    const idleHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    idleHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `idle_hair_${s}_${c}`,
          `/assets/idle/hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 5. Idle Hats (accessories)
    const idleHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa hat", "Wizard", "pirate eye patch"];
    idleHats.forEach((h) => {
      this.load.spritesheet(
        `idle_hat_${h}`,
        `/assets/idle/hats/${h}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // --- Preload climbing assets (32x32, 5 frames) ---
    // 1. Character Skins (32x32)
    skinTones.forEach((t) => {
      this.load.spritesheet(
        `climb_body_${t}`,
        `/assets/climb/Skins/${t}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 2. Character Clothes (32x32)
    clothesColors.forEach((c) => {
      this.load.spritesheet(
        `climb_clothes_${c}`,
        `/assets/climb/Clothers/Farm/${c}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // 3. Character Hair (32x32)
    const climbHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
    climbHairStyles.forEach((s) => {
      colors.forEach((c) => {
        this.load.spritesheet(
          `climb_hair_${s}_${c}`,
          `/assets/climb/Hair/${s}/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // 4. Character Hats (32x32)
    const climbHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
    climbHats.forEach((h) => {
      const fileHat = h === "Santa Hat" ? "Santa hat" : h;
      this.load.spritesheet(
        `climb_hat_${h}`,
        `/assets/climb/Acc/${fileHat}.png`,
        { frameWidth: 32, frameHeight: 32 }
      );
    });

    // --- Preload broomstick assets (32x32, 16 frames) ---
    const broomstickPhases = ["broomstick_idle", "broomstick_walk", "broomstick_run"];
    broomstickPhases.forEach((p) => {
      // 1. Skins
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p}_body_${t}`,
          `/assets/broomstick/Skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Eyes
      eyeColors.forEach((c) => {
        genders.forEach((g) => {
          const genderDir = g === "male" ? "Male" : "Female";
          this.load.spritesheet(
            `${p}_eyes_${g}_${c}`,
            `/assets/broomstick/Eyes/${genderDir}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 3. Clothes
      clothesColors.forEach((c) => {
        this.load.spritesheet(
          `${p}_clothes_${c}`,
          `/assets/broomstick/Clothers/Farm/${c}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 4. Hairs
      const broomstickHairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
      broomstickHairStyles.forEach((s) => {
        colors.forEach((c) => {
          this.load.spritesheet(
            `${p}_hair_${s}_${c}`,
            `/assets/broomstick/Hair/${s}/${c}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      });

      // 5. Hats
      const broomstickHats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
      broomstickHats.forEach((h) => {
        const fileHat = h === "Santa Hat" ? "Santa hat" : h;
        this.load.spritesheet(
          `${p}_hat_${h}`,
          `/assets/broomstick/Acc/${fileHat}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 6. Broomsticks
      const broomstickIds = [1, 2, 3];
      broomstickIds.forEach((i) => {
        this.load.spritesheet(
          `broomstick_body_${p}_${i}`,
          `/assets/broomstick/Broomstick/${i}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });
    });

    // --- Preload swimming assets ---
    const swimPhases = [
      { key: "swim_idle", dir: "idle", frames: 4 },
      { key: "swim_swim", dir: "swim", frames: 4 },
      { key: "swim_outwater", dir: "outwater", frames: 3 },
      { key: "swim_submerged", dir: "submerged", frames: 3 }
    ];

    swimPhases.forEach((p) => {
      // 1. Skins
      skinTones.forEach((t) => {
        this.load.spritesheet(
          `${p.key}_body_${t}`,
          `/assets/swim/${p.dir}/Skins/${t}.png`,
          { frameWidth: 32, frameHeight: 32 }
        );
      });

      // 2. Eyes (only if present in phase)
      if (p.key === "swim_idle" || p.key === "swim_swim") {
        genders.forEach((g) => {
          const genderDir = g === "male" ? "Male" : "Female";
          eyeColors.forEach((c) => {
            this.load.spritesheet(
              `${p.key}_eyes_${g}_${c}`,
              `/assets/swim/${p.dir}/Eyes/${genderDir}/${c}.png`,
              { frameWidth: 32, frameHeight: 32 }
            );
          });
        });
      }

      // 3. Hair (only if present in phase)
      if (p.key !== "swim_submerged") {
        const hairStyles = ["Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist", "Standard"];
        hairStyles.forEach((s) => {
          colors.forEach((c) => {
            this.load.spritesheet(
              `${p.key}_hair_${s}_${c}`,
              `/assets/swim/${p.dir}/Hair/${s}/${c}.png`,
              { frameWidth: 32, frameHeight: 32 }
            );
          });
        });
      }

      // 4. Hats (only if present in phase)
      if (p.key !== "swim_submerged") {
        const hats = ["Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun", "Pirate", "Santa Hat", "Wizard", "pirate eye patch"];
        hats.forEach((h) => {
          const fileHat = h === "Santa Hat" ? "Santa hat" : h;
          this.load.spritesheet(
            `${p.key}_hat_${h}`,
            `/assets/swim/${p.dir}/Acc/${fileHat}.png`,
            { frameWidth: 32, frameHeight: 32 }
          );
        });
      }
    });

    // --- Load map editor custom assets ---
    this.load.spritesheet("wood", "/assets/editor/wood.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("well", "/assets/editor/well.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("fountain", "/assets/editor/fountain.png", { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet("tree_water_2", "/assets/editor/tree_water_2.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("maple_tree", "/assets/editor/Maple Tree Animation.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("stones_anim", "/assets/editor/stones_anim.png", { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet("wood_boat_anim", "/assets/editor/wood_boat_anim.png", { frameWidth: 176, frameHeight: 112 });
    this.load.spritesheet("wood_canoe_anim", "/assets/editor/wood_canoe_anim.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("tractor", "/assets/vehicles/Tractor_16x16.png", { frameWidth: 96, frameHeight: 96 });
    for (let i = 1; i <= 27; i++) {
      this.load.image(`house_${i}`, `/assets/editor/house_${i}.png`);
    }
    const barnParts = [
      'indoor_barn_summer_full',
      'indoor_barn_summer_frame',
      'indoor_barn_roof_blue',
      'indoor_barn_roof_red',
      'indoor_barn_roof_grey',
      'indoor_barn_roof_brown',
      'indoor_barn_wall_red',
      'indoor_barn_wall_beige',
      'indoor_barn_wall_white',
      'indoor_barn_wall_brown',
      'indoor_barn_winter_full',
      'indoor_barn_winter_frame',
      'indoor_barn_pole',
      'indoor_barn_winter_roof_left',
      'indoor_barn_winter_roof_right'
    ];
    barnParts.forEach(part => {
      this.load.image(part, `/assets/editor/${part}.png`);
    });
    this.load.image("indoor_deluxe_barn", "/assets/editor/indoor_deluxe_barn.png");
    // this.load.image("zemin_tileset", "/assets/editor/zemin_tileset.png");

    // --- Yön Okları (neon arrow signs) ---
    this.load.image("yon_asagi",  "/assets/yon/yon_asagi.png");
    this.load.image("yon_yukari", "/assets/yon/yon_yukari.png");
    this.load.image("yon_sag",    "/assets/yon/yon_sag.png");
    this.load.image("yon_sol",    "/assets/yon/yon_sol.png");


    // --- Load plant and water animation spritesheets ---
    this.load.spritesheet("root_land", "/assets/su_animasyonu/Root.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("root_water_1", "/assets/su_animasyonu/Root Water 1.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("root_water_2", "/assets/su_animasyonu/Root Water 2.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("root_water_3", "/assets/su_animasyonu/Root Water 3.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("dekor_tree", "/assets/editor/Tree.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("mineral_sheet", "/assets/editor/stone_with_minerals.png", { frameWidth: 16, frameHeight: 16 });

    // --- Load Archer Goblin Spritesheets (32x32px, 3 rows: 0=Down, 1=Up, 2=Side) ---
    this.load.spritesheet("archer_goblin_idle", "/assets/enemy/Goblins/Archer Goblin/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("archer_goblin_walk", "/assets/enemy/Goblins/Archer Goblin/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("archer_goblin_run", "/assets/enemy/Goblins/Archer Goblin/Run.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("archer_goblin_bow", "/assets/enemy/Goblins/Archer Goblin/Bow.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("archer_goblin_damage", "/assets/enemy/Goblins/Archer Goblin/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("archer_goblin_dead", "/assets/enemy/Goblins/Archer Goblin/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Bomb Goblin Spritesheets (32x32px, 3 rows: 0=Down, 1=Up, 2=Side) ---
    this.load.spritesheet("bomb_goblin_idle", "/assets/enemy/Goblins/Bomb Goblin/Idle bomb.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bomb_goblin_walk", "/assets/enemy/Goblins/Bomb Goblin/Walk bomb.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bomb_goblin_run", "/assets/enemy/Goblins/Bomb Goblin/Run bomb.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bomb_goblin_throw", "/assets/enemy/Goblins/Bomb Goblin/Throw a bomb.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bomb_goblin_damage", "/assets/enemy/Goblins/Bomb Goblin/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bomb_goblin_dead", "/assets/enemy/Goblins/Bomb Goblin/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Spear Goblin Spritesheets (32x32px, 3 rows: 0=Down, 1=Up, 2=Side) ---
    this.load.spritesheet("spear_goblin_idle", "/assets/enemy/Goblins/Spear Goblin/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spear_goblin_walk", "/assets/enemy/Goblins/Spear Goblin/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spear_goblin_run", "/assets/enemy/Goblins/Spear Goblin/Run.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spear_goblin_spear", "/assets/enemy/Goblins/Spear Goblin/Spear.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spear_goblin_damage", "/assets/enemy/Goblins/Spear Goblin/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spear_goblin_dead", "/assets/enemy/Goblins/Spear Goblin/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Blue Enemy Spritesheets (32x32px, 4 rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    this.load.spritesheet("blue_enemy_idle", "/assets/enemy/Blue/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("blue_enemy_walk", "/assets/enemy/Blue/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("blue_enemy_attack", "/assets/enemy/Blue/Attack.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("blue_enemy_damage", "/assets/enemy/Blue/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("blue_enemy_dead", "/assets/enemy/Blue/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Green Enemy Spritesheets (32x32px, 4 rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    this.load.spritesheet("green_enemy_idle", "/assets/enemy/Green/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("green_enemy_walk", "/assets/enemy/Green/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("green_enemy_attack", "/assets/enemy/Green/Attack.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("green_enemy_damage", "/assets/enemy/Green/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("green_enemy_dead", "/assets/enemy/Green/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Pink Myconid Spritesheets (32x32px, 4 rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    this.load.spritesheet("pink_myconid_idle", "/assets/enemy/Myconid/Pink/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pink_myconid_walk", "/assets/enemy/Myconid/Pink/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pink_myconid_attack", "/assets/enemy/Myconid/Pink/Attack.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pink_myconid_damage", "/assets/enemy/Myconid/Pink/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pink_myconid_dead", "/assets/enemy/Myconid/Pink/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Purple Myconid Spritesheets (32x32px, 4 rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    this.load.spritesheet("purple_myconid_idle", "/assets/enemy/Myconid/Purple/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("purple_myconid_walk", "/assets/enemy/Myconid/Purple/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("purple_myconid_attack", "/assets/enemy/Myconid/Purple/Attack.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("purple_myconid_damage", "/assets/enemy/Myconid/Purple/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("purple_myconid_dead", "/assets/enemy/Myconid/Purple/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Red Myconid Spritesheets (32x32px, 4 rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    this.load.spritesheet("red_myconid_idle", "/assets/enemy/Myconid/Red/Idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("red_myconid_walk", "/assets/enemy/Myconid/Red/Walk.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("red_myconid_attack", "/assets/enemy/Myconid/Red/Attack.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("red_myconid_damage", "/assets/enemy/Myconid/Red/Damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("red_myconid_dead", "/assets/enemy/Myconid/Red/Dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Goblin Merchant Spritesheet (64x64px, 6 frames) ---
    this.load.spritesheet("goblin_merchant", "/assets/enemy/Goblins/Goblin merchant/1.png", { frameWidth: 64, frameHeight: 64 });

    // --- Load Spike Spritesheets (32x32px, 3 rows: 0=Down, 1=Up, 2=Side) ---
    this.load.spritesheet("spike_idle", "/assets/enemy/Spike/idle.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spike_entering", "/assets/enemy/Spike/entering.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spike_leaving", "/assets/enemy/Spike/leaving.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spike_attack", "/assets/enemy/Spike/spitting.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spike_damage", "/assets/enemy/Spike/damage.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("spike_dead", "/assets/enemy/Spike/dead.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Spike Projectiles (16x16px, 3 rows: 0=Down, 1=Up, 2=Side) ---
    this.load.spritesheet("spike_projectile_yellow", "/assets/enemy/Spike/projectile/Yellow.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("spike_projectile_green", "/assets/enemy/Spike/projectile/Green.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("spike_projectile_pink", "/assets/enemy/Spike/projectile/Pink.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("spike_projectile_pupple", "/assets/enemy/Spike/projectile/Pupple.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("spike_projectile_red", "/assets/enemy/Spike/projectile/Red.png", { frameWidth: 16, frameHeight: 16 });

    // --- Load Chicken Spritesheets (64x112px, 16x16px frames) ---
    this.load.spritesheet("animal_chicken_black_white", "/assets/animals/chicken_black_white.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_black", "/assets/animals/chicken_black.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_blonde_green", "/assets/animals/chicken_blonde_green.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_blonde", "/assets/animals/chicken_blonde.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_brown_black", "/assets/animals/chicken_brown_black.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_brown_white", "/assets/animals/chicken_brown_white.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_evil", "/assets/animals/chicken_evil.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_full", "/assets/animals/chicken_full.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_green", "/assets/animals/chicken_green.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_pink", "/assets/animals/chicken_pink.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_red", "/assets/animals/chicken_red.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_universe", "/assets/animals/chicken_universe.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("animal_chicken_white", "/assets/animals/chicken_white.png", { frameWidth: 16, frameHeight: 16 });

    // --- Load Cow Spritesheets (128x288px, 32x32px frames) ---
    this.load.spritesheet("animal_cow_black", "/assets/animals/cow_black.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_cow_blonde", "/assets/animals/cow_blonde.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_cow_brown", "/assets/animals/cow_brown.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_cow_pink", "/assets/animals/cow_pink.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Sheep Spritesheets (128x288px, 32x32px frames) ---
    this.load.spritesheet("animal_sheep_white", "/assets/animals/sheep_female.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_sheep_spotted", "/assets/animals/sheep_female_2.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Pig Spritesheets (128x288px, 32x32px frames) ---
    this.load.spritesheet("animal_pig_baby_mud", "/assets/animals/pig_baby_mud.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_pig_baby", "/assets/animals/pig_baby.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_pig_mud", "/assets/animals/pig_mud.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("animal_pig_pink", "/assets/animals/pig_pink.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Companion Cat Spritesheets (128x416px, 32x32px frames) ---
    this.load.spritesheet("pet_cat_black", "/assets/animals/pet_cat_black.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_brown", "/assets/animals/pet_cat_brown.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_ginger", "/assets/animals/pet_cat_ginger.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_gray", "/assets/animals/pet_cat_gray.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_light_brown", "/assets/animals/pet_cat_light_brown.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_light_gray", "/assets/animals/pet_cat_light_gray.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_pink", "/assets/animals/pet_cat_pink.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_cat_white", "/assets/animals/pet_cat_white.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Companion Dog Spritesheets (32x32px frames) ---
    this.load.spritesheet("pet_dog_1", "/assets/animals/pet_dog_1.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_2", "/assets/animals/pet_dog_2.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_3", "/assets/animals/pet_dog_3.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_4", "/assets/animals/pet_dog_4.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_5", "/assets/animals/pet_dog_5.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_6", "/assets/animals/pet_dog_6.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_7", "/assets/animals/pet_dog_7.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("pet_dog_8", "/assets/animals/pet_dog_8.png", { frameWidth: 32, frameHeight: 32 });

    // --- Load Fish Spawn Point Spritesheets (64x16px, 16x16px frames) ---
    for (let i = 1; i <= 6; i++) {
      this.load.spritesheet(`fish_point_${i}`, `/assets/editor/fish_point_${i}.png`, { frameWidth: 16, frameHeight: 16 });
    }
    // --- Load Waterfall Tilesets (512x128px, 16x16 tiles, 32 cols × 8 rows) ---
    this.load.image("waterfall_summer", "/assets/waterfall/Summer Waterfall.png");
    this.load.image("waterfall_deepforest", "/assets/waterfall/Deep Forest Waterfall.png");
    this.load.image("waterfall_fall", "/assets/waterfall/Fall Waterfall.png");
    this.load.image("waterfall_spring", "/assets/waterfall/Spring Waterfall.png");

    // --- Load Crops ---
    this.load.spritesheet("crop_adzuki_bean", "/assets/mahsul/adzuki_bean.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_asparagus", "/assets/mahsul/asparagus.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_bell_pepper", "/assets/mahsul/bell_pepper.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_blackberry", "/assets/mahsul/blackberry.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_blueberry", "/assets/mahsul/blueberry.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_broccoli", "/assets/mahsul/broccoli.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_cabbage", "/assets/mahsul/cabbage.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_carrot", "/assets/mahsul/carrot.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_cauliflower", "/assets/mahsul/cauliflower.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_cucumber", "/assets/mahsul/cucumber.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_green_beans", "/assets/mahsul/green_beans.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_hot_pepper", "/assets/mahsul/hot_pepper.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_melon", "/assets/mahsul/melon.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_onion", "/assets/mahsul/onion.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_parsnip", "/assets/mahsul/parsnip.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_pineapple", "/assets/mahsul/pineapple.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_potato", "/assets/mahsul/potato.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_rice", "/assets/mahsul/rice.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_spring_onion", "/assets/mahsul/spring_onion.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_strawberry", "/assets/mahsul/strawberry.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_sunflower", "/assets/mahsul/sunflower.png", { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet("crop_tomato", "/assets/mahsul/tomato.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_watermelon", "/assets/mahsul/watermelon.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("crop_wheat", "/assets/mahsul/wheat.png", { frameWidth: 16, frameHeight: 16 });

    // --- Load Terrain Tilesets ---
    this.load.image("terrain_grass_summer", "/assets/tileset/Tileset Grass Summer.png");
    this.load.image("terrain_box_dekor", "/assets/tileset/Box.png");
    this.load.image("terrain_tree_trunks", "/assets/tileset/TreeTrunks.png");
    this.load.image("terrain_big_old_tree", "/assets/tileset/BigOldTree.png");
    this.load.image("terrain_bushes", "/assets/tileset/Bushes.png");
    this.load.image("terrain_barn", "/assets/tileset/tileset_barn.png");
    this.load.image("terrain_beach_anims", "/assets/tileset/tileset_beach_anims.png");
    this.load.image("terrain_bridge_beach", "/assets/tileset/tileset_bridge_beach.png");
    this.load.image("terrain_dungeon", "/assets/tileset/tileset_dungeon.png");
    this.load.image("terrain_extra_village", "/assets/tileset/tileset_extra_village.png");
    this.load.image("terrain_grass_cliff_spring", "/assets/tileset/tileset_grass_cliff_spring.png");
    this.load.image("terrain_grass_cliff_summer", "/assets/tileset/tileset_grass_cliff_summer.png");
    this.load.image("terrain_grass_spring", "/assets/tileset/tileset_grass_spring.png");
    this.load.image("terrain_grass_water_spring", "/assets/tileset/tileset_grass_water_spring.png");
    this.load.image("terrain_grass_water_summer", "/assets/tileset/tileset_grass_water_summer.png");
    // --- New Tilesets ---
    this.load.image("terrain_grass_deep_forest",      "/assets/tileset/tileset_grass_deep_forest.png");
    this.load.image("terrain_grass_fall",             "/assets/tileset/tileset_grass_fall.png");
    this.load.image("terrain_grass_water_deep_forest","/assets/tileset/tileset_grass_water_deep_forest.png");
    this.load.image("terrain_grass_water_fall",       "/assets/tileset/tileset_grass_water_fall.png");
    this.load.image("terrain_grass_water_winter",     "/assets/tileset/tileset_grass_water_winter.png");
    this.load.image("terrain_grass_winter",           "/assets/tileset/tileset_grass_winter.png");
    this.load.image("terrain_grass_winter2",          "/assets/tileset/tileset_grass_winter2.png");
    this.load.image("terrain_house",                  "/assets/tileset/tileset_house.png");
    this.load.image("terrain_temple",                 "/assets/tileset/tileset_temple.png");
    this.load.image("terrain_tilled_soil",            "/assets/tileset/tileset_tilled_soil.png");

    // --- Load 11 New Tilesets ---
    this.load.image("terrain_cave_water_ground_anims", "/assets/tileset/Cave_Water_Ground_animations_tiles.png");
    this.load.image("terrain_water_ground_anims",      "/assets/tileset/Water_Ground_animations_tiles.png");
    this.load.image("terrain_frozen_water_ground",     "/assets/tileset/Frozen_Water_Ground_tiles.png");
    this.load.image("terrain_path_tiles",              "/assets/tileset/Path_tiles.png");
    this.load.image("terrain_carpet_tiles",            "/assets/tileset/carpet.png");
    this.load.image("terrain_grass_cliff_deep_forest", "/assets/tileset/Tileset_Grass_Cliff_Tileset_Deep_Forest.png");
    this.load.image("terrain_grass_cliff_fall",        "/assets/tileset/Tileset_Grass_Cliff_Tileset_Fall.png");
    this.load.image("terrain_grass_cliff_winter",      "/assets/tileset/Tileset_Grass_Cliff_Tileset_Winter.png");
    this.load.image("terrain_caves",                   "/assets/tileset/Caves.png");
    this.load.image("terrain_rock_caves",              "/assets/tileset/Rock_Caves.png");
    this.load.image("terrain_grass_caves",             "/assets/tileset/Tileset_Grass_Caves.png");

    // --- Load Dekor 3 Tilesets ---
    this.load.image("terrain_d3_all_props_seasons","/assets/dekor3/ALL_props_seasons.png");
    this.load.image("terrain_d3_beach_exterior",   "/assets/dekor3/Beach_Exterior.png");
    this.load.image("terrain_d3_exterior_beach",   "/assets/dekor3/Exterior_Beach.png");
    this.load.image("terrain_d3_fireplace",        "/assets/dekor3/Fireplace.png");
    this.load.image("terrain_d3_fish",             "/assets/dekor3/Fish.png");
    this.load.image("terrain_d3_plants",           "/assets/dekor3/plants.png");
    this.load.image("terrain_d3_propswater_summer","/assets/dekor3/PropsWater_Summer.png");
    this.load.image("terrain_d3_road",             "/assets/dekor3/Road.png");
    this.load.image("terrain_d3_sea_coral",        "/assets/dekor3/sea_coral.png");

    // --- Load Inşaat (Construction) Tilesets ---
    this.load.image("terrain_insaat_bridge_beach", "/assets/insaat/Bridge_Beach.png");
    this.load.image("terrain_insaat_bridge",       "/assets/insaat/Bridge.png");
    this.load.image("terrain_insaat_fence_iron",   "/assets/insaat/Fence_Iron.png");
    this.load.image("terrain_insaat_fence_stone",  "/assets/insaat/Fence_Stone.png");
    this.load.image("terrain_insaat_fence_wood",   "/assets/insaat/Fence_Wood.png");
    this.load.image("terrain_insaat_white_fence",  "/assets/insaat/White_Fence.png");


    // --- Load new static decors ---
    const newDecors = [
      'construction_area',
      'newsstand',
      'sawmill',
      'sharpening_station',
      'telephone',
      'workbench',
      'ice_cream_car',
      'water_box'
    ];
    newDecors.forEach(dec => {
      this.load.image(dec, `/assets/editor/${dec}.png`);
    });

    const decor2Assets = [
      { key: "decor2_barn_small", file: "decor2/Barn_Small_16x16.png" },
      { key: "decor2_bucket_load", file: "decor2/Bucket_Load_16x16.png" },
      { key: "decor2_fruit_tree_stairs", file: "decor2/Fruit_Tree_Stairs_16x16.png" },
      { key: "decor2_hay_fresh_pile", file: "decor2/Hay_Fresh_Pile_16x16.png" },
      { key: "decor2_hay_fresh_pile_rake_red", file: "decor2/Hay_Fresh_Pile_Rake_Red_16x16.png" },
      { key: "decor2_nest_chicken", file: "decor2/Nest_Chicken_16x16.png" },
      { key: "decor2_pot_tree_apple", file: "decor2/Pot_Tree_Apple_16x16.png" },
      { key: "decor2_pot_tree_banana", file: "decor2/Pot_Tree_Banana_16x16.png" },
      { key: "decor2_pot_tree_lemon", file: "decor2/Pot_Tree_Lemon_16x16.png" },
      { key: "decor2_pot_tree_orange", file: "decor2/Pot_Tree_Orange_16x16.png" },
      { key: "decor2_pot_tree_peach", file: "decor2/Pot_Tree_Peach_16x16.png" },
      { key: "decor2_silos", file: "decor2/Silos_1_16x16.png" },
      { key: "decor2_stable_example_outside", file: "decor2/Stable_Example_Outside_16x16.png" },
      { key: "decor2_stone_oven", file: "decor2/Stone_Oven_3_16x16.png" },
      { key: "decor2_tailor_crafting_table_full", file: "decor2/Tailor_Crafting_Table_Full_16x16.png" },
      { key: "decor2_tree_pine_dark_green_medium", file: "decor2/Tree_Pine_Dark_Green_Medium_16x16.png" },
      { key: "decor2_tree_trunk_oak_big", file: "decor2/Tree_Trunk_Oak_Big_16x16.png" },
      { key: "decor2_tree_trunk_oak_huge", file: "decor2/Tree_Trunk_Oak_Huge_16x16.png" },
      { key: "decor2_weathercock_roof_farmer_house", file: "decor2/Weathercock_Roof_Farmer_House_16x16.png" },
      { key: "decor2_well_stone", file: "decor2/Well_Stone_16x16.png" },
      { key: "decor2_wood_board_load", file: "decor2/Wood_Board_Load_16x16.png" },
      { key: "decor2_woodwork_crafting_table_full", file: "decor2/Woodwork_Crafting_Table_Full_16x16.png" }
    ];
    decor2Assets.forEach(dec => {
      this.load.image(dec.key, `/assets/${dec.file}`);
    });
  }

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  create(): void {
    this.room = this.registry.get("room") as Room;
    this.localSessionId = this.registry.get("sessionId") as string;

    // Generate placeholder animal textures dynamically (Purple, Orange, Teal, Green, Red)
    const placeholderColors = [0x9b59b6, 0xe67e22, 0x1abc9c, 0x2ecc71, 0xe74c3c];
    placeholderColors.forEach((color, i) => {
      const key = `animal_placeholder_${i + 1}`;
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeRect(0, 0, 32, 32);
      g.generateTexture(key, 32, 32);
      g.destroy();
    });



    if (!this.room) {
      console.error("[GameScene] No Colyseus room found in registry!");
      return;
    }

    // --- World bounds -------------------------------------------------------
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // --- Draw the ground grid -----------------------------------------------
    this.drawGround();

    // --- Camera setup -------------------------------------------------------
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const getMinZoom = () => {
      const cam = this.cameras.main;
      return Math.max(cam.width / WORLD_WIDTH, cam.height / WORLD_HEIGHT);
    };

    const initialZoom = Math.max(2, getMinZoom());
    this.cameras.main.setZoom(initialZoom);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    // --- Mouse wheel zoom ---------------------------------------------------
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
      const cam = this.cameras.main;
      const currentZoom = cam.zoom;
      // Scroll up = zoom in, scroll down = zoom out
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const minZoom = getMinZoom();
      const newZoom = Phaser.Math.Clamp(currentZoom * zoomFactor, minZoom, 6);
      cam.setZoom(newZoom);
    });

    this.scale.on("resize", () => {
      const cam = this.cameras.main;
      const minZoom = getMinZoom();
      if (cam.zoom < minZoom) {
        cam.setZoom(minZoom);
      }
    });

    // --- Input setup --------------------------------------------------------
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // --- Colyseus state listeners -------------------------------------------
    // --- Wood Animation ---
    this.anims.create({
      key: "wood_anim",
      frames: this.anims.generateFrameNumbers("wood", { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    // --- Well Animations (4 variants) ---
    for (let i = 0; i < 4; i++) {
      this.anims.create({
        key: `well_anim_${i}`,
        frames: this.anims.generateFrameNumbers("well", { start: i * 4, end: i * 4 + 3 }),
        frameRate: 6,
        repeat: -1
      });
    }

    // --- Fountain Animations (2 variants) ---
    for (let i = 0; i < 2; i++) {
      this.anims.create({
        key: `fountain_anim_${i}`,
        frames: this.anims.generateFrameNumbers("fountain", { start: i * 4, end: i * 4 + 3 }),
        frameRate: 6,
        repeat: -1
      });
    }

    // --- Tree Water 2 Animations (4 variants) ---
    for (let i = 0; i < 4; i++) {
      this.anims.create({
        key: `tree_water_2_anim_${i}`,
        frames: this.anims.generateFrameNumbers("tree_water_2", { start: i * 4, end: i * 4 + 3 }),
        frameRate: 6,
        repeat: -1
      });
    }

    // --- Maple Tree Animations (7 rows/sway variants) ---
    for (let r = 0; r < 7; r++) {
      this.anims.create({
        key: `maple_tree_row_${r}`,
        frames: this.anims.generateFrameNumbers("maple_tree", { start: r * 4 + 2, end: r * 4 + 3 }),
        frameRate: 4,
        repeat: -1
      });
    }

    // --- Stones Animations (Small: Row 0, Large: Row 1) ---
    this.anims.create({
      key: "stones_small_anim",
      frames: this.anims.generateFrameNumbers("stones_anim", { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: "stones_large_anim",
      frames: this.anims.generateFrameNumbers("stones_anim", { start: 4, end: 7 }),
      frameRate: 6,
      repeat: -1
    });

    // --- Wood Boat Animation (4 frames, single row) ---
    this.anims.create({
      key: "wood_boat_anim",
      frames: this.anims.generateFrameNumbers("wood_boat_anim", { start: 0, end: 3 }),
      frameRate: 5,
      repeat: -1
    });

    // --- Wood Canoe Animation (4 frames, single row) ---
    this.anims.create({
      key: "wood_canoe_anim",
      frames: this.anims.generateFrameNumbers("wood_canoe_anim", { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    // --- Root Water Animations (5 colors * 3 stages) ---
    for (let color = 0; color < 5; color++) {
      for (let stage = 1; stage <= 3; stage++) {
        this.anims.create({
          key: `root_water_anim_${color}_${stage}`,
          frames: this.anims.generateFrameNumbers(`root_water_${stage}`, { start: color * 4, end: color * 4 + 3 }),
          frameRate: 6,
          repeat: -1
        });
      }
    }

    // --- Archer Goblin Animations (3 Rows: 0=Down/Front, 1=Up/Back, 2=Side/Right & Left) ---
    const rowMapping: Record<string, number> = {
      down: 0,
      up: 1,
      right: 2,
      left: 2
    };

    ["down", "up", "right", "left"].forEach((dir) => {
      const row = rowMapping[dir];
      // Archer Goblin
      this.anims.create({ key: `archer_goblin_idle_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `archer_goblin_walk_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `archer_goblin_run_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `archer_goblin_returning_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `archer_goblin_attack_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_bow", { start: row * 7, end: row * 7 + 6 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `archer_goblin_damage_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `archer_goblin_dead_${dir}`, frames: this.anims.generateFrameNumbers("archer_goblin_dead", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: 0 });

      // Bomb Goblin
      this.anims.create({ key: `bomb_goblin_idle_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `bomb_goblin_walk_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `bomb_goblin_run_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `bomb_goblin_returning_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `bomb_goblin_attack_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_throw", { start: row * 5, end: row * 5 + 4 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `bomb_goblin_damage_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `bomb_goblin_dead_${dir}`, frames: this.anims.generateFrameNumbers("bomb_goblin_dead", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: 0 });

      // Spear Goblin
      this.anims.create({ key: `spear_goblin_idle_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `spear_goblin_walk_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `spear_goblin_run_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `spear_goblin_returning_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_run", { start: row * 8, end: row * 8 + 7 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `spear_goblin_attack_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_spear", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `spear_goblin_damage_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `spear_goblin_dead_${dir}`, frames: this.anims.generateFrameNumbers("spear_goblin_dead", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: 0 });

      // Spike
      this.anims.create({ key: `spike_idle_${dir}`, frames: this.anims.generateFrameNumbers("spike_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `spike_entering_${dir}`, frames: this.anims.generateFrameNumbers("spike_entering", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `spike_leaving_${dir}`, frames: this.anims.generateFrameNumbers("spike_leaving", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `spike_attack_${dir}`, frames: this.anims.generateFrameNumbers("spike_attack", { start: row * 5, end: row * 5 + 4 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `spike_damage_${dir}`, frames: this.anims.generateFrameNumbers("spike_damage", { start: row * 2, end: row * 2 + 1 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `spike_dead_${dir}`, frames: this.anims.generateFrameNumbers("spike_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });

      // Spike Projectiles
      ["yellow", "green", "pink", "pupple", "red"].forEach((color) => {
        this.anims.create({
          key: `spike_projectile_${color}_${dir}`,
          frames: this.anims.generateFrameNumbers(`spike_projectile_${color}`, { start: row * 20, end: row * 20 + 19 }),
          frameRate: 15,
          repeat: -1
        });
      });
    });

    // --- Blue Enemy Animations (4 Rows: 0=Down, 1=Up, 2=Right, 3=Left) ---
    const blueRowMapping: Record<string, number> = {
      down: 0,
      up: 1,
      right: 2,
      left: 3
    };

    ["down", "up", "right", "left"].forEach((dir) => {
      const row = blueRowMapping[dir];
      // Blue Enemy
      this.anims.create({ key: `blue_enemy_idle_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `blue_enemy_walk_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `blue_enemy_run_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `blue_enemy_returning_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `blue_enemy_attack_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_attack", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `blue_enemy_damage_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `blue_enemy_dead_${dir}`, frames: this.anims.generateFrameNumbers("blue_enemy_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });

      // Green Enemy
      this.anims.create({ key: `green_enemy_idle_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `green_enemy_walk_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `green_enemy_run_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `green_enemy_returning_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `green_enemy_attack_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_attack", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `green_enemy_damage_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `green_enemy_dead_${dir}`, frames: this.anims.generateFrameNumbers("green_enemy_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });

      // Pink Myconid
      this.anims.create({ key: `pink_myconid_idle_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `pink_myconid_walk_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `pink_myconid_run_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `pink_myconid_returning_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `pink_myconid_attack_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_attack", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `pink_myconid_damage_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `pink_myconid_dead_${dir}`, frames: this.anims.generateFrameNumbers("pink_myconid_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });

      // Purple Myconid
      this.anims.create({ key: `purple_myconid_idle_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `purple_myconid_walk_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `purple_myconid_run_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `purple_myconid_returning_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `purple_myconid_attack_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_attack", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `purple_myconid_damage_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `purple_myconid_dead_${dir}`, frames: this.anims.generateFrameNumbers("purple_myconid_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });

      // Red Myconid
      this.anims.create({ key: `red_myconid_idle_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_idle", { start: row * 4, end: row * 4 + 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: `red_myconid_walk_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `red_myconid_run_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `red_myconid_returning_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_walk", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `red_myconid_attack_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_attack", { start: row * 6, end: row * 6 + 5 }), frameRate: 10, repeat: 0 });
      this.anims.create({ key: `red_myconid_damage_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_damage", { start: row * 4, end: row * 4 + 3 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `red_myconid_dead_${dir}`, frames: this.anims.generateFrameNumbers("red_myconid_dead", { start: row * 5, end: row * 5 + 4 }), frameRate: 6, repeat: 0 });
    });



    // --- Animal Animations (Chicken Variations) ---
    const animalTypes = [
      "animal_chicken_black_white",
      "animal_chicken_black",
      "animal_chicken_blonde_green",
      "animal_chicken_blonde",
      "animal_chicken_brown_black",
      "animal_chicken_brown_white",
      "animal_chicken_evil",
      "animal_chicken_full",
      "animal_chicken_green",
      "animal_chicken_pink",
      "animal_chicken_red",
      "animal_chicken_universe",
      "animal_chicken_white"
    ];

    const dirs = ["down", "left", "right", "up"];
    const dirOffsets: Record<string, number> = { down: 0, left: 4, right: 8, up: 12 };

    animalTypes.forEach((typeKey) => {
      dirs.forEach((dir) => {
        const offset = dirOffsets[dir];
        // Walk animation
        this.anims.create({
          key: `${typeKey}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 6,
          repeat: -1
        });
        // Idle animation
        this.anims.create({
          key: `${typeKey}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 4,
          repeat: -1
        });
      });
    });

    // --- Animal Animations (Cow Variations) ---
    const cowTypes = [
      "animal_cow_black",
      "animal_cow_blonde",
      "animal_cow_brown",
      "animal_cow_pink"
    ];

    const cowDirs = ["left", "down", "up", "right"];
    const cowDirOffsets: Record<string, number> = { left: 0, down: 4, up: 8, right: 12 };

    cowTypes.forEach((typeKey) => {
      cowDirs.forEach((dir) => {
        const offset = cowDirOffsets[dir];
        // Walk animation
        this.anims.create({
          key: `${typeKey}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 6,
          repeat: -1
        });
        // Idle animation
        this.anims.create({
          key: `${typeKey}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 4,
          repeat: -1
        });
      });
    });

    // --- Animal Animations (Sheep Variations) ---
    const sheepTypes = [
      "animal_sheep_white",
      "animal_sheep_spotted"
    ];

    const sheepDirs = ["left", "down", "up", "right"];
    const sheepDirOffsets: Record<string, number> = { left: 0, down: 4, up: 8, right: 12 };

    sheepTypes.forEach((typeKey) => {
      sheepDirs.forEach((dir) => {
        const offset = sheepDirOffsets[dir];
        // Walk animation
        this.anims.create({
          key: `${typeKey}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 6,
          repeat: -1
        });
        // Idle animation
        this.anims.create({
          key: `${typeKey}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 4,
          repeat: -1
        });
      });
    });

    // --- Animal Animations (Pig Variations) ---
    const pigTypes = [
      "animal_pig_baby_mud",
      "animal_pig_baby",
      "animal_pig_mud",
      "animal_pig_pink"
    ];

    const pigDirs = ["left", "down", "up", "right"];
    const pigDirOffsets: Record<string, number> = { left: 0, down: 4, up: 8, right: 12 };

    pigTypes.forEach((typeKey) => {
      pigDirs.forEach((dir) => {
        const offset = pigDirOffsets[dir];
        // Walk animation
        this.anims.create({
          key: `${typeKey}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 6,
          repeat: -1
        });
        // Idle animation
        this.anims.create({
          key: `${typeKey}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(typeKey, { start: offset, end: offset + 3 }),
          frameRate: 4,
          repeat: -1
        });
      });
    });

    // --- Companion Cat Animations ---
    const catTypes = [
      "pet_cat_black",
      "pet_cat_brown",
      "pet_cat_ginger",
      "pet_cat_gray",
      "pet_cat_light_brown",
      "pet_cat_light_gray",
      "pet_cat_pink",
      "pet_cat_white"
    ];

    catTypes.forEach((typeKey) => {
      // 1. Walk animations
      this.anims.create({
        key: `${typeKey}_walk_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 4, end: 7 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 8, end: 11 }),
        frameRate: 6,
        repeat: -1
      });

      // 2. Idle animations
      this.anims.create({
        key: `${typeKey}_idle_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 4, end: 7 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 8, end: 11 }),
        frameRate: 4,
        repeat: -1
      });

      // 3. Sleep animations (Row 9: 36-39, Row 12: 48-51)
      this.anims.create({
        key: `${typeKey}_sleep_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 36, end: 39 }),
        frameRate: 2,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_sleep_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 36, end: 39 }),
        frameRate: 2,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_sleep_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 48, end: 51 }),
        frameRate: 2,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_sleep_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 48, end: 51 }),
        frameRate: 2,
        repeat: -1
      });
    });

    // --- Companion Dog Animations ---
    const dogs13 = ["pet_dog_1", "pet_dog_3", "pet_dog_5", "pet_dog_6", "pet_dog_7", "pet_dog_8"];
    const dogs12 = ["pet_dog_2", "pet_dog_4"];

    const registerDogAnims = (typeKey: string, is13: boolean) => {
      // 1. Walk animations
      this.anims.create({
        key: `${typeKey}_walk_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 4, end: 7 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_walk_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 8, end: 11 }),
        frameRate: 6,
        repeat: -1
      });

      // 2. Idle animations
      this.anims.create({
        key: `${typeKey}_idle_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 4, end: 7 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_idle_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 8, end: 11 }),
        frameRate: 4,
        repeat: -1
      });

      // 3. Sleep animations (Sleep Left at Row 10: 40-43)
      this.anims.create({
        key: `${typeKey}_sleep_left`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 40, end: 43 }),
        frameRate: 2,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_sleep_right`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: 40, end: 43 }),
        frameRate: 2,
        repeat: -1
      });

      // Curled Up Sleep Down/Up (13-row has it at Row 12: 48-51, 12-row has it at Row 11: 44-47)
      const sleepDownStart = is13 ? 48 : 44;
      const sleepDownEnd = is13 ? 51 : 47;
      
      this.anims.create({
        key: `${typeKey}_sleep_down`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: sleepDownStart, end: sleepDownEnd }),
        frameRate: 2,
        repeat: -1
      });
      this.anims.create({
        key: `${typeKey}_sleep_up`,
        frames: this.anims.generateFrameNumbers(typeKey, { start: sleepDownStart, end: sleepDownEnd }),
        frameRate: 2,
        repeat: -1
      });
    };

    dogs13.forEach(d => registerDogAnims(d, true));
    dogs12.forEach(d => registerDogAnims(d, false));

    // --- Create Fish Point Animations ---
    for (let i = 1; i <= 6; i++) {
      this.anims.create({
        key: `fish_point_${i}_anim`,
        frames: this.anims.generateFrameNumbers(`fish_point_${i}`, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
    }
    // Goblin Merchant Animation (64x64px, 6 frames)
    this.anims.create({
      key: "goblin_merchant_idle",
      frames: this.anims.generateFrameNumbers("goblin_merchant", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1
    });

    // --- Mineral mine sub-frames from stone_with_minerals.png (32x32 rocks) ---
    // Rock sprites at y=144-175 (rows 9-10 of 16px grid combined = 32px tall):
    //   Type 1 (x=0,  y=144): AMETHYST rock  (grey top + purple bottom)
    //   Type 2 (x=32, y=144): RUBY rock      (yellow top + red bottom)
    //   Type 3 (x=64, y=144): EMERALD rock   (grey top + green bottom)
    //   Type 4 (x=96, y=144): SAPPHIRE rock  (yellow top + cyan bottom)
    //   Type 5 (x=128,y=144): SILVER rock    (white/grey)
    //
    // White hit frames:
    //   Type 2 hit: (x=32, y=176) WHITE(193)
    //   Type 3 hit: (x=64, y=176) WHITE(213)
    //   Type 4 hit: (x=96, y=176) WHITE(230)
    //   Types 1,5 fallback to type 3 hit frame
    //
    // Larger rock variants at y=192-223 (same layout but more solid):
    //   Type 6 (x=0,  y=192), Type 7 (x=32,y=192), Type 8 (x=64,y=192)
    //   Type 9 (x=96, y=192), Type 10(x=128,y=192)
    //   Hit frames at y=208: type 8 (x=64), type 9 (x=96), type 10 (x=128)
    // Using 16x16 mineral_sheet spritesheet directly for mineral mines.

    this.belowPlayerGroup = this.add.group();
    this.samePlayerGroup = this.add.group();
    this.abovePlayerGroup = this.add.group();

    this.editorOutline = this.add.graphics();
    this.editorOutline.setDepth(9999); // Top layer

    this.fillRegionGfx = this.add.graphics();
    this.fillRegionGfx.setDepth(10000);

    this.editorPreviewRect = this.add.rectangle(0, 0, 32, 32, 0x00d2d3, 0.4);
    this.editorPreviewRect.setStrokeStyle(1.5, 0x00d2d3, 1);
    this.editorPreviewRect.setVisible(false);
    this.editorPreviewRect.setDepth(9998);

    this.editorPreviewWood = this.add.sprite(0, 0, "wood", 0);
    this.editorPreviewWood.setScale(2);
    this.editorPreviewWood.setAlpha(0.6);
    this.editorPreviewWood.play("wood_anim");
    this.editorPreviewWood.setVisible(false);
    this.editorPreviewWood.setDepth(9998);

    this.editorPreviewWell = this.add.sprite(0, 0, "well", 0);
    this.editorPreviewWell.setAlpha(0.6);
    this.editorPreviewWell.play("well_anim_0");
    this.editorPreviewWell.setVisible(false);
    this.editorPreviewWell.setDepth(9998);

    this.editorPreviewFountain = this.add.sprite(0, 0, "fountain", 0);
    this.editorPreviewFountain.setAlpha(0.6);
    this.editorPreviewFountain.play("fountain_anim_0");
    this.editorPreviewFountain.setVisible(false);
    this.editorPreviewFountain.setDepth(9998);

    this.editorPreviewHouse = this.add.sprite(0, 0, "house_1");
    this.editorPreviewHouse.setAlpha(0.6);
    this.editorPreviewHouse.setVisible(false);
    this.editorPreviewHouse.setDepth(9998);

    this.editorPreviewTree = this.add.sprite(0, 0, "maple_tree", 16);
    this.editorPreviewTree.setAlpha(0.6);
    this.editorPreviewTree.setVisible(false);
    this.editorPreviewTree.setDepth(9998);

    this.editorPreviewTreeWater2 = this.add.sprite(0, 0, "tree_water_2", 0);
    this.editorPreviewTreeWater2.setAlpha(0.6);
    this.editorPreviewTreeWater2.play("tree_water_2_anim_0");
    this.editorPreviewTreeWater2.setVisible(false);
    this.editorPreviewTreeWater2.setDepth(9998);

    this.editorPreviewPlant = this.add.sprite(0, 0, "root_land");
    this.editorPreviewPlant.setAlpha(0.6);
    this.editorPreviewPlant.setVisible(false);
    this.editorPreviewPlant.setDepth(9998);

    if (this.textures.exists("zemin_tileset")) {
      this.editorPreviewTile = this.add.sprite(0, 0, "zemin_tileset");
      this.editorPreviewTile.setAlpha(0.6);
      this.editorPreviewTile.setVisible(false);
      this.editorPreviewTile.setDepth(9998);
    }

    // Click/Move triggers for editor
    // Helper: returns true if the real DOM element under the pointer is a React UI panel (not the Phaser canvas)
    const isOverHtmlUI = (px: number, py: number): boolean => {
      const el = document.elementFromPoint(px, py);
      if (!el) return false;
      const canvas = this.game.canvas;
      // If the topmost element IS the canvas, the pointer is in the game world
      if (el === canvas) return false;
      // If the element is inside the canvas (e.g. a Phaser DOM element) also fine
      if (canvas.contains(el)) return false;
      // Otherwise it's a React/HTML UI element
      return true;
    };

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active) {
        this.editorPreviewRect.setVisible(false);
        this.editorPreviewWood.setVisible(false);
        this.editorPreviewWell.setVisible(false);
        this.editorPreviewFountain.setVisible(false);
        this.editorPreviewHouse.setVisible(false);
        this.editorPreviewTree.setVisible(false);
        this.editorPreviewTreeWater2.setVisible(false);
        this.editorPreviewPlant.setVisible(false);
        if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        return;
      }

      // Hide preview & skip painting if mouse is over a UI panel
      if (isOverHtmlUI(pointer.x, pointer.y)) {
        this.editorPreviewRect.setVisible(false);
        this.editorPreviewWood.setVisible(false);
        this.editorPreviewWell.setVisible(false);
        this.editorPreviewFountain.setVisible(false);
        this.editorPreviewHouse.setVisible(false);
        this.editorPreviewTree.setVisible(false);
        this.editorPreviewTreeWater2.setVisible(false);
        this.editorPreviewPlant.setVisible(false);
        if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        return;
      }

      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      let targetX = worldPoint.x;
      let targetY = worldPoint.y;

      if (config.gridSnap) {
        const snap = config.snapSize ?? 16;
        targetX = Math.round(targetX / snap) * snap;
        targetY = Math.round(targetY / snap) * snap;
      }

      const isBrush = config.tool === "brush";

      if (isBrush) {
        this.editorPreviewTreeWater2.setVisible(false);
        if (config.selectedAsset === "wood") {
          this.editorPreviewWood.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("tree_water_2_")) {
          const idx = parseInt(config.selectedAsset.split("_")[3], 10);
          this.editorPreviewTreeWater2.play(`tree_water_2_anim_${idx}`, true);
          this.editorPreviewTreeWater2.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("well_")) {
          const idx = parseInt(config.selectedAsset.split("_")[1], 10);
          this.editorPreviewWell.play(`well_anim_${idx}`, true);
          this.editorPreviewWell.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("fountain_")) {
          const idx = parseInt(config.selectedAsset.split("_")[1], 10);
          this.editorPreviewFountain.play(`fountain_anim_${idx}`, true);
          this.editorPreviewFountain.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && (
          config.selectedAsset.startsWith("house_") || 
          config.selectedAsset.startsWith("indoor_") ||
          config.selectedAsset.startsWith("decor2_") ||
          [
            'construction_area',
            'newsstand',
            'sawmill',
            'sharpening_station',
            'telephone',
            'workbench',
            'ice_cream_car',
            'water_box'
          ].includes(config.selectedAsset)
        )) {
          this.editorPreviewHouse.setTexture(config.selectedAsset);
          this.editorPreviewHouse.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset === "maple_tree") {
          this.editorPreviewTree.play("maple_tree_grown", true);
          this.editorPreviewTree.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("root_land_")) {
          const parts = config.selectedAsset.split("_");
          const color = parseInt(parts[2], 10);
          const stage = parseInt(parts[3], 10);
          this.editorPreviewPlant.setTexture("root_land");
          this.editorPreviewPlant.setFrame(color * 3 + stage);
          this.editorPreviewPlant.anims.stop();
          this.editorPreviewPlant.setPosition(targetX, targetY).setVisible(true);

          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("root_water_")) {
          const parts = config.selectedAsset.split("_");
          const color = parseInt(parts[2], 10);
          const stage = parseInt(parts[3], 10);
          this.editorPreviewPlant.setTexture(`root_water_${stage}`);
          this.editorPreviewPlant.play(`root_water_anim_${color}_${stage}`, true);
          this.editorPreviewPlant.setPosition(targetX, targetY).setVisible(true);

          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("dekor_tree_")) {
          const frameIdx = parseInt(config.selectedAsset.replace("dekor_tree_", ""), 10) || 0;
          this.editorPreviewPlant.setTexture("dekor_tree");
          this.editorPreviewPlant.setFrame(frameIdx);
          this.editorPreviewPlant.anims.stop();
          this.editorPreviewPlant.setPosition(targetX, targetY).setVisible(true);

          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("mineral_mine_")) {
          const TYPE_TO_FRAME: { [k: number]: number } = { 1: 22, 2: 23, 3: 24, 4: 26, 5: 27, 6: 28, 7: 29, 8: 30 };
          const typeIdx = parseInt(config.selectedAsset.replace("mineral_mine_", ""), 10) || 1;
          this.editorPreviewPlant.setTexture("mineral_sheet", TYPE_TO_FRAME[typeIdx] ?? 22);
          this.editorPreviewPlant.anims.stop();
          this.editorPreviewPlant.setPosition(targetX, targetY).setVisible(true);

          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("wf_") && this.editorPreviewTile) {
          const parts = config.selectedAsset.split("_");
          const theme = parts[1];
          const tx = parseInt(parts[2], 10);
          const ty = parseInt(parts[3], 10);
          const tw = parseInt(parts[4], 10);
          const th = parseInt(parts[5], 10);
          const textureKey = `waterfall_${theme}`;
          if (this.textures.exists(textureKey)) {
            const frameKey1 = `wf_${theme}_${tx}_${ty}_${tw}_${th}_f1`;
            const texture = this.textures.get(textureKey);
            if (texture && !texture.has(frameKey1)) {
              texture.add(frameKey1, 0, tx * tw, ty * th, tw, th);
            }
            this.editorPreviewTile.setTexture(textureKey, frameKey1);
            this.editorPreviewTile.setScale(1);
            this.editorPreviewTile.setAlpha(0.7);
            this.editorPreviewTile.setPosition(targetX, targetY).setVisible(true);
          }
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          this.editorPreviewPlant.setVisible(false);
        } else if (config.selectedAsset && config.selectedAsset.startsWith("terrain_") && this.editorPreviewTile) {
          const parts = config.selectedAsset.split("_");
          const th = parseInt(parts[parts.length - 1], 10);
          const tw = parseInt(parts[parts.length - 2], 10);
          const row = parseInt(parts[parts.length - 3], 10);
          const col = parseInt(parts[parts.length - 4], 10);
          const textureKey = parts.slice(0, parts.length - 4).join("_");
          if (this.textures.exists(textureKey)) {
            const frameKey = `${config.selectedAsset}_f`;
            const texture = this.textures.get(textureKey);
            if (texture && !texture.has(frameKey)) {
              texture.add(frameKey, 0, col * tw, row * th, tw, th);
            }
            this.editorPreviewTile.setTexture(textureKey, frameKey);
            this.editorPreviewTile.setScale(1);
            this.editorPreviewTile.setAlpha(0.7);
            this.editorPreviewTile.setPosition(targetX, targetY).setVisible(true);
          }
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          this.editorPreviewPlant.setVisible(false);
        } else if (config.selectedAsset === "zemin_tileset" && config.selectedTile && this.textures.exists("zemin_tileset")) {
          const tile = config.selectedTile;
          const frameKey = `tile_${tile.x}_${tile.y}_${tile.w}_${tile.h}`;
          const texture = this.textures.get("zemin_tileset");
          if (texture && !texture.has(frameKey)) {
            texture.add(frameKey, 0, tile.x, tile.y, tile.w, tile.h);
          }
          if (this.editorPreviewTile) {
            this.editorPreviewTile.setTexture("zemin_tileset", frameKey);
            this.editorPreviewTile.setAlpha(0.7);
            const baseScaleX = 32 / tile.w;
            const baseScaleY = 32 / tile.h;
            this.editorPreviewTile.setScale(baseScaleX, baseScaleY);
            this.editorPreviewTile.setPosition(targetX, targetY).setVisible(true);
          }
          this.editorPreviewRect.setVisible(false);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          this.editorPreviewPlant.setVisible(false);
        } else {
          this.editorPreviewRect.setPosition(targetX, targetY).setVisible(true);
          this.editorPreviewWood.setVisible(false);
          this.editorPreviewWell.setVisible(false);
          this.editorPreviewFountain.setVisible(false);
          this.editorPreviewHouse.setVisible(false);
          this.editorPreviewTree.setVisible(false);
          this.editorPreviewPlant.setVisible(false);
          if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
        }
      } else {
        this.editorPreviewRect.setVisible(false);
        this.editorPreviewWood.setVisible(false);
        this.editorPreviewWell.setVisible(false);
        this.editorPreviewFountain.setVisible(false);
        this.editorPreviewHouse.setVisible(false);
        this.editorPreviewTree.setVisible(false);
        this.editorPreviewPlant.setVisible(false);
        if (this.editorPreviewTile) this.editorPreviewTile.setVisible(false);
      }

      // Painting continuously when dragging/holding mouse down
      if (pointer.isDown && isBrush) {
        this.tryPlaceObjectAt(targetX, targetY);
      }

      // Erasing continuously when dragging/holding mouse down
      if (pointer.isDown && config.tool === "eraser") {
        this.room.state.mapObjects.forEach((obj: any) => {
          const objMap = obj.mapId || "world_1";
          if (objMap !== this.currentMapId) return;

          if (Math.round(obj.x) === Math.round(targetX) && Math.round(obj.y) === Math.round(targetY) && obj.depthLayer === config.depthLayer) {
            window.dispatchEvent(new CustomEvent("editor_action_performed", {
              detail: { type: "delete", id: obj.id, data: { ...obj } }
            }));
            this.room.send("delete_object", { id: obj.id });
          }
        });
      }

      // Draw fill_region or fill_erase selection rectangle while dragging
      if ((config.tool === "fill_region" || config.tool === "fill_erase") && pointer.isDown && this.fillRegionStart) {
        const sx = this.fillRegionStart.x;
        const sy = this.fillRegionStart.y;
        const rx = Math.min(sx, targetX);
        const ry = Math.min(sy, targetY);
        const rw = Math.abs(targetX - sx);
        const rh = Math.abs(targetY - sy);
        this.fillRegionGfx.clear();
        const strokeColor = config.tool === "fill_erase" ? 0xff4757 : 0xf9ca24;
        this.fillRegionGfx.fillStyle(strokeColor, 0.15);
        this.fillRegionGfx.fillRect(rx, ry, rw, rh);
        this.fillRegionGfx.lineStyle(2, strokeColor, 0.9);
        this.fillRegionGfx.strokeRect(rx, ry, rw, rh);
      } else if (config.tool !== "fill_region" && config.tool !== "fill_erase") {
        this.fillRegionGfx.clear();
        this.fillRegionStart = null;
      }
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, currentlyOver: any[]) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active) return;

      // Don't place/erase if the click landed on a HTML UI panel
      if (isOverHtmlUI(pointer.x, pointer.y)) return;

      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      let targetX = worldPoint.x;
      let targetY = worldPoint.y;

      if (config.gridSnap) {
        const snap = config.snapSize ?? 16;
        targetX = Math.round(targetX / snap) * snap;
        targetY = Math.round(targetY / snap) * snap;
      }

      if (config.pathDrawingTargetId) {
        window.dispatchEvent(new CustomEvent("editor_path_point_added", {
          detail: { x: Math.round(targetX), y: Math.round(targetY) }
        }));
        return;
      }

      const clickedSprite = currentlyOver[0];

      // fill_region / fill_erase: record start position and prevent other actions
      if (config.tool === "fill_region" || config.tool === "fill_erase") {
        this.fillRegionStart = { x: targetX, y: targetY };
        return;
      }

      if (config.tool === "brush") {
        this.tryPlaceObjectAt(targetX, targetY);
      }
      else if (config.tool === "eraser") {
        let objId = clickedSprite?.objId;
        let oldData = null;
        if (objId) {
          oldData = {
            id: objId,
            assetId: clickedSprite.assetId,
            x: clickedSprite.x,
            y: clickedSprite.y,
            scaleX: clickedSprite.scaleX,
            scaleY: clickedSprite.scaleY,
            rotation: clickedSprite.angle,
            isSolid: clickedSprite.isSolid,
            depthLayer: clickedSprite.depthLayer,
            triggerType: clickedSprite.triggerType,
            triggerTargetX: clickedSprite.triggerTargetX,
            triggerTargetY: clickedSprite.triggerTargetY
          };
        } else {
          let closestObj: any = null;
          let closestDist = 32;
          this.room.state.mapObjects.forEach((obj: any) => {
            const objMap = obj.mapId || "world_1";
            if (objMap !== this.currentMapId) return;

            if (obj.assetId && obj.assetId.startsWith("spawn_")) {
              const dist = Phaser.Math.Distance.Between(targetX, targetY, obj.x, obj.y);
              if (dist < closestDist) {
                closestDist = dist;
                closestObj = obj;
              }
            }
          });
          if (closestObj) {
            objId = closestObj.id;
            oldData = { ...closestObj };
          }
        }

        if (objId) {
          window.dispatchEvent(new CustomEvent("editor_action_performed", {
            detail: { type: "delete", id: objId, data: oldData }
          }));
          this.room.send("delete_object", { id: objId });
          window.dispatchEvent(new CustomEvent("editor_object_selected", { detail: null }));
        }
      }
      else if (config.tool === "solid" && clickedSprite && clickedSprite.objId) {
        const newSolid = !clickedSprite.isSolid;
        window.dispatchEvent(new CustomEvent("editor_action_performed", {
          detail: { type: "update", id: clickedSprite.objId, oldData: { isSolid: clickedSprite.isSolid }, newData: { isSolid: newSolid } }
        }));
        this.room.send("update_object", { id: clickedSprite.objId, isSolid: newSolid });
        this.selectObjectById(clickedSprite.objId);
      }
      else if (config.tool === "select") {
        if (clickedSprite && clickedSprite.objId) {
          this.selectObjectById(clickedSprite.objId);
        } else {
          let closestObj: any = null;
          let closestDist = 32; // Allow up to 32px click distance to spawner center
          this.room.state.mapObjects.forEach((obj: any) => {
            const objMap = obj.mapId || "world_1";
            if (objMap !== this.currentMapId) return;

            if (obj.assetId && obj.assetId.startsWith("spawn_")) {
              const dist = Phaser.Math.Distance.Between(targetX, targetY, obj.x, obj.y);
              if (dist < closestDist) {
                closestDist = dist;
                closestObj = obj;
              }
            }
          });
          if (closestObj) {
            this.selectObjectById(closestObj.id);
          }
        }
      }
      else if (config.tool === "pipette" && clickedSprite && clickedSprite.objId) {
        this.selectObjectById(clickedSprite.objId);
        window.dispatchEvent(new CustomEvent("editor_pipette_cloned", {
          detail: {
            assetId: clickedSprite.assetId,
            isSolid: clickedSprite.isSolid,
            depthLayer: clickedSprite.depthLayer,
            tileX: clickedSprite.tileX !== undefined ? clickedSprite.tileX : -1,
            tileY: clickedSprite.tileY !== undefined ? clickedSprite.tileY : -1,
            tileW: clickedSprite.tileW !== undefined ? clickedSprite.tileW : 0,
            tileH: clickedSprite.tileH !== undefined ? clickedSprite.tileH : 0,
            solidWidth: clickedSprite.solidWidth !== undefined ? clickedSprite.solidWidth : 0,
            solidHeight: clickedSprite.solidHeight !== undefined ? clickedSprite.solidHeight : 0,
            solidOffsetX: clickedSprite.solidOffsetX !== undefined ? clickedSprite.solidOffsetX : 0,
            solidOffsetY: clickedSprite.solidOffsetY !== undefined ? clickedSprite.solidOffsetY : 0
          }
        }));
      }
    });

    let dragStartX = 0;
    let dragStartY = 0;

    this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, gameObject: any) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active || config.tool !== "select") return;
      
      dragStartX = gameObject.x;
      dragStartY = gameObject.y;
    });

    this.input.on("drag", (_pointer: Phaser.Input.Pointer, gameObject: any, dragX: number, dragY: number) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active || config.tool !== "select") return;

      let targetX = dragX;
      let targetY = dragY;

      if (config.gridSnap) {
        const snap = config.snapSize ?? 16;
        targetX = Math.round(targetX / snap) * snap;
        targetY = Math.round(targetY / snap) * snap;
      }

      gameObject.setPosition(targetX, targetY);
    });

    this.input.on("dragend", (_pointer: Phaser.Input.Pointer, gameObject: any) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active || config.tool !== "select" || !gameObject.objId) return;

      const newX = gameObject.x;
      const newY = gameObject.y;
      
      if (newX !== dragStartX || newY !== dragStartY) {
        window.dispatchEvent(new CustomEvent("editor_action_performed", {
          detail: {
            type: "update",
            id: gameObject.objId,
            oldData: { x: dragStartX, y: dragStartY },
            newData: { x: newX, y: newY }
          }
        }));
        this.room.send("update_object", { id: gameObject.objId, x: newX, y: newY });
        this.selectObjectById(gameObject.objId);
      }
    });

    window.addEventListener("minimap_navigate", (e: any) => {
      if (e.detail && e.detail.x !== undefined && e.detail.y !== undefined) {
        this.cameras.main.pan(e.detail.x, e.detail.y, 400, "Power2");
      }
    });

    // fill_region / fill_erase: on pointerup, fill or erase the dragged rectangle or flood-erase connected tiles
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const config = (window as any).editorConfig;
      if (!config || !config.active) return;

      // ── TOPLU SİL (fill_erase): Drag area erase or click flood erase ───────
      if (config.tool === "fill_erase" && this.fillRegionStart) {
        const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const snap = config.snapSize ?? 16;

        const endX = Math.round(worldPoint.x / snap) * snap;
        const endY = Math.round(worldPoint.y / snap) * snap;
        const startX = Math.round(this.fillRegionStart.x / snap) * snap;
        const startY = Math.round(this.fillRegionStart.y / snap) * snap;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        this.fillRegionStart = null;
        this.fillRegionGfx.clear();

        const dist = Math.hypot(maxX - minX, maxY - minY);

        if (dist > 8) {
          // Drag Region Erase Mode: Delete all objects inside dragged box
          const toDelete: { id: string; data: any }[] = [];
          this.room.state.mapObjects.forEach((obj: any, key: string) => {
            const objMap = obj.mapId || "world_1";
            if (objMap !== this.currentMapId) return;

            if (obj.x >= minX - 4 && obj.x <= maxX + 4 && obj.y >= minY - 4 && obj.y <= maxY + 4) {
              toDelete.push({ id: obj.id || key, data: { ...obj } });
            }
          });

          const deleteIds: string[] = [];
          toDelete.forEach((item) => deleteIds.push(item.id));
          if (toDelete.length > 0) {
            window.dispatchEvent(new CustomEvent("editor_action_performed", {
              detail: { type: "batch_delete", items: toDelete }
            }));
          }
          if (deleteIds.length > 0 && this.room) {
            const CHUNK_SIZE = 150;
            let idx = 0;
            const sendNextDelete = () => {
              if (!this.room || idx >= deleteIds.length) return;
              const chunk = deleteIds.slice(idx, idx + CHUNK_SIZE);
              this.room.send("batch_delete_objects", { ids: chunk });
              idx += CHUNK_SIZE;
              if (idx < deleteIds.length) {
                setTimeout(sendNextDelete, 15);
              }
            };
            sendNextDelete();
          }
        } else {
          // Single Click Flood-Erase Mode: Delete clicked object + all connected objects with SAME assetId (BFS)
          let targetObj: any = null;
          this.room.state.mapObjects.forEach((obj: any) => {
            const objMap = obj.mapId || "world_1";
            if (objMap !== this.currentMapId) return;

            if (Math.round(obj.x) === minX && Math.round(obj.y) === minY) {
              targetObj = obj;
            }
          });

          if (!targetObj) {
            let closestDist = 32;
            this.room.state.mapObjects.forEach((obj: any) => {
              const objMap = obj.mapId || "world_1";
              if (objMap !== this.currentMapId) return;
              const d = Phaser.Math.Distance.Between(minX, minY, obj.x, obj.y);
              if (d < closestDist) {
                closestDist = d;
                targetObj = obj;
              }
            });
          }

          if (targetObj) {
            const targetAssetId = targetObj.assetId;
            const targetMap = targetObj.mapId || "world_1";

            const queue: { x: number; y: number }[] = [{ x: targetObj.x, y: targetObj.y }];
            const visited = new Set<string>();
            const toDeleteItems: { id: string; data: any }[] = [];

            const mapGrid = new Map<string, any[]>();
            this.room.state.mapObjects.forEach((obj: any) => {
              const oMap = obj.mapId || "world_1";
              if (oMap !== targetMap || obj.assetId !== targetAssetId) return;
              const k = `${Math.round(obj.x)},${Math.round(obj.y)}`;
              if (!mapGrid.has(k)) mapGrid.set(k, []);
              mapGrid.get(k)!.push(obj);
            });

            const step = snap || 16;
            while (queue.length > 0) {
              const curr = queue.shift()!;
              const k = `${Math.round(curr.x)},${Math.round(curr.y)}`;
              if (visited.has(k)) continue;
              visited.add(k);

              const matching = mapGrid.get(k);
              if (matching) {
                matching.forEach((o) => toDeleteItems.push({ id: o.id, data: { ...o } }));
                const neighbors = [
                  { x: curr.x + step, y: curr.y },
                  { x: curr.x - step, y: curr.y },
                  { x: curr.x, y: curr.y + step },
                  { x: curr.x, y: curr.y - step },
                ];
                neighbors.forEach((n) => {
                  const nk = `${Math.round(n.x)},${Math.round(n.y)}`;
                  if (mapGrid.has(nk) && !visited.has(nk)) {
                    queue.push(n);
                  }
                });
              }
            }

            const floodDeleteIds: string[] = [];
            toDeleteItems.forEach((item) => floodDeleteIds.push(item.id));
            if (toDeleteItems.length > 0) {
              window.dispatchEvent(new CustomEvent("editor_action_performed", {
                detail: { type: "batch_delete", items: toDeleteItems }
              }));
            }
            if (floodDeleteIds.length > 0 && this.room) {
              const CHUNK_SIZE = 150;
              let idx = 0;
              const sendNextFloodDelete = () => {
                if (!this.room || idx >= floodDeleteIds.length) return;
                const chunk = floodDeleteIds.slice(idx, idx + CHUNK_SIZE);
                this.room.send("batch_delete_objects", { ids: chunk });
                idx += CHUNK_SIZE;
                if (idx < floodDeleteIds.length) {
                  setTimeout(sendNextFloodDelete, 15);
                }
              };
              sendNextFloodDelete();
            }
          }
        }
        return;
      }

      if (config.tool !== "fill_region") return;
      if (!this.fillRegionStart) {
        this.fillRegionGfx.clear();
        return;
      }
      // Must have a selected asset to fill with
      if (!config.selectedAsset) {
        this.fillRegionStart = null;
        this.fillRegionGfx.clear();
        return;
      }

      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const snap = config.snapSize ?? 16;

      const endX = Math.round(worldPoint.x / snap) * snap;
      const endY = Math.round(worldPoint.y / snap) * snap;
      const startX = Math.round(this.fillRegionStart.x / snap) * snap;
      const startY = Math.round(this.fillRegionStart.y / snap) * snap;

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const finalDepthLayer = (config.selectedAsset === "tilled_soil_dry" || config.selectedAsset === "tilled_soil_wet")
        ? "below" : (config.depthLayer || "below");

      const batchObjects: any[] = [];

      // ── Multi-tile terrain brush fill ─────────────────────────────────────
      if (config.terrainBrush) {
        const tb = config.terrainBrush;
        const { startCol, startRow, endCol, endRow, tileW, tileH, tilesetKey, animated } = tb;
        const scaleX = tb.tileScaleX ?? 1;
        const scaleY = tb.tileScaleY ?? 1;
        const stepX = tileW * scaleX;
        const stepY = tileH * scaleY;
        const patternW = (endCol - startCol + 1) * stepX;
        const patternH = (endRow - startRow + 1) * stepY;

        for (let cy = minY; cy <= maxY; cy += stepY) {
          for (let cx = minX; cx <= maxX; cx += stepX) {
            // Tile pattern repeats (mod) across fill region
            const patRow = startRow + Math.floor(((cy - minY) % patternH) / stepY);
            const patCol = startCol + Math.floor(((cx - minX) % patternW) / stepX);

            const isAnim = animated && patRow < 2 ? 1 : 0;
            let assetId: string;
            if (tilesetKey && tilesetKey.startsWith("wf_")) {
              const theme = tilesetKey.replace("wf_", "");
              assetId = `wf_${theme}_${patCol}_${patRow}_${tileW}_${tileH}_${isAnim}`;
            } else {
              assetId = `terrain_${tilesetKey}_${patCol}_${patRow}_${tileW}_${tileH}`;
            }

            const objId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random()*1000000)}`;
            const objData = {
              id: objId, assetId, x: cx, y: cy,
              mapId: this.currentMapId,
              scaleX, scaleY, rotation: 0, flipX: false, flipY: false,
              isSolid: Boolean(config.brushIsSolid),
              isWater: Boolean(config.brushIsWater),
              isClimbable: Boolean(config.brushIsClimbable),
              depthLayer: finalDepthLayer,
              triggerType: "none", triggerTargetX: 0, triggerTargetY: 0,
              tileX: patCol * tileW, tileY: patRow * tileH, tileW, tileH,
              frameRate: 6, solidWidth: 0, solidHeight: 0, solidOffsetX: 0, solidOffsetY: 0,
            };
            batchObjects.push(objData);
          }
        }
      } else {
        // ── Single-tile fill ──────────────────────────────────────────────────
        const isTerrain = config.selectedAsset.startsWith("terrain_") || config.selectedAsset.startsWith("wf_");
        const scaleX = isTerrain ? (config.tileScaleX ?? 1) : 1;
        const scaleY = isTerrain ? (config.tileScaleY ?? 1) : 1;
        const stepX = snap;
        const stepY = snap;

        for (let cy = minY; cy <= maxY; cy += stepY) {
          for (let cx = minX; cx <= maxX; cx += stepX) {
            const objId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random()*1000000)}`;
            const objData = {
              id: objId, assetId: config.selectedAsset, x: cx, y: cy,
              mapId: this.currentMapId,
              scaleX, scaleY, rotation: 0, flipX: false, flipY: false,
              isSolid: Boolean(config.brushIsSolid),
              isWater: Boolean(config.brushIsWater),
              isClimbable: Boolean(config.brushIsClimbable),
              depthLayer: finalDepthLayer,
              triggerType: "none", triggerTargetX: 0, triggerTargetY: 0,
              tileX: config.selectedTile ? config.selectedTile.x : -1,
              tileY: config.selectedTile ? config.selectedTile.y : -1,
              tileW: config.selectedTile ? config.selectedTile.w : 0,
              tileH: config.selectedTile ? config.selectedTile.h : 0,
              frameRate: 6, solidWidth: 0, solidHeight: 0, solidOffsetX: 0, solidOffsetY: 0,
            };
            batchObjects.push(objData);
          }
        }
      }

      if (batchObjects.length > 0) {
        window.dispatchEvent(new CustomEvent("editor_action_performed", { detail: { type: "batch_place", items: batchObjects } }));
      }

      if (batchObjects.length > 0 && this.room) {
        const CHUNK_SIZE = 100;
        const total = batchObjects.length;
        let index = 0;
        const sendNextChunk = () => {
          if (!this.room || index >= total) return;
          const chunk = batchObjects.slice(index, index + CHUNK_SIZE);
          this.room.send("batch_place_objects", { objects: chunk });
          index += CHUNK_SIZE;
          if (index < total) {
            setTimeout(sendNextChunk, 15);
          }
        };
        sendNextChunk();
      }

      this.fillRegionStart = null;
      this.fillRegionGfx.clear();
    });

    this.sceneReady = true;
    this.bindRoomEvents();

    // Flush any pending spawns
    for (const { data, sessionId } of this.pendingSpawns) {
      this.spawnPlayer(data, sessionId);
    }
    this.pendingSpawns = [];

    console.log("[GameScene] Scene created and ready.");
  }

  // -------------------------------------------------------------------------
  // update() — called every frame by Phaser
  // -------------------------------------------------------------------------
  update(time: number, delta: number): void {
    (window as any).gameCamera = {
      x: this.cameras.main.scrollX,
      y: this.cameras.main.scrollY,
      width: this.cameras.main.displayWidth,
      height: this.cameras.main.displayHeight,
      centerX: this.cameras.main.scrollX + this.cameras.main.displayWidth / 2,
      centerY: this.cameras.main.scrollY + this.cameras.main.displayHeight / 2
    };

    // Redraw editor outlines and selection boundaries
    this.editorOutline.clear();
    const editorConfig = (window as any).editorConfig;
    if (editorConfig && editorConfig.active && this.room && this.room.state) {
      this.room.state.mapObjects.forEach((obj: any) => {
        const objMap = obj.mapId || "world_1";
        if (objMap !== this.currentMapId) return;

        const objW = 32 * (obj.scaleX || 1);
        const objH = 32 * (obj.scaleY || 1);

        // Draw solid wall indicator (red)
        if (obj.isSolid) {
          const w = (obj.solidWidth > 0) ? obj.solidWidth : objW;
          const h = (obj.solidHeight > 0) ? obj.solidHeight : objH;
          const ox = obj.solidOffsetX || 0;
          const oy = obj.solidOffsetY || 0;

          this.editorOutline.lineStyle(1.5, 0xff4757, 0.8);
          this.editorOutline.strokeRect(obj.x + ox - w / 2, obj.y + oy - h / 2, w, h);
        } else if (obj.triggerType === "teleport") {
          // Draw teleport boundary indicator (blue)
          this.editorOutline.lineStyle(1.5, 0x1e90ff, 0.7);
          this.editorOutline.strokeRect(obj.x - objW / 2, obj.y - objH / 2, objW, objH);
        }

        // Draw selection box (cyan)
        if (editorConfig.selectedObjectId === obj.id) {
          this.editorOutline.lineStyle(2, 0x00d2d3, 1);
          this.editorOutline.strokeRect(obj.x - objW / 2 - 2, obj.y - objH / 2 - 2, objW + 4, objH + 4);
          
          this.editorOutline.fillStyle(0x00d2d3, 0.8);
          this.editorOutline.fillCircle(obj.x, obj.y, 4);

          // Draw teleport warp pointer line
          if (obj.triggerType === "teleport") {
            this.editorOutline.lineStyle(1.5, 0x00d2d3, 0.8);
            this.editorOutline.beginPath();
            this.editorOutline.moveTo(obj.x, obj.y);
            this.editorOutline.lineTo(obj.triggerTargetX, obj.triggerTargetY);
            this.editorOutline.strokePath();

            this.editorOutline.fillStyle(0x00d2d3, 0.8);
            this.editorOutline.fillCircle(obj.triggerTargetX, obj.triggerTargetY, 5);
          }
        }

        // Draw patrol path if this object is selected and has a path OR is currently drawing one
        if (editorConfig.selectedObjectId === obj.id || editorConfig.pathDrawingTargetId === obj.id) {
          let points: { x: number; y: number }[] = [];
          let isEditing = false;
          
          if (editorConfig.pathDrawingTargetId === obj.id && editorConfig.tempPathPoints) {
            points = editorConfig.tempPathPoints;
            isEditing = true;
          } else if (obj.patrolPath) {
            try {
              points = JSON.parse(obj.patrolPath);
            } catch (e) {}
          }

          if (points.length > 0) {
            const lineColor = isEditing ? 0xff9f43 : 0x1dd1a1; // orange for editing, emerald green for saved
            this.editorOutline.lineStyle(1.5, lineColor, 0.8);
            this.editorOutline.beginPath();
            this.editorOutline.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              this.editorOutline.lineTo(points[i].x, points[i].y);
            }
            this.editorOutline.lineTo(points[0].x, points[0].y);
            this.editorOutline.strokePath();

            // Draw nodes
            points.forEach((pt) => {
              this.editorOutline.fillStyle(lineColor, 0.9);
              this.editorOutline.fillCircle(pt.x, pt.y, 5);
              this.editorOutline.lineStyle(1, 0xffffff, 1);
              this.editorOutline.strokeCircle(pt.x, pt.y, 5);
            });
          }
        }
      });
    }

    // Fade out roofs when the local player is underneath them
    if (this.localSprite && this.localSprite.container) {
      const playerX = this.localSprite.container.x;
      const playerY = this.localSprite.container.y;
      const isEditorActive = Boolean(editorConfig && editorConfig.active);

      this.placedObjectSprites.forEach((sprite: any) => {
        if (sprite) {
          if (sprite.assetId === "collision_block") {
            sprite.setVisible(isEditorActive);
          }
          if (sprite.depthLayer === "above") {
            const bounds = sprite.getBounds();
            const isUnder = bounds.contains(playerX, playerY);
            if (isUnder) {
              sprite.setAlpha(0.2);
            } else {
              sprite.setAlpha(1.0);
            }
          }
        }
      });
    }

    // 1. Read input and send to server
    this.handleInput();

    // 2. Animate and Interpolate all player containers
    const lerpFactor = 1 - Math.pow(0.04, delta / 1000); // smooth lerp

    // Update pet companions first
    this.petSprites.forEach((petData, sessionId) => {
      petData.sprite.x = Phaser.Math.Linear(petData.sprite.x, petData.targetX, lerpFactor);
      petData.sprite.y = Phaser.Math.Linear(petData.sprite.y, petData.targetY, lerpFactor);
      petData.sprite.setDepth(2 + petData.sprite.y / 10000);

      // Play correct directional animation
      const player = this.room?.state?.players?.get(sessionId);
      if (player && player.petType) {
        const act = player.petAction || "idle";
        const dir = player.petDirection || "down";

        // Flip left animation for right direction since cats only have left texture rows
        // Flip left animation for right direction since cats and dogs only have left texture rows
        if (player.petType.startsWith("pet_cat_") || player.petType.startsWith("pet_dog_")) {
          if (dir === "right") {
            petData.sprite.setFlipX(true);
          } else if (dir === "left") {
            petData.sprite.setFlipX(false);
          }
        } else {
          petData.sprite.setFlipX(false);
        }

        const animKey = `${player.petType}_${act}_${dir}`;
        if (this.anims.exists(animKey)) {
          if (petData.sprite.anims.currentAnim?.key !== animKey) {
            petData.sprite.play(animKey);
          }
        }
      }
    });

    this.playerSprites.forEach((sprite, sessionId) => {
      // For local player, position is applied directly from room state in updatePlayerPosition()
      // For remote players, we smoothly lerp towards targetX/targetY
      if (sessionId !== this.localSessionId) {
        sprite.container.x = Phaser.Math.Linear(sprite.container.x, sprite.targetX, lerpFactor);
        sprite.container.y = Phaser.Math.Linear(sprite.container.y, sprite.targetY, lerpFactor);
      }

      // Update player depth dynamically by Y so they sort correctly against same-layer tiles.
      // Use 2.5 base so player is always above below-layer tiles (max ~1.101) with safe margin.
      sprite.container.setDepth(2.5 + sprite.container.y / 10000);

      // Get latest custom configurations from server state for this player
      const playerData = this.room?.state?.players?.get(sessionId);

      // Calculate velocity/movement from last frame
      const dx = sprite.container.x - sprite.lastX;
      const dy = sprite.container.y - sprite.lastY;

      // Determine movement state
      let isMoving = false;
      let movingLeft = false;
      let movingRight = false;
      let movingUp = false;
      let movingDown = false;
      let isRunning = false;

      if (sessionId === this.localSessionId) {
        // Local player: check keyboard input keys
        movingLeft  = this.cursors.left.isDown  || this.wasd.A.isDown;
        movingRight = this.cursors.right.isDown || this.wasd.D.isDown;
        movingUp    = this.cursors.up.isDown    || this.wasd.W.isDown;
        movingDown  = this.cursors.down.isDown  || this.wasd.S.isDown;
        isMoving = movingLeft || movingRight || movingUp || movingDown;
        isRunning = isMoving && this.cursors.shift.isDown;
      } else {
        // Remote player: check position change vectors & server-synced state
        isMoving = Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15;
        if (isMoving) {
          if (Math.abs(dx) > Math.abs(dy)) {
            movingLeft = dx < 0;
            movingRight = dx > 0;
          } else {
            movingUp = dy < 0;
            movingDown = dy > 0;
          }
        }
        isRunning = isMoving && Boolean(playerData?.isRunning);
      }

      // Update facingDir if moving
      if (isMoving) {
        if (movingLeft)       sprite.facingDir = "left";
        else if (movingRight) sprite.facingDir = "right";
        else if (movingUp)    sprite.facingDir = "up";
        else if (movingDown)  sprite.facingDir = "down";
      }

      // Get latest custom configurations from server state for this player
      if (playerData) {
        const gender = playerData.gender || "male";
        const skinTone = playerData.skinTone || 1;
        const eyeColor = playerData.eyeColor || "Black";
        const clothesColor = playerData.clothesColor || "Blue";
        const hairStyle = playerData.hairStyle || "Standart";
        const hairColor = playerData.hairColor || "Black";
        const mappedHair = hairStyle === "Standart" ? "Standard" : hairStyle;
        const hat = playerData.hat || "";
        const action = playerData.action || "none";

        if (!sprite.actionElapsed || sprite.lastActionUsed !== action) {
          sprite.actionElapsed = 0;
          sprite.lastActionUsed = action;
        }
        sprite.actionElapsed += delta;

        if (action !== "none" && action !== "swim" && action !== "swim_submerged") {
          const isHorseEat = action === "horse_eat";
          if (isHorseEat) {
            // Run our custom 3-phase horse eating sequence!
            const charSprites = [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite];
            charSprites.forEach(s => {
              s.setScale(2);
              s.setFlipX(false);
              s.setY(-12);
            });

            // Hide normal player shadow
            if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
            if (sprite.cargoText) sprite.cargoText.setVisible(false);

            // Determine phase
            let currentHorseAction = "horse_lower";
            let frameIndex = 0;
            const elapsed = sprite.actionElapsed || 0;
            if (elapsed < 600) {
              currentHorseAction = "horse_lower";
              frameIndex = Math.min(3, Math.floor(elapsed / 150));
            } else if (elapsed < 1400) {
              currentHorseAction = "horse_eating";
              frameIndex = Math.floor((elapsed - 600) / 200) % 4;
            } else {
              currentHorseAction = "horse_lower";
              frameIndex = Math.max(0, 3 - Math.floor((elapsed - 1400) / 150));
            }

            let directionOffset = 0;
            if (sprite.facingDir === "left")       directionOffset = 12;
            else if (sprite.facingDir === "right") directionOffset = 8;
            else if (sprite.facingDir === "up")    directionOffset = 4;
            else                                   directionOffset = 0;

            const horseFrameIndex = directionOffset + frameIndex;

            // Resolve textures
            const horseVariant = parseInt(playerData.equippedTool.replace("horse_", ""), 10) || 1;

            const saddleColors = ["Black", "Blue", "Brown", "Green", "Pink"];
            let saddleColor = "Brown";
            if (clothesColor && saddleColors.includes(clothesColor)) {
              saddleColor = clothesColor;
            }

            // Set character textures
            const toolBodyKey    = `${currentHorseAction}_body_${skinTone}`;
            const toolEyesKey    = `${currentHorseAction}_eyes_${gender}_${eyeColor}`;
            const toolClothesKey = `${currentHorseAction}_clothes_${clothesColor}`;
            const toolHairKey    = getToolHairKey(hairStyle, hairColor, currentHorseAction);
            const toolHatKey     = getToolHatKey(hat, currentHorseAction);

            sprite.bodySprite.setTexture(toolBodyKey).setFrame(horseFrameIndex);
            sprite.eyesSprite.setTexture(toolEyesKey).setFrame(horseFrameIndex);
            sprite.clothesSprite.setTexture(toolClothesKey).setFrame(horseFrameIndex);
            sprite.hairSprite.setTexture(toolHairKey).setFrame(horseFrameIndex);

            if (hat) {
              sprite.hatSprite.setTexture(toolHatKey).setVisible(true).setFrame(horseFrameIndex);
            } else {
              sprite.hatSprite.setVisible(false);
            }

            // Set horse textures
            if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
              sprite.horseSprite.setTexture(`horse_body_${currentHorseAction}_${horseVariant}`).setVisible(true).setFrame(horseFrameIndex);
              sprite.saddleSprite.setTexture(`horse_saddle_${currentHorseAction}_${saddleColor}`).setVisible(true).setFrame(horseFrameIndex);
              sprite.horseShadowSprite.setTexture(`horse_shadow_${currentHorseAction}`).setVisible(true).setFrame(horseFrameIndex);
            }

            // Hide standard weapon/arrow sprites
            sprite.toolSprite.setVisible(false);
            sprite.arrowSprite.setVisible(false);

          } else {
            // --- 1. SWINGING TOOL / DAMAGE / DEATH / FISHING / CARRYING ACTION (32x32 spritesheet) ---
            const isShovel = action.startsWith("shovel_");
          const isWatering = action.startsWith("watering_");
          const isSword = action.startsWith("sword_");
          const isArcher = action.startsWith("archer_");
          const isDamage = action === "damage";
          const isDeath = action === "death";
          const isClimbing = action === "climb";

          const isBear = (playerData.equippedTool || "").startsWith("bear");
          const isBearDamage = isBear && action === "damage";
          const isBearDeath = isBear && action === "death";
          const isBearAttack = isBear && !isBearDamage && !isBearDeath && action !== "none";

          const isFishCast = action === "fish_cast";
          const isFishWait = action === "fish_wait";
          const isFishBite = action === "fish_bite";
          const isFishReel = action === "fish_reel";
          const isFishCatch = action === "fish_catch";

          const isCarryPick = action === "carry_pick";
          const isCarryThrow = action === "carry_throw";

          const swingFrames = isClimbing ? 5
            : isBearDamage ? 3
            : isBearDeath ? 4
            : isBearAttack ? 4
            : isWatering ? 8 
            : isShovel ? 5 
            : isSword ? 10 
            : isArcher ? 7 
            : isFishCast ? 15
            : isFishBite ? 8
            : isCarryThrow ? 5
            : (isDamage || isDeath || isFishWait || isFishReel || isFishCatch || isCarryPick) ? 4 
            : 6;

          // Reset frame if out of bounds for swing
          if (sprite.walkFrame >= swingFrames) {
            sprite.walkFrame = 0;
            sprite.animTimer = 0;
          }

          const isStopFrame = isDeath || isBearDeath || isFishCatch || isCarryPick || isCarryThrow;
          if (isStopFrame) {
            const maxFrame = isCarryThrow ? 4 : 3;
            if (sprite.walkFrame >= maxFrame) {
              sprite.walkFrame = maxFrame;
            } else {
              sprite.animTimer += delta;
              if (sprite.animTimer >= 100) {
                sprite.walkFrame = sprite.walkFrame + 1;
                sprite.animTimer = 0;
              }
            }
          } else {
            if (!isClimbing || isMoving) {
              sprite.animTimer += delta;
              const frameTime = isWatering ? 160 : 100;
              if (sprite.animTimer >= frameTime) {
                sprite.walkFrame = (sprite.walkFrame + 1) % swingFrames;
                sprite.animTimer = 0;
              }
            }
          }

          // Determine swing direction offset
          let offset = 0;
          if (isBearDamage) {
            if (sprite.facingDir === "left")       offset = 9;
            else if (sprite.facingDir === "right") offset = 6;
            else if (sprite.facingDir === "up")    offset = 3;
            else                                   offset = 0;
          } else if (isBearDeath || isBearAttack) {
            if (sprite.facingDir === "left")       offset = 12;
            else if (sprite.facingDir === "right") offset = 8;
            else if (sprite.facingDir === "up")    offset = 4;
            else                                   offset = 0;
          } else if (isWatering) {
            if (sprite.facingDir === "left")       offset = 24;
            else if (sprite.facingDir === "right") offset = 16;
            else if (sprite.facingDir === "up")    offset = 8;
            else                                   offset = 0;
          } else if (isShovel) {
            if (sprite.facingDir === "left")       offset = 15;
            else if (sprite.facingDir === "right") offset = 10;
            else if (sprite.facingDir === "up")    offset = 5;
            else                                   offset = 0;
          } else if (isSword) {
            if (sprite.facingDir === "left")       offset = 30;
            else if (sprite.facingDir === "right") offset = 20;
            else if (sprite.facingDir === "up")    offset = 10;
            else                                   offset = 0;
          } else if (isArcher) {
            if (sprite.facingDir === "left")       offset = 21;
            else if (sprite.facingDir === "right") offset = 14;
            else if (sprite.facingDir === "up")    offset = 7;
            else                                   offset = 0;
          } else if (isFishCast) {
            if (sprite.facingDir === "left")       offset = 45;
            else if (sprite.facingDir === "right") offset = 30;
            else if (sprite.facingDir === "up")    offset = 15;
            else                                   offset = 0;
          } else if (isFishBite) {
            if (sprite.facingDir === "left")       offset = 24;
            else if (sprite.facingDir === "right") offset = 16;
            else if (sprite.facingDir === "up")    offset = 8;
            else                                   offset = 0;
          } else if (isCarryThrow) {
            if (sprite.facingDir === "left")       offset = 15;
            else if (sprite.facingDir === "right") offset = 10;
            else if (sprite.facingDir === "up")    offset = 5;
            else                                   offset = 0;
          } else if (isDamage || isDeath || isFishWait || isFishReel || isFishCatch || isCarryPick) {
            if (sprite.facingDir === "left")       offset = 12;
            else if (sprite.facingDir === "right") offset = 8;
            else if (sprite.facingDir === "up")    offset = 4;
            else                                   offset = 0;
          } else if (isClimbing) {
            offset = 0;
          } else {
            if (sprite.facingDir === "left")       offset = 18;
            else if (sprite.facingDir === "right") offset = 12;
            else if (sprite.facingDir === "up")    offset = 6;
            else                                   offset = 0;
          }

          // Apply tool action textures and scale (2x)
          const isAxeOrSickle = action.startsWith("axe_") || action.startsWith("sickle_");
          const isFishingAction = action.startsWith("fish_");
          const isCarryingAction = action.startsWith("carry_");
          
          const toolBodyKey    = isClimbing ? `climb_body_${skinTone}` : isBearDamage ? `bear_hit_body_${skinTone}` : isBearDeath ? `bear_dead_body_${skinTone}` : isBearAttack ? `bear_attack_body_${skinTone}` : isWatering ? `watering_body_${skinTone}` : isShovel ? `shovel_body_${skinTone}` : isSword ? `sword_body_${skinTone}` : isArcher ? `archer_body_${skinTone}` : isDamage ? `damage_body_${skinTone}` : isDeath ? `death_body_${skinTone}` : isFishingAction ? `${action}_body_${skinTone}` : isCarryingAction ? `${action}_body_${skinTone}` : isAxeOrSickle ? `axe_body_${skinTone}` : `tool_body_${skinTone}`;
          const toolEyesKey    = isClimbing ? `climb_eyes_${gender}_${eyeColor}` : isBearDamage ? `bear_hit_eyes_${gender}_${eyeColor}` : isBearDeath ? `bear_dead_eyes_${gender}_${eyeColor}` : isBearAttack ? `bear_attack_eyes_${gender}_${eyeColor}` : isWatering ? `watering_eyes_${gender}_${eyeColor}` : isShovel ? `shovel_eyes_${gender}_${eyeColor}` : isSword ? `sword_eyes_${gender}_${eyeColor}` : isArcher ? `archer_eyes_${gender}_${eyeColor}` : isDamage ? `damage_eyes_${gender}_${eyeColor}` : isDeath ? `death_eyes_${gender}_${eyeColor}` : isFishingAction ? `${action}_eyes_${gender}_${eyeColor}` : isCarryingAction ? `${action}_eyes_${gender}_${eyeColor}` : isAxeOrSickle ? `axe_eyes_${gender}_${eyeColor}` : `tool_eyes_${gender}_${eyeColor}`;
          const toolClothesKey = isClimbing ? `climb_clothes_${clothesColor}` : isBearDamage ? `bear_hit_clothes_${clothesColor}` : isBearDeath ? `bear_dead_clothes_${clothesColor}` : isBearAttack ? `bear_attack_clothes_${clothesColor}` : isWatering ? `watering_clothes_${clothesColor}` : isShovel ? `shovel_clothes_${clothesColor}` : isSword ? `sword_clothes_${clothesColor}` : isArcher ? `archer_clothes_${clothesColor}` : isDamage ? `damage_clothes_${clothesColor}` : isDeath ? `death_clothes_${clothesColor}` : isFishingAction ? `${action}_clothes_${clothesColor}` : isCarryingAction ? `${action}_clothes_${clothesColor}` : isAxeOrSickle ? `axe_clothes_${clothesColor}` : `tool_clothes_${clothesColor}`;
          const toolHairKey    = isClimbing ? `climb_hair_${mappedHair}_${hairColor}` : isBearDamage ? `bear_hit_hair_${mappedHair}_${hairColor}` : isBearDeath ? `bear_dead_hair_${mappedHair}_${hairColor}` : isBearAttack ? `bear_attack_hair_${mappedHair}_${hairColor}` : getToolHairKey(hairStyle, hairColor, action);
          const toolWeaponKey  = getToolWeaponKey(action, playerData.equippedTool || "none");

          [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.toolSprite, sprite.arrowSprite, sprite.hatSprite].forEach(s => {
            s.setScale(2);
            s.setFlipX(false);
          });

          sprite.bodySprite.setTexture(toolBodyKey);
          sprite.eyesSprite.setTexture(toolEyesKey);
          sprite.clothesSprite.setTexture(toolClothesKey);
          sprite.hairSprite.setTexture(toolHairKey);

          if (toolWeaponKey) {
            sprite.toolSprite.setTexture(toolWeaponKey).setVisible(true);
          } else {
            sprite.toolSprite.setVisible(false);
          }

          if (action === "fish_reel") {
            sprite.arrowSprite.setTexture("weapon_sweat_fx").setVisible(true);
          } else if (action === "fish_catch") {
            sprite.arrowSprite.setTexture("weapon_fish_fx").setVisible(true);
          } else if (isArcher) {
            sprite.arrowSprite.setTexture("weapon_arrow_fx").setVisible(true);
          } else {
            sprite.arrowSprite.setVisible(false);
          }

          if (sprite.cargoText) sprite.cargoText.setVisible(false);

          const toolHatKey = isClimbing
            ? (hat === "Santa Hat" ? `climb_hat_Santa Hat` : hat === "Pirate eyepatch" ? `climb_hat_pirate eye patch` : `climb_hat_${hat}`)
            : isBearDamage
            ? (hat === "Santa Hat" ? `bear_hit_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_hit_hat_pirate eye patch` : `bear_hit_hat_${hat}`)
            : isBearDeath
            ? (hat === "Santa Hat" ? `bear_dead_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_dead_hat_pirate eye patch` : `bear_dead_hat_${hat}`)
            : isBearAttack
            ? (hat === "Santa Hat" ? `bear_attack_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_attack_hat_pirate eye patch` : `bear_attack_hat_${hat}`)
            : getToolHatKey(hat, action);

          if (hat) {
            sprite.hatSprite.setTexture(toolHatKey).setVisible(true);
          } else {
            sprite.hatSprite.setVisible(false);
          }

          const frameIndex = offset + (sprite.walkFrame % swingFrames);

          // Update bear sprites in action block
          if (isBear && sprite.bearSprite) {
            if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
              sprite.horseSprite.setVisible(false);
              sprite.saddleSprite.setVisible(false);
              sprite.horseShadowSprite.setVisible(false);
            }
            if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
            if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);

            const bearActionKey = isBearDamage ? "bear_hit" : isBearDeath ? "bear_dead" : "bear_attack";
            sprite.bearSprite.setTexture(`bear_body_${bearActionKey}_Brown`).setVisible(true).setFrame(frameIndex);
          } else {
            if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
          }

          if (isClimbing) {
            if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
              sprite.horseSprite.setVisible(false);
              sprite.saddleSprite.setVisible(false);
              sprite.horseShadowSprite.setVisible(false);
            }
            if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
            if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
            sprite.eyesSprite.setVisible(false); // Hide eyes since climbing faces away
          }

          // Apply Y offset to character sprites based on riding state
          const charSprites = [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite];
          charSprites.forEach(s => {
            s.setY(isBear ? -12 : 0);
          });
          sprite.bodySprite.setFrame(frameIndex);
          if (!isClimbing) sprite.eyesSprite.setFrame(frameIndex);
          sprite.clothesSprite.setFrame(frameIndex);
          sprite.hairSprite.setFrame(frameIndex);
          if (toolWeaponKey) sprite.toolSprite.setFrame(frameIndex);
          if (action === "fish_reel" || action === "fish_catch" || isArcher) sprite.arrowSprite.setFrame(frameIndex);
          if (hat) sprite.hatSprite.setFrame(frameIndex);
          }
        } else {
          // Hide tool overlays if not performing an action
          sprite.toolSprite.setVisible(false);
          sprite.arrowSprite.setVisible(false);

          const isSwimming = action === "swim";
          const isSubmerged = action === "swim_submerged";
          const isCarrying = playerData.equippedTool === "carrying";
          const isRiding = playerData.mount.startsWith("horse") || playerData.mount.startsWith("broomstick");
          const isBroomstick = playerData.mount.startsWith("broomstick");
          const isBicycle = playerData.mount.startsWith("bicycle");
          const isBear = playerData.mount.startsWith("bear");
          const isTractor = playerData.mount.startsWith("tractor");

          const horseVariant = parseInt(playerData.mount.replace("horse_", ""), 10) || 1;
          const broomstickVariant = isBroomstick ? parseInt(playerData.mount.replace("broomstick_", ""), 10) || 1 : 1;
          const bicycleColor = playerData.mount.replace("bicycle_", "") || "Red";

          const saddleColors = ["Black", "Blue", "Brown", "Green", "Pink"];
          let saddleColor = "Brown";
          if (clothesColor && saddleColors.includes(clothesColor)) {
            saddleColor = clothesColor;
          }

          if (isCarrying && sprite.cargoText) {
            sprite.cargoText.setVisible(true);
          } else if (sprite.cargoText) {
            sprite.cargoText.setVisible(false);
          }

          // Toggle visibility of normal vs horse vs swimming shadows/mounts
          if (isTractor) {
            if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
            if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
            if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
            if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
            if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
              sprite.horseSprite.setVisible(false);
              sprite.saddleSprite.setVisible(false);
              sprite.horseShadowSprite.setVisible(false);
            }
            if (sprite.tractorSprite) sprite.tractorSprite.setVisible(true);
            // Hide player body elements
            sprite.bodySprite.setVisible(false);
            sprite.eyesSprite.setVisible(false);
            sprite.clothesSprite.setVisible(false);
            sprite.hairSprite.setVisible(false);
            sprite.hatSprite.setVisible(false);
          } else {
            if (sprite.tractorSprite) sprite.tractorSprite.setVisible(false);

            if (isSwimming || isSubmerged) {
              if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
              if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
              if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
              if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
              if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setVisible(false);
                sprite.saddleSprite.setVisible(false);
                sprite.horseShadowSprite.setVisible(false);
              }
            } else if (isRiding) {
              if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
              if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
              if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
              if (isBroomstick) {
                if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                  sprite.horseSprite.setVisible(false);
                  sprite.saddleSprite.setVisible(false);
                  sprite.horseShadowSprite.setVisible(false);
                }
              } else {
                if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
              }
            } else if (isBicycle) {
              if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
              if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
              if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
              if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setVisible(false);
                sprite.saddleSprite.setVisible(false);
                sprite.horseShadowSprite.setVisible(false);
              }
            } else if (isBear) {
              if (sprite.shadowSprite) sprite.shadowSprite.setVisible(false);
              if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
              if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
              if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setVisible(false);
                sprite.saddleSprite.setVisible(false);
                sprite.horseShadowSprite.setVisible(false);
              }
            } else {
              if (sprite.shadowSprite) sprite.shadowSprite.setVisible(true);
              if (sprite.bicycleSprite) sprite.bicycleSprite.setVisible(false);
              if (sprite.bearSprite) sprite.bearSprite.setVisible(false);
              if (sprite.broomstickSprite) sprite.broomstickSprite.setVisible(false);
              if (sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setVisible(false);
                sprite.saddleSprite.setVisible(false);
                sprite.horseShadowSprite.setVisible(false);
              }
            }
          }

          if (isMoving) {
            if (isRunning || isBicycle || isBroomstick || isTractor) {
              // --- 1. RUNNING ANIMATION ---
              const runFrames = isSubmerged ? 3 : isSwimming ? 4 : isBear ? 6 : isBicycle ? 4 : isBroomstick ? 4 : isRiding ? 6 : isTractor ? 6 : 8;
              if (sprite.walkFrame >= runFrames) {
                sprite.walkFrame = 0;
                sprite.animTimer = 0;
              }

              sprite.animTimer += delta;
              // Running/Swimming fast cycles faster
              if (sprite.animTimer >= 90) {
                sprite.walkFrame = (sprite.walkFrame + 1) % runFrames;
                sprite.animTimer = 0;
              }

              let offset = 0;
              if (isTractor) {
                if (sprite.facingDir === "left")       offset = 18;
                else if (sprite.facingDir === "up")    offset = 12;
                else if (sprite.facingDir === "right") offset = 6;
                else                                   offset = 24; // down
              } else {
                if (sprite.facingDir === "left")       offset = isSubmerged ? 9 : (isSwimming || isBicycle || isBroomstick) ? 12 : (isRiding || isBear) ? 18 : 24;
                else if (sprite.facingDir === "right") offset = isSubmerged ? 6 : (isSwimming || isBicycle || isBroomstick) ? 8 : (isRiding || isBear) ? 12 : 16;
                else if (sprite.facingDir === "up")    offset = isSubmerged ? 3 : (isSwimming || isBicycle || isBroomstick) ? 4 : (isRiding || isBear) ? 6 : 8;
                else                                   offset = 0;
              }

              if (sprite.facingDir === "left" || sprite.facingDir === "right") {
                sprite.row = 1;
              } else if (sprite.facingDir === "up") {
                sprite.row = 2;
              } else {
                sprite.row = 0;
              }

              // Apply run textures and scale
              const runBodyKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_swim_body_${skinTone}` : isBroomstick ? `broomstick_run_body_${skinTone}` : isBear ? `bear_run_body_${skinTone}` : isBicycle ? `bicycle_run_body_${skinTone}` : isRiding ? `horse_run_body_${skinTone}` : isCarrying ? `carrying_run_body_${skinTone}` : `run_body_${skinTone}`;
              const runEyesKey    = (isSubmerged || isSwimming) ? `swim_swim_eyes_${gender}_${eyeColor}` : isBroomstick ? `broomstick_run_eyes_${gender}_${eyeColor}` : isBear ? `bear_run_eyes_${gender}_${eyeColor}` : isBicycle ? `bicycle_run_eyes_${gender}_${eyeColor}` : isRiding ? `horse_run_eyes_${gender}_${eyeColor}` : isCarrying ? `carrying_run_eyes_${gender}_${eyeColor}` : `run_eyes_${gender}_${eyeColor}`;
              const runClothesKey = (isSubmerged || isSwimming) ? `swim_swim_body_${skinTone}` : isBroomstick ? `broomstick_run_clothes_${clothesColor}` : isBear ? `bear_run_clothes_${clothesColor}` : isBicycle ? `bicycle_run_clothes_${clothesColor}` : isRiding ? `horse_run_clothes_${clothesColor}` : isCarrying ? `carrying_run_clothes_${clothesColor}` : `run_clothes_${clothesColor}`;
              const runHairKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_swim_hair_${mappedHair}_${hairColor}` : isBroomstick ? `broomstick_run_hair_${mappedHair}_${hairColor}` : isBear ? `bear_run_hair_${mappedHair}_${hairColor}` : isBicycle ? `bicycle_run_hair_${mappedHair}_${hairColor}` : isRiding ? `horse_run_hair_${mappedHair}_${hairColor}` : isCarrying ? `carrying_run_hair_${mappedHair}_${hairColor}` : getRunHairKey(hairStyle, hairColor);
              
              const runHatKey = isSubmerged
                ? `swim_submerged_body_${skinTone}`
                : isSwimming
                ? (hat === "Santa Hat" ? `swim_swim_hat_Santa Hat` : hat === "Pirate eyepatch" ? `swim_swim_hat_pirate eye patch` : `swim_swim_hat_${hat}`)
                : isBroomstick
                ? (hat === "Santa Hat" ? `broomstick_run_hat_Santa Hat` : hat === "Pirate eyepatch" ? `broomstick_run_hat_pirate eye patch` : `broomstick_run_hat_${hat}`)
                : isBear
                ? (hat === "Santa Hat" ? `bear_run_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_run_hat_pirate eye patch` : `bear_run_hat_${hat}`)
                : isBicycle
                ? (hat === "Santa Hat" ? `bicycle_run_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bicycle_run_hat_pirate eye patch` : `bicycle_run_hat_${hat}`)
                : isRiding
                ? (hat === "Santa Hat" ? `horse_run_hat_Santa Hat` : hat === "Pirate eyepatch" ? `horse_run_hat_pirate eye patch` : `horse_run_hat_${hat}`)
                : isCarrying
                ? (hat === "Santa Hat" ? `carrying_run_hat_Santa Hat` : hat === "Pirate eyepatch" ? `carrying_run_hat_pirate eye patch` : `carrying_run_hat_${hat}`)
                : getRunHatKey(hat);

              [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite].forEach(s => {
                s.setScale(2);
                s.setFlipX(false);
              });

              sprite.bodySprite.setTexture(runBodyKey);
              
              // Swimming and Submerged logic for other layers
              if (isTractor) {
                sprite.bodySprite.setVisible(false);
                sprite.eyesSprite.setVisible(false);
                sprite.clothesSprite.setVisible(false);
                sprite.hairSprite.setVisible(false);
                sprite.hatSprite.setVisible(false);
              } else if (isSubmerged) {
                sprite.eyesSprite.setVisible(false);
                sprite.clothesSprite.setVisible(false);
                sprite.hairSprite.setVisible(false);
                sprite.hatSprite.setVisible(false);
              } else if (isSwimming) {
                sprite.eyesSprite.setTexture(runEyesKey).setVisible(true);
                sprite.clothesSprite.setVisible(false); // Swim body has no clothes
                sprite.hairSprite.setTexture(runHairKey).setVisible(true);
                if (hat) {
                  sprite.hatSprite.setTexture(runHatKey).setVisible(true);
                } else {
                  sprite.hatSprite.setVisible(false);
                }
              } else {
                sprite.eyesSprite.setTexture(runEyesKey).setVisible(true);
                sprite.clothesSprite.setTexture(runClothesKey).setVisible(true);
                sprite.hairSprite.setTexture(runHairKey).setVisible(true);
                if (hat) {
                  sprite.hatSprite.setTexture(runHatKey).setVisible(true);
                } else {
                  sprite.hatSprite.setVisible(false);
                }
              }

              if (isCarrying && sprite.cargoText) {
                sprite.cargoText.setY(-22 + Math.sin(time / 50) * 3);
              }

              const frameIndex = offset + (sprite.walkFrame % runFrames);
              sprite.bodySprite.setFrame(frameIndex);
              if (sprite.eyesSprite.visible) sprite.eyesSprite.setFrame(frameIndex);
              if (sprite.clothesSprite.visible) sprite.clothesSprite.setFrame(frameIndex);
              if (sprite.hairSprite.visible) sprite.hairSprite.setFrame(frameIndex);
              if (hat && sprite.hatSprite.visible) sprite.hatSprite.setFrame(frameIndex);

              // Update horse frames
              if (isRiding && !isBroomstick && sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setTexture(`horse_body_horse_run_${horseVariant}`).setVisible(true).setFrame(frameIndex);
                sprite.saddleSprite.setTexture(`horse_saddle_horse_run_${saddleColor}`).setVisible(true).setFrame(frameIndex);
                sprite.horseShadowSprite.setTexture(`horse_shadow_horse_run`).setVisible(true).setFrame(frameIndex);
              }

              // Update broomstick frames
              if (isBroomstick && sprite.broomstickSprite) {
                sprite.broomstickSprite.setTexture(`broomstick_body_broomstick_run_${broomstickVariant}`).setVisible(true).setFrame(frameIndex);
              }

              // Update bicycle frames
              if (isBicycle && sprite.bicycleSprite) {
                sprite.bicycleSprite.setTexture(`bicycle_body_bicycle_run_${bicycleColor}`).setVisible(true).setFrame(frameIndex);
              }

              // Update bear frames
              if (isBear && sprite.bearSprite) {
                sprite.bearSprite.setTexture("bear_body_bear_run_Brown").setVisible(true).setFrame(frameIndex);
              }

              // Update tractor frames
              if (isTractor && sprite.tractorSprite) {
                sprite.tractorSprite.setFrame(frameIndex);
              }

            } else {
              // --- 2. WALKING ANIMATION ---
              const walkFrames = isSubmerged ? 3 : isSwimming ? 4 : isBear ? 4 : isRiding ? 4 : isTractor ? 6 : 6;
              if (sprite.walkFrame >= walkFrames) {
                sprite.walkFrame = 0;
                sprite.animTimer = 0;
              }

              sprite.animTimer += delta;
              if (sprite.animTimer >= FRAME_DELAY_MS) {
                sprite.walkFrame = (sprite.walkFrame + 1) % walkFrames;
                sprite.animTimer = 0;
              }

              let offset = 0;
              if (isTractor) {
                if (sprite.facingDir === "left")       offset = 18;
                else if (sprite.facingDir === "up")    offset = 12;
                else if (sprite.facingDir === "right") offset = 6;
                else                                   offset = 24; // down
              } else {
                if (sprite.facingDir === "left")       offset = isSubmerged ? 9 : (isSwimming || isRiding || isBear) ? 12 : 18;
                else if (sprite.facingDir === "right") offset = isSubmerged ? 6 : (isSwimming || isRiding || isBear) ? 8 : 12;
                else if (sprite.facingDir === "up")    offset = isSubmerged ? 3 : (isSwimming || isRiding || isBear) ? 4 : 6;
                else                                   offset = 0;
              }

              if (sprite.facingDir === "left" || sprite.facingDir === "right") {
                sprite.row = 1;
              } else if (sprite.facingDir === "up") {
                sprite.row = 2;
              } else {
                sprite.row = 0;
              }

              // Apply walk textures and scale
              const walkBodyKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_swim_body_${skinTone}` : isBroomstick ? `broomstick_walk_body_${skinTone}` : isBear ? `bear_walk_body_${skinTone}` : isRiding ? `horse_walk_body_${skinTone}` : isCarrying ? `carrying_walk_body_${skinTone}` : `body_${skinTone}`;
              const walkEyesKey    = (isSubmerged || isSwimming) ? `swim_swim_eyes_${gender}_${eyeColor}` : isBroomstick ? `broomstick_walk_eyes_${gender}_${eyeColor}` : isBear ? `bear_walk_eyes_${gender}_${eyeColor}` : isRiding ? `horse_walk_eyes_${gender}_${eyeColor}` : isCarrying ? `carrying_walk_eyes_${gender}_${eyeColor}` : `eyes_${gender}_${eyeColor}`;
              const walkClothesKey = (isSubmerged || isSwimming) ? `swim_swim_body_${skinTone}` : isBroomstick ? `broomstick_walk_clothes_${clothesColor}` : isBear ? `bear_walk_clothes_${clothesColor}` : isRiding ? `horse_walk_clothes_${clothesColor}` : isCarrying ? `carrying_walk_clothes_${clothesColor}` : `clothes_${clothesColor}`;
              const walkHairKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_swim_hair_${mappedHair}_${hairColor}` : isBroomstick ? `broomstick_walk_hair_${mappedHair}_${hairColor}` : isBear ? `bear_walk_hair_${mappedHair}_${hairColor}` : isRiding ? `horse_walk_hair_${mappedHair}_${hairColor}` : isCarrying ? `carrying_walk_hair_${mappedHair}_${hairColor}` : getWalkHairKey(hairStyle, hairColor);
              
              const walkHatKey = isSubmerged
                ? `swim_submerged_body_${skinTone}`
                : isSwimming
                ? (hat === "Santa Hat" ? `swim_swim_hat_Santa Hat` : hat === "Pirate eyepatch" ? `swim_swim_hat_pirate eye patch` : `swim_swim_hat_${hat}`)
                : isBroomstick
                ? (hat === "Santa Hat" ? `broomstick_walk_hat_Santa Hat` : hat === "Pirate eyepatch" ? `broomstick_walk_hat_pirate eye patch` : `broomstick_walk_hat_${hat}`)
                : isBear
                ? (hat === "Santa Hat" ? `bear_walk_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_walk_hat_pirate eye patch` : `bear_walk_hat_${hat}`)
                : isRiding
                ? (hat === "Santa Hat" ? `horse_walk_hat_Santa Hat` : hat === "Pirate eyepatch" ? `horse_walk_hat_pirate eye patch` : `horse_walk_hat_${hat}`)
                : isCarrying
                ? (hat === "Santa Hat" ? `carrying_walk_hat_Santa Hat` : hat === "Pirate eyepatch" ? `carrying_walk_hat_pirate eye patch` : `carrying_walk_hat_${hat}`)
                : getWalkHatKey(hat);

              [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite].forEach(s => {
                s.setScale(2);
                s.setFlipX(false);
              });

              sprite.bodySprite.setTexture(walkBodyKey);
              
              // Swimming and Submerged logic for other layers
              if (isTractor) {
                sprite.bodySprite.setVisible(false);
                sprite.eyesSprite.setVisible(false);
                sprite.clothesSprite.setVisible(false);
                sprite.hairSprite.setVisible(false);
                sprite.hatSprite.setVisible(false);
              } else if (isSubmerged) {
                sprite.eyesSprite.setVisible(false);
                sprite.clothesSprite.setVisible(false);
                sprite.hairSprite.setVisible(false);
                sprite.hatSprite.setVisible(false);
              } else if (isSwimming) {
                sprite.eyesSprite.setTexture(walkEyesKey).setVisible(true);
                sprite.clothesSprite.setVisible(false); // Swim body has no clothes
                sprite.hairSprite.setTexture(walkHairKey).setVisible(true);
                if (hat) {
                  sprite.hatSprite.setTexture(walkHatKey).setVisible(true);
                } else {
                  sprite.hatSprite.setVisible(false);
                }
              } else {
                sprite.eyesSprite.setTexture(walkEyesKey).setVisible(true);
                sprite.clothesSprite.setTexture(walkClothesKey).setVisible(true);
                sprite.hairSprite.setTexture(walkHairKey).setVisible(true);
                if (hat) {
                  sprite.hatSprite.setTexture(walkHatKey).setVisible(true);
                } else {
                  sprite.hatSprite.setVisible(false);
                }
              }

              if (isCarrying && sprite.cargoText) {
                sprite.cargoText.setY(-22 + Math.sin(time / 100) * 2);
              }

              const frameIndex = offset + (sprite.walkFrame % walkFrames);
              sprite.bodySprite.setFrame(frameIndex);
              if (sprite.eyesSprite.visible) sprite.eyesSprite.setFrame(frameIndex);
              if (sprite.clothesSprite.visible) sprite.clothesSprite.setFrame(frameIndex);
              if (sprite.hairSprite.visible) sprite.hairSprite.setFrame(frameIndex);
              if (hat && sprite.hatSprite.visible) sprite.hatSprite.setFrame(frameIndex);

              // Update horse frames
              if (isRiding && !isBroomstick && sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
                sprite.horseSprite.setTexture(`horse_body_horse_walk_${horseVariant}`).setVisible(true).setFrame(frameIndex);
                sprite.saddleSprite.setTexture(`horse_saddle_horse_walk_${saddleColor}`).setVisible(true).setFrame(frameIndex);
                sprite.horseShadowSprite.setTexture(`horse_shadow_horse_walk`).setVisible(true).setFrame(frameIndex);
              }

              // Update broomstick frames
              if (isBroomstick && sprite.broomstickSprite) {
                sprite.broomstickSprite.setTexture(`broomstick_body_broomstick_walk_${broomstickVariant}`).setVisible(true).setFrame(frameIndex);
              }

               // Update bear frames
              if (isBear && sprite.bearSprite) {
                sprite.bearSprite.setTexture("bear_body_bear_walk_Brown").setVisible(true).setFrame(frameIndex);
              }

              // Update tractor frames
              if (isTractor && sprite.tractorSprite) {
                sprite.tractorSprite.setFrame(frameIndex);
              }
            }

          } else {
            // --- 3. IDLE ANIMATION ---
            const idleFrames = isSubmerged ? 3 : isSwimming ? 4 : isBear ? 2 : isBicycle ? 2 : isRiding ? 2 : isTractor ? 1 : 4;
            if (sprite.walkFrame >= idleFrames) {
              sprite.walkFrame = 0;
              sprite.animTimer = 0;
            }

            sprite.animTimer += delta;
            if (sprite.animTimer >= FRAME_DELAY_MS) {
              sprite.walkFrame = (sprite.walkFrame + 1) % idleFrames;
              sprite.animTimer = 0;
            }

            let offset = 0;
            if (isTractor) {
              if (sprite.facingDir === "left")       offset = 2;
              else if (sprite.facingDir === "up")    offset = 1;
              else if (sprite.facingDir === "right") offset = 0;
              else                                   offset = 3; // down
            } else {
              if (sprite.facingDir === "left")       offset = isSubmerged ? 9 : isSwimming ? 12 : (isRiding || isBear) ? 6 : isBicycle ? 6 : 12;
              else if (sprite.facingDir === "right") offset = isSubmerged ? 6 : isSwimming ? 8 : (isRiding || isBear) ? 4 : isBicycle ? 4 : 8;
              else if (sprite.facingDir === "up")    offset = isSubmerged ? 3 : isSwimming ? 4 : (isRiding || isBear) ? 2 : isBicycle ? 2 : 4;
              else                                   offset = 0;
            }

            // Apply idle textures and scale
            const idleBodyKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_idle_body_${skinTone}` : isBroomstick ? `broomstick_idle_body_${skinTone}` : isBear ? `bear_idle_body_${skinTone}` : isBicycle ? `bicycle_idle_body_${skinTone}` : isRiding ? `horse_idle_body_${skinTone}` : isCarrying ? `carrying_idle_body_${skinTone}` : `idle_body_${skinTone}`;
            const idleEyesKey    = (isSubmerged || isSwimming) ? `swim_idle_eyes_${gender}_${eyeColor}` : isBroomstick ? `broomstick_idle_eyes_${gender}_${eyeColor}` : isBear ? `bear_idle_eyes_${gender}_${eyeColor}` : isBicycle ? `bicycle_idle_eyes_${gender}_${eyeColor}` : isRiding ? `horse_idle_eyes_${gender}_${eyeColor}` : isCarrying ? `carrying_idle_eyes_${gender}_${eyeColor}` : `idle_eyes_${gender}_${eyeColor}`;
            const idleClothesKey = (isSubmerged || isSwimming) ? `swim_idle_body_${skinTone}` : isBroomstick ? `broomstick_idle_clothes_${clothesColor}` : isBear ? `bear_idle_clothes_${clothesColor}` : isBicycle ? `bicycle_idle_clothes_${clothesColor}` : isRiding ? `horse_idle_clothes_${clothesColor}` : isCarrying ? `carrying_idle_clothes_${clothesColor}` : `idle_clothes_${clothesColor}`;
            const idleHairKey    = isSubmerged ? `swim_submerged_body_${skinTone}` : isSwimming ? `swim_idle_hair_${mappedHair}_${hairColor}` : isBroomstick ? `broomstick_idle_hair_${mappedHair}_${hairColor}` : isBear ? `bear_idle_hair_${mappedHair}_${hairColor}` : isBicycle ? `bicycle_idle_hair_${mappedHair}_${hairColor}` : isRiding ? `horse_idle_hair_${mappedHair}_${hairColor}` : isCarrying ? `carrying_idle_hair_${mappedHair}_${hairColor}` : getIdleHairKey(hairStyle, hairColor);
            
            const idleHatKey = isSubmerged
              ? `swim_submerged_body_${skinTone}`
              : isSwimming
              ? (hat === "Santa Hat" ? `swim_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `swim_idle_hat_pirate eye patch` : `swim_idle_hat_${hat}`)
              : isBroomstick
              ? (hat === "Santa Hat" ? `broomstick_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `broomstick_idle_hat_pirate eye patch` : `broomstick_idle_hat_${hat}`)
              : isBear
              ? (hat === "Santa Hat" ? `bear_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bear_idle_hat_pirate eye patch` : `bear_idle_hat_${hat}`)
              : isBicycle
              ? (hat === "Santa Hat" ? `bicycle_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `bicycle_idle_hat_pirate eye patch` : `bicycle_idle_hat_${hat}`)
              : isRiding
              ? (hat === "Santa Hat" ? `horse_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `horse_idle_hat_pirate eye patch` : `horse_idle_hat_${hat}`)
              : isCarrying
              ? (hat === "Santa Hat" ? `carrying_idle_hat_Santa Hat` : hat === "Pirate eyepatch" ? `carrying_idle_hat_pirate eye patch` : `carrying_idle_hat_${hat}`)
              : getIdleHatKey(hat);

            [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite].forEach(s => {
              s.setScale(2);
              s.setFlipX(false);
            });

            sprite.bodySprite.setTexture(idleBodyKey);

            // Swimming and Submerged logic for other layers
            if (isTractor) {
              sprite.bodySprite.setVisible(false);
              sprite.eyesSprite.setVisible(false);
              sprite.clothesSprite.setVisible(false);
              sprite.hairSprite.setVisible(false);
              sprite.hatSprite.setVisible(false);
            } else if (isSubmerged) {
              sprite.eyesSprite.setVisible(false);
              sprite.clothesSprite.setVisible(false);
              sprite.hairSprite.setVisible(false);
              sprite.hatSprite.setVisible(false);
            } else if (isSwimming) {
              sprite.eyesSprite.setTexture(idleEyesKey).setVisible(true);
              sprite.clothesSprite.setVisible(false); // Swim body has no clothes
              sprite.hairSprite.setTexture(idleHairKey).setVisible(true);
              if (hat) {
                sprite.hatSprite.setTexture(idleHatKey).setVisible(true);
              } else {
                sprite.hatSprite.setVisible(false);
              }
            } else {
              sprite.eyesSprite.setTexture(idleEyesKey).setVisible(true);
              sprite.clothesSprite.setTexture(idleClothesKey).setVisible(true);
              sprite.hairSprite.setTexture(idleHairKey).setVisible(true);
              if (hat) {
                sprite.hatSprite.setTexture(idleHatKey).setVisible(true);
              } else {
                sprite.hatSprite.setVisible(false);
              }
            }

            if (isCarrying && sprite.cargoText) {
              sprite.cargoText.setY(-24);
            }

            const frameIndex = offset + (sprite.walkFrame % idleFrames);
            sprite.bodySprite.setFrame(frameIndex);
            if (sprite.eyesSprite.visible) sprite.eyesSprite.setFrame(frameIndex);
            if (sprite.clothesSprite.visible) sprite.clothesSprite.setFrame(frameIndex);
            if (sprite.hairSprite.visible) sprite.hairSprite.setFrame(frameIndex);
            if (hat && sprite.hatSprite.visible) sprite.hatSprite.setFrame(frameIndex);

            // Update horse frames
            if (isRiding && !isBroomstick && sprite.horseSprite && sprite.saddleSprite && sprite.horseShadowSprite) {
              sprite.horseSprite.setTexture(`horse_body_horse_idle_${horseVariant}`).setVisible(true).setFrame(frameIndex);
              sprite.saddleSprite.setTexture(`horse_saddle_horse_idle_${saddleColor}`).setVisible(true).setFrame(frameIndex);
              sprite.horseShadowSprite.setTexture(`horse_shadow_horse_idle`).setVisible(true).setFrame(frameIndex);
            }

            // Update broomstick frames
            if (isBroomstick && sprite.broomstickSprite) {
              sprite.broomstickSprite.setTexture(`broomstick_body_broomstick_idle_${broomstickVariant}`).setVisible(true).setFrame(frameIndex);
            }

            // Update bicycle frames
            if (isBicycle && sprite.bicycleSprite) {
              sprite.bicycleSprite.setTexture(`bicycle_body_bicycle_idle_${bicycleColor}`).setVisible(true).setFrame(frameIndex);
            }

            // Update bear frames
            if (isBear && sprite.bearSprite) {
              sprite.bearSprite.setTexture("bear_body_bear_idle_Brown").setVisible(true).setFrame(frameIndex);
            }

            // Update tractor frames
            if (isTractor && sprite.tractorSprite) {
              sprite.tractorSprite.setFrame(frameIndex);
            }
          }

          // Apply Y offset to character sprites based on riding state
          const charSprites = [sprite.bodySprite, sprite.eyesSprite, sprite.clothesSprite, sprite.hairSprite, sprite.hatSprite];
          charSprites.forEach(s => {
            s.setY(isBroomstick ? -4 : (isRiding || isBear) ? -12 : isBicycle ? -4 : 0);
          });
        }
      }

      // Save position for next frame delta check
      sprite.lastX = sprite.container.x;
      sprite.lastY = sprite.container.y;
    });

    // 3. Camera follow is handled by Phaser's startFollow() called at spawn time
  }

  // -------------------------------------------------------------------------
  // Ground rendering
  // -------------------------------------------------------------------------
  private drawGround(w?: number, h?: number): void {
    const isWorld1 = this.currentMapId === "world_1";
    const isWorld2 = this.currentMapId === "world_2";
    const isWorld3 = this.currentMapId === "world_3";
    const isWorld4 = this.currentMapId === "world_4";
    const isWorld5 = this.currentMapId === "world_5";
    const isWorld6 = this.currentMapId === "world_6";
    const isWorld7 = this.currentMapId === "world_7";

    const is1500 = isWorld4 || isWorld5 || isWorld6 || isWorld7;
    const mapW = w ?? (is1500 ? 1500 : (isWorld1 ? WORLD_WIDTH : 2000));
    const mapH = h ?? (is1500 ? 1500 : (isWorld1 ? WORLD_HEIGHT : 2000));

    if (this.groundLayer) {
      this.groundLayer.destroy();
    }

    const bgFill = isWorld7 ? 0x092230 : (isWorld6 ? 0x072018 : (isWorld5 ? 0x2a0d18 : (isWorld4 ? 0x291f0d : (isWorld3 ? 0x181328 : (isWorld2 ? 0x0f2229 : 0x0d2918)))));
    const gridColor = isWorld7 ? 0x165063 : (isWorld6 ? 0x114a33 : (isWorld5 ? 0x4a182a : (isWorld4 ? 0x4a3412 : (isWorld3 ? 0x2a224a : (isWorld2 ? 0x18444a : 0x1a472a)))));
    const borderColor = isWorld7 ? 0x00e5ff : (isWorld6 ? 0x00ff88 : (isWorld5 ? 0xff4757 : (isWorld4 ? 0xffa502 : (isWorld3 ? 0x9c88ff : (isWorld2 ? 0x00d2d3 : 0x52b788)))));

    this.groundLayer = this.add.graphics();
    this.groundLayer.fillStyle(bgFill, 1);
    this.groundLayer.fillRect(0, 0, mapW, mapH);
    this.groundLayer.lineStyle(1, gridColor, 0.4);

    this.groundLayer.beginPath();
    for (let x = 0; x <= mapW; x += GRID_SIZE * 2) {
      this.groundLayer.moveTo(x, 0);
      this.groundLayer.lineTo(x, mapH);
    }
    for (let y = 0; y <= mapH; y += GRID_SIZE * 2) {
      this.groundLayer.moveTo(0, y);
      this.groundLayer.lineTo(mapW, y);
    }
    this.groundLayer.strokePath();

    this.groundLayer.lineStyle(4, borderColor, 0.9);
    this.groundLayer.strokeRect(0, 0, mapW, mapH);

    // Glowing border on the map transition edges
    if (isWorld2) {
      // Harita 2: right edge glows cyan (to Harita 1), left edge glows purple (to Harita 3)
      this.groundLayer.lineStyle(8, 0x00d2d3, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(mapW - 4, 0);
      this.groundLayer.lineTo(mapW - 4, mapH);
      this.groundLayer.strokePath();

      this.groundLayer.lineStyle(8, 0x9c88ff, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(4, 0);
      this.groundLayer.lineTo(4, mapH);
      this.groundLayer.strokePath();
    } else if (isWorld3) {
      // Harita 3: right edge glows purple (back to Harita 2)
      this.groundLayer.lineStyle(8, 0x9c88ff, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(mapW - 4, 0);
      this.groundLayer.lineTo(mapW - 4, mapH);
      this.groundLayer.strokePath();
    } else if (isWorld4) {
      // Harita 4: left edge glows amber (back to Harita 1), right edge glows crimson (to Harita 5)
      this.groundLayer.lineStyle(8, 0xffa502, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(4, 0);
      this.groundLayer.lineTo(4, mapH);
      this.groundLayer.strokePath();

      this.groundLayer.lineStyle(8, 0xff4757, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(mapW - 4, 0);
      this.groundLayer.lineTo(mapW - 4, mapH);
      this.groundLayer.strokePath();
    } else if (isWorld5) {
      // Harita 5: left edge glows crimson (back to Harita 4), bottom edge glows emerald (to Harita 6)
      this.groundLayer.lineStyle(8, 0xff4757, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(4, 0);
      this.groundLayer.lineTo(4, mapH);
      this.groundLayer.strokePath();

      this.groundLayer.lineStyle(8, 0x00ff88, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(0, mapH - 4);
      this.groundLayer.lineTo(mapW, mapH - 4);
      this.groundLayer.strokePath();
    } else if (isWorld6) {
      // Harita 6: top edge glows emerald (back to Harita 5)
      this.groundLayer.lineStyle(8, 0x00ff88, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(0, 4);
      this.groundLayer.lineTo(mapW, 4);
      this.groundLayer.strokePath();
    } else if (isWorld7) {
      // Harita 7: top edge glows cyan (back to Harita 1)
      this.groundLayer.lineStyle(8, 0x00e5ff, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(0, 4);
      this.groundLayer.lineTo(mapW, 4);
      this.groundLayer.strokePath();
    } else {
      // Harita 1: left edge glows emerald (to Harita 2), right edge glows amber (to Harita 4), bottom edge glows cyan (to Harita 7)
      this.groundLayer.lineStyle(8, 0x52b788, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(4, 0);
      this.groundLayer.lineTo(4, mapH);
      this.groundLayer.strokePath();

      this.groundLayer.lineStyle(8, 0xffa502, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(mapW - 4, 0);
      this.groundLayer.lineTo(mapW - 4, mapH);
      this.groundLayer.strokePath();

      this.groundLayer.lineStyle(8, 0x00e5ff, 0.8);
      this.groundLayer.beginPath();
      this.groundLayer.moveTo(0, mapH - 4);
      this.groundLayer.lineTo(mapW, mapH - 4);
      this.groundLayer.strokePath();
    }

    this.groundLayer.setDepth(0);
  }

  public switchMap(mapId: string): void {
    this.currentMapId = mapId || "world_1";
    const isWorld1 = this.currentMapId === "world_1";
    const isWorld4 = this.currentMapId === "world_4";
    const isWorld5 = this.currentMapId === "world_5";
    const isWorld6 = this.currentMapId === "world_6";
    const isWorld7 = this.currentMapId === "world_7";
    const is1500 = isWorld4 || isWorld5 || isWorld6 || isWorld7;
    const mapW = is1500 ? 1500 : (isWorld1 ? WORLD_WIDTH : 2000);
    const mapH = is1500 ? 1500 : (isWorld1 ? WORLD_HEIGHT : 2000);

    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.drawGround(mapW, mapH);

    // Update map objects visibility based on active map
    if (this.room?.state?.mapObjects) {
      this.room.state.mapObjects.forEach((obj: any, key: string) => {
        const sprite = this.placedObjectSprites.get(key);
        if (sprite) {
          const objMap = obj.mapId || "world_1";
          sprite.setVisible(objMap === this.currentMapId);
        }
      });
    }

    // Update remote players visibility
    if (this.room?.state?.players) {
      this.room.state.players.forEach((player: any, sessionId: string) => {
        if (sessionId !== this.localSessionId) {
          const pSprite = this.playerSprites.get(sessionId);
          if (pSprite && pSprite.container) {
            const pMap = player.currentMap || "world_1";
            pSprite.container.setVisible(pMap === this.currentMapId);
          }
        }
      });
    }

    // Update enemies visibility
    if (this.room?.state?.enemies) {
      this.room.state.enemies.forEach((enemy: any, id: string) => {
        const eSprite = this.enemySprites.get(id);
        if (eSprite && eSprite.container) {
          const spawner = this.room.state.mapObjects.get(id.replace("enemy_", ""));
          const eMap = spawner ? (spawner.mapId || "world_1") : "world_1";
          eSprite.container.setVisible(eMap === this.currentMapId && enemy.action !== "dead");
        }
      });
    }

    window.dispatchEvent(new CustomEvent("map_switched", {
      detail: { mapId: this.currentMapId, width: mapW, height: mapH }
    }));

    console.log(`[GameScene] 🗺️ Switched map view to ${this.currentMapId} (${mapW}x${mapH}px)`);
  }

  // -------------------------------------------------------------------------
  // Input handling
  // -------------------------------------------------------------------------
  private handleInput(): void {
    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;
    const run   = this.cursors.shift.isDown;

    const now = Date.now();
    if (now - this.lastInputSentAt >= INPUT_SEND_INTERVAL_MS) {
      try {
        this.room.send("input", { left, right, up, down, run });
      } catch {
        // Silently catch in case of disconnection
      }
      this.lastInputSentAt = now;
    }

    // Check spacebar weapon attack hit detection on nearby enemies
    if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      if (this.localSprite) {
        const px = this.localSprite.container.x;
        const py = this.localSprite.container.y;

        let closestEnemyId: string | null = null;
        let closestDist = Infinity;

        this.enemySprites.forEach((enemy, id) => {
          const dx = enemy.container.x - px;
          const dy = enemy.container.y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestEnemyId = id;
          }
        });

        if (closestEnemyId && closestDist <= 220) {
          try {
            const hasBoost = Boolean((window as any).goblinDamageBoost);
            this.room.send("hit_enemy", { enemyId: closestEnemyId, hasBoost });
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Colyseus state binding
  // -------------------------------------------------------------------------
  private bindRoomEvents(): void {
    const { players, enemies } = this.room.state;

    players.onAdd((player: RemotePlayerData, sessionId: string) => {
      console.log(`[GameScene] Player added: ${sessionId} at (${Math.round(player.x)}, ${Math.round(player.y)})`);

      if (this.sceneReady) {
        this.spawnPlayer(player, sessionId);
      } else {
        this.pendingSpawns.push({ data: { ...player }, sessionId });
      }

      player.onChange?.(() => {
        this.updatePlayerPosition(player, sessionId);
      });
    });

    players.onRemove((_player: RemotePlayerData, sessionId: string) => {
      console.log(`[GameScene] Player removed: ${sessionId}`);
      this.despawnPlayer(sessionId);
    });

    // --- Enemy bindings ---
    enemies?.onAdd?.((enemy: any, id: string) => {
      this.spawnEnemy(enemy, id);
      enemy.onChange?.(() => {
        this.updateEnemy(enemy, id);
      });
    });

    enemies?.onRemove?.((_enemy: any, id: string) => {
      this.despawnEnemy(id);
    });

    // --- Map Objects bindings ---
    const { mapObjects } = this.room.state;

    mapObjects.onAdd((obj: any, key: string) => {
      this.createPlacedObject(obj, key);
      
      obj.onChange(() => {
        this.updatePlacedObject(obj, key);
      });
    });

    mapObjects.onRemove((_obj: any, key: string) => {
      this.destroyPlacedObject(key);
    });
  }

  // -------------------------------------------------------------------------
  // Player sprite management
  // -------------------------------------------------------------------------
  private spawnPlayer(data: RemotePlayerData, sessionId: string): void {
    if (!this.sceneReady) return;

    const isLocal = sessionId === this.localSessionId;

    // Create Container to hold player layers
    const container = this.add.container(data.x, data.y);
    container.setDepth(2);

    // 1. Draw Shadow (transparent black ellipse under the feet)
    const shadow = this.add.ellipse(0, 20, 32, 12, 0x000000, 0.25);

    // 2. Draw Body Layer (Default facing down frame 0)
    const bodySprite = this.add.sprite(0, 0, `idle_body_${data.skinTone || 1}`, 0);
    bodySprite.setScale(2);

    // 3. Draw Eyes Layer (Default facing down frame 0)
    const eyesSprite = this.add.sprite(0, 0, `idle_eyes_${data.gender || "male"}_${data.eyeColor || "Black"}`, 0);
    eyesSprite.setScale(2);

    // 4. Draw Clothes Layer (Default facing down frame 0)
    const clothesSprite = this.add.sprite(0, 0, `idle_clothes_${data.clothesColor || "Blue"}`, 0);
    clothesSprite.setScale(2);

    // 5. Draw Hair Layer (Default facing down frame 0)
    const hairSprite = this.add.sprite(0, 0, getIdleHairKey(data.hairStyle || "Standart", data.hairColor || "Black"), 0);
    hairSprite.setScale(2);

    // 6. Draw Tool Action Layer (Default hidden)
    const toolSprite = this.add.sprite(0, 0, `idle_body_${data.skinTone || 1}`, 0);
    toolSprite.setVisible(false);
    toolSprite.setScale(2);

    // Arrow FX Layer (Default hidden)
    const arrowSprite = this.add.sprite(0, 0, `idle_body_${data.skinTone || 1}`, 0);
    arrowSprite.setVisible(false);
    arrowSprite.setScale(2);

    // 7. Draw Hat Layer (Default facing down frame 0)
    const hasHat = Boolean(data.hat);
    const hatSprite = this.add.sprite(0, 0, hasHat ? getIdleHatKey(data.hat) : `idle_body_${data.skinTone || 1}`, 0);
    hatSprite.setVisible(hasHat);
    hatSprite.setScale(2);

    // 8. Draw Name label (positioned on top)
    const nameLabel = this.add.text(0, -38, data.name, {
      fontFamily: "'Press Start 2P'",
      fontSize:   isLocal ? "7px" : "6px",
      color:      isLocal ? "#ffffff" : "#c8d6e5",
      stroke:     "#000000",
      strokeThickness: 3,
      resolution: 2,
    });
    nameLabel.setOrigin(0.5, 1);

    // If local player, highlight name or draw indicator
    if (isLocal) {
      nameLabel.setColor("#52b788"); // Highlight local player name green
    }

    // Cargo Text Layer (Default hidden)
    const cargoEmojis = ["📦", "🪵", "🪨", "🎃", "💎", "🍒", "🍇", "🍉"];
    let hash = 0;
    for (let charIndex = 0; charIndex < sessionId.length; charIndex++) {
      hash += sessionId.charCodeAt(charIndex);
    }
    const emoji = cargoEmojis[hash % cargoEmojis.length];

    const cargoText = this.add.text(0, -22, emoji, {
      fontFamily: "Inter, Arial",
      fontSize: "18px",
      resolution: 2,
    });
    cargoText.setOrigin(0.5, 0.5);
    cargoText.setVisible(false);

    // Horse layers (Default hidden)
    const horseShadowSprite = this.add.sprite(0, 0, "horse_shadow_horse_idle", 0);
    horseShadowSprite.setScale(2);
    horseShadowSprite.setVisible(false);

    const horseSprite = this.add.sprite(0, 0, "horse_body_horse_idle_1", 0);
    horseSprite.setScale(2);
    horseSprite.setVisible(false);

    const saddleSprite = this.add.sprite(0, 0, "horse_saddle_horse_idle_Brown", 0);
    saddleSprite.setScale(2);
    saddleSprite.setVisible(false);

    // Bicycle layers (Default hidden)
    const bicycleSprite = this.add.sprite(0, 0, "bicycle_body_bicycle_idle_Red", 0);
    bicycleSprite.setScale(2);
    bicycleSprite.setVisible(false);

    // Bear layers (Default hidden)
    const bearSprite = this.add.sprite(0, 0, "bear_body_bear_idle_Brown", 0);
    bearSprite.setScale(2);
    bearSprite.setVisible(false);

    // Broomstick layers (Default hidden)
    const broomstickSprite = this.add.sprite(0, 0, "broomstick_body_broomstick_idle_1", 0);
    broomstickSprite.setScale(2);
    broomstickSprite.setVisible(false);

    // Tractor layers (Default hidden)
    const tractorSprite = this.add.sprite(0, -16, "tractor", 3);
    tractorSprite.setScale(1.5);
    tractorSprite.setVisible(false);

    // Add children to container (hat layer sits on top of hair layer)
    container.add([shadow, horseShadowSprite, horseSprite, saddleSprite, bicycleSprite, bearSprite, broomstickSprite, tractorSprite, bodySprite, eyesSprite, clothesSprite, hairSprite, toolSprite, arrowSprite, hatSprite, cargoText, nameLabel]);

    const sprite: PlayerSprite = {
      container,
      bodySprite,
      eyesSprite,
      clothesSprite,
      hairSprite,
      toolSprite,
      arrowSprite,
      cargoText,
      horseSprite,
      saddleSprite,
      horseShadowSprite,
      shadowSprite: shadow,
      bicycleSprite,
      bearSprite,
      broomstickSprite,
      tractorSprite,
      hatSprite,
      nameLabel,
      targetX: data.x,
      targetY: data.y,
      lastX: data.x,
      lastY: data.y,
      row: 0,
      walkFrame: 0,
      animTimer: 0,
      facingDir: "down",
    };

    this.playerSprites.set(sessionId, sprite);

    if (isLocal) {
      if (data.currentMap && data.currentMap !== this.currentMapId) {
        this.switchMap(data.currentMap);
      }
      this.localSprite = sprite;
      // Use Phaser's built-in startFollow — handles zoom, bounds, and smooth lerp automatically
      this.cameras.main.startFollow(sprite.container, true, 0.1, 0.1);
    } else {
      // Hide remote player if they are on a different map
      const remoteMap = data.currentMap || "world_1";
      container.setVisible(remoteMap === this.currentMapId);
    }
  }

  private updatePlayerPosition(data: RemotePlayerData, sessionId: string): void {
    const sprite = this.playerSprites.get(sessionId);
    if (!sprite) return;

    if (sessionId === this.localSessionId) {
      if (data.currentMap && data.currentMap !== this.currentMapId) {
        this.switchMap(data.currentMap);
      }
      sprite.container.setPosition(data.x, data.y);
      this.registry.set("localX", Math.round(data.x));
      this.registry.set("localY", Math.round(data.y));
    } else {
      const remoteMap = data.currentMap || "world_1";
      sprite.container.setVisible(remoteMap === this.currentMapId);
      sprite.targetX = data.x;
      sprite.targetY = data.y;
    }

    this.updatePlayerPet(data, sessionId);
  }

  private updatePlayerPet(data: RemotePlayerData, sessionId: string): void {
    const petData = this.petSprites.get(sessionId);
    
    if (data.petType) {
      const px = data.petX !== undefined ? data.petX : data.x;
      const py = data.petY !== undefined ? data.petY : data.y;

      if (!petData) {
        // Create new pet sprite
        const sprite = this.add.sprite(px, py, data.petType, 0);
        sprite.setScale(1.5);
        sprite.setOrigin(0.5, 0.5);
        this.petSprites.set(sessionId, {
          sprite,
          targetX: px,
          targetY: py
        });
      } else {
        // Update existing pet properties
        if (data.petType !== petData.sprite.texture.key) {
          petData.sprite.setTexture(data.petType);
        }
        petData.targetX = px;
        petData.targetY = py;
      }
    } else {
      // If player has no pet now but had one before, clean it up
      if (petData) {
        petData.sprite.destroy();
        this.petSprites.delete(sessionId);
      }
    }
  }

  private despawnPlayer(sessionId: string): void {
    const sprite = this.playerSprites.get(sessionId);
    if (!sprite) return;

    sprite.container.destroy();
    this.playerSprites.delete(sessionId);

    // Clean up pet sprite
    const petData = this.petSprites.get(sessionId);
    if (petData) {
      petData.sprite.destroy();
      this.petSprites.delete(sessionId);
    }

    if (sessionId === this.localSessionId) {
      this.localSprite = null;
    }
  }

  // ---- Map Editor helper methods ----
  private createPlacedObject(obj: any, key: string): void {
    if (this.placedObjectSprites.has(key)) {
      this.destroyPlacedObject(key);
    }

    let sprite: any;

    if (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet") {
      const isWet = obj.assetId === "tilled_soil_wet";
      const container = this.add.container(obj.x, obj.y);
      container.setSize(32, 32);
      const soilBg = this.add.rectangle(0, 0, 32, 32, isWet ? 0x50371a : 0x825a2c);
      soilBg.setStrokeStyle(1.5, isWet ? 0x2d1f0e : 0x5a3e1e);
      container.add(soilBg);

      if (obj.cropType && obj.cropType !== "none") {
        const cropTextureKey = `crop_${obj.cropType}`;
        if (this.textures.exists(cropTextureKey)) {
          const frameIndex = obj.cropStage * 2;
          const cropSprite = this.add.sprite(0, 0, cropTextureKey, frameIndex);
          cropSprite.setScale(2);
          container.add(cropSprite);
        } else {
          const stage = obj.cropStage;
          if (stage === 0) {
            const seed = this.add.circle(0, 4, 3, 0xf1c40f);
            container.add(seed);
          } else if (stage === 1) {
            const sprout = this.add.graphics();
            sprout.lineStyle(2.5, 0x2ed573);
            sprout.beginPath();
            sprout.moveTo(0, 8);
            sprout.lineTo(0, -2);
            sprout.lineTo(-3, -5);
            sprout.moveTo(0, -2);
            sprout.lineTo(3, -5);
            sprout.strokePath();
            container.add(sprout);
          } else if (stage === 2) {
            const plant = this.add.graphics();
            plant.lineStyle(3, 0x2ed573);
            plant.beginPath();
            plant.moveTo(0, 10);
            plant.lineTo(0, -6);
            plant.lineTo(-5, -10);
            plant.moveTo(0, -2);
            plant.lineTo(5, -6);
            plant.moveTo(0, -6);
            plant.lineTo(4, -12);
            plant.strokePath();
            container.add(plant);
          } else if (stage === 3) {
            const plant = this.add.graphics();
            plant.lineStyle(3.5, 0x2ed573);
            plant.beginPath();
            plant.moveTo(0, 12);
            plant.lineTo(0, -6);
            plant.strokePath();
            container.add(plant);

            let cropColor = 0xffffff;
            let cropIcon = "?";
            if (obj.cropType === "apple") { cropColor = 0xff4757; cropIcon = "🍎"; }
            else if (obj.cropType === "carrot") { cropColor = 0xffa502; cropIcon = "🥕"; }
            else if (obj.cropType === "wheat") { cropColor = 0xffd32a; cropIcon = "🌾"; }

            const fruit = this.add.circle(0, -8, 7, cropColor);
            container.add(fruit);

            const label = this.add.text(0, -18, cropIcon, { fontSize: "11px" }).setOrigin(0.5);
            container.add(label);
          }
        }
      }
      sprite = container;
    } else if (obj.assetId === "wood") {
      sprite = this.add.sprite(obj.x, obj.y, "wood");
      (sprite as Phaser.GameObjects.Sprite).play("wood_anim");
      sprite.setScale((obj.scaleX !== undefined ? obj.scaleX : 1) * 2, (obj.scaleY !== undefined ? obj.scaleY : 1) * 2);
      // Play wood animation with dynamic rate!
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("fish_point_")) {
      sprite = this.add.sprite(obj.x, obj.y, obj.assetId);
      (sprite as Phaser.GameObjects.Sprite).play(`${obj.assetId}_anim`);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("tree_water_2_")) {
      const idx = parseInt(obj.assetId.split("_")[3], 10);
      sprite = this.add.sprite(obj.x, obj.y, "tree_water_2");
      (sprite as Phaser.GameObjects.Sprite).play(`tree_water_2_anim_${idx}`);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("well_")) {
      const idx = parseInt(obj.assetId.split("_")[1], 10);
      sprite = this.add.sprite(obj.x, obj.y, "well");
      (sprite as Phaser.GameObjects.Sprite).play(`well_anim_${idx}`);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("fountain_")) {
      const idx = parseInt(obj.assetId.split("_")[1], 10);
      sprite = this.add.sprite(obj.x, obj.y, "fountain");
      (sprite as Phaser.GameObjects.Sprite).play(`fountain_anim_${idx}`);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && (
      obj.assetId.startsWith("house_") || 
      obj.assetId.startsWith("indoor_") ||
      obj.assetId.startsWith("decor2_") ||
      obj.assetId.startsWith("yon_") ||
      [
        'construction_area',
        'newsstand',
        'sawmill',
        'sharpening_station',
        'telephone',
        'workbench',
        'ice_cream_car',
        'water_box'
      ].includes(obj.assetId)
    )) {
      sprite = this.add.sprite(obj.x, obj.y, obj.assetId);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("maple_tree_")) {
      sprite = this.add.sprite(obj.x, obj.y, "maple_tree");
      const typeIndex = parseInt(obj.assetId.replace("maple_tree_", ""), 10) || 0;
      const state = obj.treeState || "grown";
      
      let currentRow = typeIndex;
      if (state === "stump") currentRow = 5;
      else if (state === "dry") currentRow = 6;
      else if (state === "sapling") currentRow = 0;
      else if (state === "grow_1") currentRow = 0;
      else if (state === "grow_2") currentRow = 1;

      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));

      if (obj.treeHitFlash) {
        // Reset the flag locally so we only trigger this once per hit event
        obj.treeHitFlash = false;
        
        (sprite as Phaser.GameObjects.Sprite).anims.stop();
        (sprite as Phaser.GameObjects.Sprite).setFrame(currentRow * 4 + 1);

        this.time.delayedCall(100, () => {
          if (sprite && sprite.active) {
            const latestState = obj.treeState || "grown";
            let latestRow = typeIndex;
            if (latestState === "stump") latestRow = 5;
            else if (latestState === "dry") latestRow = 6;
            else if (latestState === "sapling") latestRow = 0;
            else if (latestState === "grow_1") latestRow = 0;
            else if (latestState === "grow_2") latestRow = 1;

            (sprite as Phaser.GameObjects.Sprite).play(`maple_tree_row_${latestRow}`, true);
          }
        });
      } else {
        (sprite as Phaser.GameObjects.Sprite).play(`maple_tree_row_${currentRow}`);
        const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
        (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
      }
    } else if (obj.assetId && obj.assetId.startsWith("root_land_")) {
      const parts = obj.assetId.split("_");
      const color = parseInt(parts[2], 10) || 0;
      const stage = parseInt(parts[3], 10) || 0;
      sprite = this.add.sprite(obj.x, obj.y, "root_land", color * 3 + stage);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("root_water_")) {
      const parts = obj.assetId.split("_");
      const color = parseInt(parts[2], 10) || 0;
      const stage = parseInt(parts[3], 10) || 1;
      sprite = this.add.sprite(obj.x, obj.y, `root_water_${stage}`);
      (sprite as Phaser.GameObjects.Sprite).play(`root_water_anim_${color}_${stage}`);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (
      obj.assetId === "stones_small_anim" ||
      obj.assetId === "stones_large_anim" ||
      obj.assetId === "stones_anim" ||
      obj.assetId === "wood_boat_anim" ||
      obj.assetId === "wood_canoe_anim"
    ) {
      const assetId = obj.assetId === "stones_anim" ? "stones_small_anim" : obj.assetId;
      const textureKey = assetId.startsWith("stones_") ? "stones_anim" : assetId;
      sprite = this.add.sprite(obj.x, obj.y, textureKey);
      (sprite as Phaser.GameObjects.Sprite).play(assetId);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      const animFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = animFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("dekor_tree_")) {
      const frameIdx = parseInt(obj.assetId.replace("dekor_tree_", ""), 10) || 0;
      sprite = this.add.sprite(obj.x, obj.y, "dekor_tree", frameIdx);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("mineral_mine_")) {
      // Mine display using 16x16 mineral_sheet spritesheet
      // Row 2 (y=32), 11 cols. Frame = row*11 + col = 22 + col
      // Type -> col: 1=0(22), 2=1(23), 3=2(24), 4=4(26), 5=5(27), 6=6(28), 7=7(29), 8=8(30)
      // Hit flash = frame 32 (col 10, white), Depleted = no sprite shown
      const TYPE_TO_FRAME: { [k: number]: number } = { 1: 22, 2: 23, 3: 24, 4: 26, 5: 27, 6: 28, 7: 29, 8: 30 };
      const HIT_FRAME = 32;
      const typeIdx = parseInt(obj.assetId.replace("mineral_mine_", ""), 10) || 1;
      const state = obj.treeState || "grown";
      const isDepleted = state === "stump";

      if (!isDepleted) {
        const normalFrame = TYPE_TO_FRAME[typeIdx] ?? 22;
        const frameToShow = obj.treeHitFlash ? HIT_FRAME : normalFrame;

        sprite = this.add.sprite(obj.x, obj.y, "mineral_sheet", frameToShow);
        sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
        (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));

        if (obj.treeHitFlash) {
          obj.treeHitFlash = false;
          this.time.delayedCall(80, () => {
            if (sprite && sprite.active) {
              (sprite as Phaser.GameObjects.Sprite).setFrame(normalFrame);
            }
          });
        }
      } else {
        // Depleted: tiny invisible placeholder so the object still tracks
        sprite = this.add.rectangle(obj.x, obj.y, 1, 1, 0x000000, 0) as unknown as Phaser.GameObjects.Sprite;
      }
    } else if (obj.assetId && obj.assetId.startsWith("wf_")) {
      // Waterfall tile: wf_{theme}_{tileX}_{tileY}_{tileW}_{tileH}_{animated}
      const parts = obj.assetId.split("_");
      const theme = parts[1];
      const tx = parseInt(parts[2], 10);
      const ty = parseInt(parts[3], 10);
      const tw = parseInt(parts[4], 10);
      const th = parseInt(parts[5], 10);
      const animated = parts[6] === "1";
      const textureKey = `waterfall_${theme}`;

      // For animated water rows (y < 2), we animate between frame row y and y+4
      // by creating two texture frames and tweening between them
      const frameKey1 = `wf_${theme}_${tx}_${ty}_${tw}_${th}_f1`;
      const texture = this.textures.get(textureKey);
      if (texture && !texture.has(frameKey1)) {
        texture.add(frameKey1, 0, tx * tw, ty * th, tw, th);
      }

      sprite = this.add.sprite(obj.x, obj.y, textureKey, frameKey1);

      if (animated && ty < 2) {
        const frameKey2 = `wf_${theme}_${tx}_${ty + 4}_${tw}_${th}_f2`;
        if (texture && !texture.has(frameKey2)) {
          texture.add(frameKey2, 0, tx * tw, (ty + 4) * th, tw, th);
        }
        // Animate between frame1 and frame2 manually using a timer
        (sprite as any)._wfTimer = this.time.addEvent({
          delay: 250,
          loop: true,
          callback: () => {
            if (!sprite || !sprite.active) return;
            const s = sprite as Phaser.GameObjects.Sprite;
            if (s.frame.name === frameKey1) {
              s.setFrame(frameKey2);
            } else {
              s.setFrame(frameKey1);
            }
          }
        });
      }

      const baseScaleX = (16 / tw) * (obj.scaleX !== undefined ? obj.scaleX : 1);
      const baseScaleY = (16 / th) * (obj.scaleY !== undefined ? obj.scaleY : 1);
      sprite.setScale(baseScaleX, baseScaleY);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId === "zemin_tileset" && this.textures.exists("zemin_tileset")) {
      const frameKey = `tile_${obj.tileX}_${obj.tileY}_${obj.tileW}_${obj.tileH}`;
      const texture = this.textures.get("zemin_tileset");
      if (texture && !texture.has(frameKey)) {
        texture.add(frameKey, 0, obj.tileX, obj.tileY, obj.tileW, obj.tileH);
      }
      sprite = this.add.sprite(obj.x, obj.y, "zemin_tileset", frameKey);
      
      const baseScaleX = (32 / obj.tileW) * (obj.scaleX !== undefined ? obj.scaleX : 1);
      const baseScaleY = (32 / obj.tileH) * (obj.scaleY !== undefined ? obj.scaleY : 1);
      sprite.setScale(baseScaleX, baseScaleY);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("terrain_")) {
      // Generic terrain tile: terrain_{tilesetKey}_{col}_{row}_{tw}_{th}
      const parts = obj.assetId.split("_");
      const th2 = parseInt(parts[parts.length - 1], 10);
      const tw2 = parseInt(parts[parts.length - 2], 10);
      const row2 = parseInt(parts[parts.length - 3], 10);
      const col2 = parseInt(parts[parts.length - 4], 10);
      const texKey = parts.slice(0, parts.length - 4).join("_"); // e.g. "terrain_grass_summer"
      if (this.textures.exists(texKey)) {
        const fk = `${obj.assetId}_f`;
        const tex = this.textures.get(texKey);
        if (tex && !tex.has(fk)) tex.add(fk, 0, col2 * tw2, row2 * th2, tw2, th2);
        sprite = this.add.sprite(obj.x, obj.y, texKey, fk);
        sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
        (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      } else {
        sprite = this.add.rectangle(obj.x, obj.y, tw2 || 16, th2 || 16, 0x2f3542, 0.8) as unknown as Phaser.GameObjects.Sprite;
      }
    } else if (obj.assetId === "collision_block") {
      const editorConfig = (window as any).editorConfig;
      const isVisible = Boolean(editorConfig && editorConfig.active);
      sprite = this.add.rectangle(obj.x, obj.y, 32, 32, 0xff4757, 0.4);
      (sprite as Phaser.GameObjects.Rectangle).setStrokeStyle(1.5, 0xff4757, 1);
      sprite.setVisible(isVisible);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
    } else if (obj.assetId && obj.assetId.startsWith("spawn_")) {
      // Enemy spawner: transparent placeholder so no grey square appears under the goblin
      sprite = this.add.rectangle(obj.x, obj.y, 1, 1, 0x000000, 0) as unknown as Phaser.GameObjects.Sprite;
    } else {
      let color = 0x747d8c; // default gray
      if (obj.isSolid) {
        color = 0xff4757; // Solid is red
      } else if (obj.triggerType === "teleport") {
        color = 0x1e90ff; // Teleport triggers are blue
      }

      sprite = this.add.rectangle(obj.x, obj.y, 32, 32, color);
      sprite.setStrokeStyle(1, 0xffffff, 0.8);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
    }

    sprite.setAngle(obj.rotation || 0);

    // Apply Z-index depth layer — calculate subDepth for stacking
    const _tsMatch = (obj.id || "").match(/^obj_(\d+)_/);
    const _ts = _tsMatch ? Number(_tsMatch[1]) % 1000000 : 0;
    const _subDepth = _ts / 1000000000; // tiny fraction: 0 to 0.001

    // Check if object is a ground / terrain tile
    const isGroundTile = Boolean(
      obj.assetId && (
        obj.assetId.startsWith("terrain_") ||
        obj.assetId.startsWith("wf_") ||
        obj.assetId === "zemin_tileset" ||
        obj.assetId.startsWith("tilled_soil")
      )
    );

    // Ground tiles should always render in the "below" layer (depth ~1.1) unless explicitly "above" (for roofs/canopies)
    let effectiveLayer = obj.depthLayer || "below";
    if (isGroundTile && effectiveLayer === "same") {
      effectiveLayer = "below";
    }

    if (effectiveLayer === "below") {
      sprite.setDepth(1.1 + obj.y / 1000000 + _subDepth);
      this.belowPlayerGroup.add(sprite);
    } else if (effectiveLayer === "above") {
      sprite.setDepth(4 + _subDepth);
      this.abovePlayerGroup.add(sprite);
    } else {
      // same level - sorts by Y (matches player depth formula: 2.5 + y/10000)
      sprite.setDepth(2.5 + obj.y / 10000 + _subDepth);
      this.samePlayerGroup.add(sprite);
    }

    sprite.setInteractive({ useHandCursor: true });
    this.input.setDraggable(sprite);

    (sprite as any).objId = obj.id;
    (sprite as any).assetId = obj.assetId;
    (sprite as any).isSolid = obj.isSolid;
    (sprite as any).depthLayer = obj.depthLayer;
    (sprite as any).triggerType = obj.triggerType;

    // Set initial visibility based on active map
    const objMap = obj.mapId || "world_1";
    sprite.setVisible(objMap === this.currentMapId);
    (sprite as any).triggerTargetX = obj.triggerTargetX;
    (sprite as any).triggerTargetY = obj.triggerTargetY;
    (sprite as any).tileX = obj.tileX;
    (sprite as any).tileY = obj.tileY;
    (sprite as any).tileW = obj.tileW;
    (sprite as any).tileH = obj.tileH;
    (sprite as any).frameRate = obj.frameRate;
    (sprite as any).solidWidth = obj.solidWidth;
    (sprite as any).solidHeight = obj.solidHeight;
    (sprite as any).solidOffsetX = obj.solidOffsetX;
    (sprite as any).solidOffsetY = obj.solidOffsetY;

    this.placedObjectSprites.set(key, sprite);
  }

  private updatePlacedObject(obj: any, key: string): void {
    const sprite = this.placedObjectSprites.get(key);
    if (!sprite) return;

    if (obj.assetId === "tilled_soil_dry" || obj.assetId === "tilled_soil_wet") {
      this.createPlacedObject(obj, key);
      return;
    }

    sprite.setPosition(obj.x, obj.y);
    sprite.setAngle(obj.rotation || 0);

    if (obj.assetId === "wood") {
      sprite.setScale((obj.scaleX !== undefined ? obj.scaleX : 1) * 2, (obj.scaleY !== undefined ? obj.scaleY : 1) * 2);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("fish_point_")) {
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== `${obj.assetId}_anim`) {
        (sprite as Phaser.GameObjects.Sprite).play(`${obj.assetId}_anim`);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("tree_water_2_")) {
      const idx = parseInt(obj.assetId.split("_")[3], 10);
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== `tree_water_2_anim_${idx}`) {
        (sprite as Phaser.GameObjects.Sprite).play(`tree_water_2_anim_${idx}`);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("well_")) {
      const idx = parseInt(obj.assetId.split("_")[1], 10);
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== `well_anim_${idx}`) {
        (sprite as Phaser.GameObjects.Sprite).play(`well_anim_${idx}`);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && obj.assetId.startsWith("fountain_")) {
      const idx = parseInt(obj.assetId.split("_")[1], 10);
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== `fountain_anim_${idx}`) {
        (sprite as Phaser.GameObjects.Sprite).play(`fountain_anim_${idx}`);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (obj.assetId && (
      obj.assetId.startsWith("house_") || 
      obj.assetId.startsWith("indoor_") ||
      obj.assetId.startsWith("decor2_") ||
      obj.assetId.startsWith("yon_") ||
      [
        'construction_area',
        'newsstand',
        'sawmill',
        'sharpening_station',
        'telephone',
        'workbench',
        'ice_cream_car',
        'water_box'
      ].includes(obj.assetId)
    )) {
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("maple_tree_")) {
      const typeIndex = parseInt(obj.assetId.replace("maple_tree_", ""), 10) || 0;
      const state = obj.treeState || "grown";
      
      let currentRow = typeIndex;
      if (state === "stump") currentRow = 5;
      else if (state === "dry") currentRow = 6;
      else if (state === "sapling") currentRow = 0;
      else if (state === "grow_1") currentRow = 0;
      else if (state === "grow_2") currentRow = 1;

      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));

      if (obj.treeHitFlash) {
        // Reset the flag locally so we only trigger this once per hit event
        obj.treeHitFlash = false;
        
        (sprite as Phaser.GameObjects.Sprite).anims.stop();
        (sprite as Phaser.GameObjects.Sprite).setFrame(currentRow * 4 + 1);

        this.time.delayedCall(100, () => {
          if (sprite && sprite.active) {
            const latestState = obj.treeState || "grown";
            let latestRow = typeIndex;
            if (latestState === "stump") latestRow = 5;
            else if (latestState === "dry") latestRow = 6;
            else if (latestState === "sapling") latestRow = 0;
            else if (latestState === "grow_1") latestRow = 0;
            else if (latestState === "grow_2") latestRow = 1;

            (sprite as Phaser.GameObjects.Sprite).play(`maple_tree_row_${latestRow}`, true);
          }
        });
      } else {
        const animKey = `maple_tree_row_${currentRow}`;
        if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== animKey) {
          (sprite as Phaser.GameObjects.Sprite).play(animKey);
        }
        const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
        (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
      }
    } else if (obj.assetId && obj.assetId.startsWith("root_land_")) {
      const parts = obj.assetId.split("_");
      const color = parseInt(parts[2], 10) || 0;
      const stage = parseInt(parts[3], 10) || 0;
      (sprite as Phaser.GameObjects.Sprite).setFrame(color * 3 + stage);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("root_water_")) {
      const parts = obj.assetId.split("_");
      const color = parseInt(parts[2], 10) || 0;
      const stage = parseInt(parts[3], 10) || 1;
      const animKey = `root_water_anim_${color}_${stage}`;
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== animKey) {
        (sprite as Phaser.GameObjects.Sprite).play(animKey);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      const finalFPS = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = finalFPS / 6;
    } else if (
      obj.assetId === "stones_small_anim" ||
      obj.assetId === "stones_large_anim" ||
      obj.assetId === "stones_anim" ||
      obj.assetId === "wood_boat_anim" ||
      obj.assetId === "wood_canoe_anim"
    ) {
      const assetId = obj.assetId === "stones_anim" ? "stones_small_anim" : obj.assetId;
      if ((sprite as Phaser.GameObjects.Sprite).anims.currentAnim?.key !== assetId) {
        (sprite as Phaser.GameObjects.Sprite).play(assetId);
      }
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      const animFPS2 = obj.frameRate !== undefined ? obj.frameRate : 6;
      (sprite as Phaser.GameObjects.Sprite).anims.timeScale = animFPS2 / 6;
    } else if (obj.assetId && obj.assetId.startsWith("dekor_tree_")) {
      const frameIdx = parseInt(obj.assetId.replace("dekor_tree_", ""), 10) || 0;
      (sprite as Phaser.GameObjects.Sprite).setFrame(frameIdx);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("mineral_mine_")) {
      const TYPE_TO_FRAME: { [k: number]: number } = { 1: 22, 2: 23, 3: 24, 4: 26, 5: 27, 6: 28, 7: 29, 8: 30 };
      const HIT_FRAME = 32;
      const typeIdx = parseInt(obj.assetId.replace("mineral_mine_", ""), 10) || 1;
      const state = obj.treeState || "grown";
      const isDepleted = state === "stump";
      const normalFrame = TYPE_TO_FRAME[typeIdx] ?? 22;

      if (isDepleted) {
        // Hide sprite when depleted
        sprite.setVisible(false);
      } else {
        sprite.setVisible(true);
        const frameToShow = obj.treeHitFlash ? HIT_FRAME : normalFrame;
        (sprite as Phaser.GameObjects.Sprite).setTexture("mineral_sheet", frameToShow);
        sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
        (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));

        if (obj.treeHitFlash) {
          obj.treeHitFlash = false;
          this.time.delayedCall(80, () => {
            if (sprite && sprite.active) {
              (sprite as Phaser.GameObjects.Sprite).setTexture("mineral_sheet", normalFrame);
            }
          });
        }
      }
    } else if (obj.assetId && obj.assetId.startsWith("wf_")) {
      const parts = obj.assetId.split("_");
      const theme = parts[1];
      const tx = parseInt(parts[2], 10);
      const ty = parseInt(parts[3], 10);
      const tw = parseInt(parts[4], 10);
      const th = parseInt(parts[5], 10);
      const frameKey1 = `wf_${theme}_${tx}_${ty}_${tw}_${th}_f1`;
      const texture = this.textures.get(`waterfall_${theme}`);
      if (texture && !texture.has(frameKey1)) {
        texture.add(frameKey1, 0, tx * tw, ty * th, tw, th);
      }
      (sprite as Phaser.GameObjects.Sprite).setFrame(frameKey1);
      const baseScaleX = (16 / tw) * (obj.scaleX !== undefined ? obj.scaleX : 1);
      const baseScaleY = (16 / th) * (obj.scaleY !== undefined ? obj.scaleY : 1);
      sprite.setScale(baseScaleX, baseScaleY);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId === "zemin_tileset" && this.textures.exists("zemin_tileset")) {
      // Re-apply correct sub-frame just in case it was loaded with a different slice
      const frameKey = `tile_${obj.tileX}_${obj.tileY}_${obj.tileW}_${obj.tileH}`;
      const texture = this.textures.get("zemin_tileset");
      if (texture && !texture.has(frameKey)) {
        texture.add(frameKey, 0, obj.tileX, obj.tileY, obj.tileW, obj.tileH);
      }
      (sprite as Phaser.GameObjects.Sprite).setFrame(frameKey);

      const baseScaleX = (32 / obj.tileW) * (obj.scaleX !== undefined ? obj.scaleX : 1);
      const baseScaleY = (32 / obj.tileH) * (obj.scaleY !== undefined ? obj.scaleY : 1);
      sprite.setScale(baseScaleX, baseScaleY);
      (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
    } else if (obj.assetId && obj.assetId.startsWith("terrain_")) {
      const parts = obj.assetId.split("_");
      const th2 = parseInt(parts[parts.length - 1], 10);
      const tw2 = parseInt(parts[parts.length - 2], 10);
      const row2 = parseInt(parts[parts.length - 3], 10);
      const col2 = parseInt(parts[parts.length - 4], 10);
      const texKey = parts.slice(0, parts.length - 4).join("_");
      if (this.textures.exists(texKey)) {
        const fk = `${obj.assetId}_f`;
        const tex = this.textures.get(texKey);
        if (tex && !tex.has(fk)) tex.add(fk, 0, col2 * tw2, row2 * th2, tw2, th2);
        (sprite as Phaser.GameObjects.Sprite).setTexture(texKey, fk);
        sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
        (sprite as Phaser.GameObjects.Sprite).setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      }
    } else if (obj.assetId === "collision_block") {
      const editorConfig = (window as any).editorConfig;
      const isVisible = Boolean(editorConfig && editorConfig.active);
      sprite.setVisible(isVisible);
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
    } else if (obj.assetId && obj.assetId.startsWith("spawn_")) {
      sprite.setVisible(false);
    } else {
      sprite.setScale(obj.scaleX !== undefined ? obj.scaleX : 1, obj.scaleY !== undefined ? obj.scaleY : 1);
      let color = 0x747d8c;
      if (obj.isSolid) {
        color = 0xff4757;
      } else if (obj.triggerType === "teleport") {
        color = 0x1e90ff;
      }
      if (typeof (sprite as any).setFillStyle === "function") {
        (sprite as Phaser.GameObjects.Rectangle).setFillStyle(color);
      }
    }

    this.belowPlayerGroup.remove(sprite);
    this.samePlayerGroup.remove(sprite);
    this.abovePlayerGroup.remove(sprite);

    if (obj.depthLayer === "below") {
      sprite.setDepth(1.1);
      this.belowPlayerGroup.add(sprite);
    } else if (obj.depthLayer === "above") {
      sprite.setDepth(3);
      this.abovePlayerGroup.add(sprite);
    } else {
      sprite.setDepth(2 + obj.y / 10000);
      this.samePlayerGroup.add(sprite);
    }

    (sprite as any).isSolid = obj.isSolid;
    (sprite as any).depthLayer = obj.depthLayer;
    (sprite as any).triggerType = obj.triggerType;
    (sprite as any).triggerTargetX = obj.triggerTargetX;
    (sprite as any).triggerTargetY = obj.triggerTargetY;
    (sprite as any).tileX = obj.tileX;
    (sprite as any).tileY = obj.tileY;
    (sprite as any).tileW = obj.tileW;
    (sprite as any).tileH = obj.tileH;
    (sprite as any).frameRate = obj.frameRate;
    (sprite as any).solidWidth = obj.solidWidth;
    (sprite as any).solidHeight = obj.solidHeight;
    (sprite as any).solidOffsetX = obj.solidOffsetX;
    (sprite as any).solidOffsetY = obj.solidOffsetY;
  }

  private destroyPlacedObject(key: string): void {
    const sprite = this.placedObjectSprites.get(key);
    if (sprite) {
      this.belowPlayerGroup.remove(sprite);
      this.samePlayerGroup.remove(sprite);
      this.abovePlayerGroup.remove(sprite);

      if ((sprite as any).crystals) {
        (sprite as any).crystals.forEach((c: any) => {
          if (c && c.destroy) c.destroy();
        });
      }

      if ((sprite as any)._wfTimer) {
        (sprite as any)._wfTimer.remove();
        (sprite as any)._wfTimer = null;
      }

      sprite.destroy();
      this.placedObjectSprites.delete(key);
    }
  }

  private lastPlacedTime = 0;
private tryPlaceObjectAt(x: number, y: number): void {
    const now = Date.now();
    if (now - this.lastPlacedTime < 120) return;
    this.lastPlacedTime = now;

    const config = (window as any).editorConfig;
    if (!config || !config.selectedAsset) return;

    // ── Multi-tile terrain brush (from TerrainEditorPanel) ──────────────────
    if (config.terrainBrush) {
      const tb = config.terrainBrush;
      const { startCol, startRow, endCol, endRow, tileW, tileH, tilesetKey, animated } = tb;
      const scaleX = tb.tileScaleX ?? 1;
      const scaleY = tb.tileScaleY ?? 1;
      // Each tile step on map = native tile size * scale
      const stepX = tileW * scaleX;
      const stepY = tileH * scaleY;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const tileOffsetX = (col - startCol) * stepX;
          const tileOffsetY = (row - startRow) * stepY;
          const tileX = x + tileOffsetX;
          const tileY = y + tileOffsetY;

          // Build assetId for this specific tile in the grid
          let assetId: string;
          const isAnim = animated && row < 2 ? 1 : 0;
          if (tilesetKey && tilesetKey.startsWith("wf_")) {
            const theme = tilesetKey.replace("wf_", "");
            assetId = `wf_${theme}_${col}_${row}_${tileW}_${tileH}_${isAnim}`;
          } else {
            assetId = `terrain_${tilesetKey}_${col}_${row}_${tileW}_${tileH}`;
          }

          // Stack tiles: only skip if the exact same asset already exists here
          let skip = false;
          this.room.state.mapObjects.forEach((obj: any) => {
            const objMap = obj.mapId || "world_1";
            if (objMap !== this.currentMapId) return;

            if (Math.round(obj.x) === Math.round(tileX) &&
                Math.round(obj.y) === Math.round(tileY) &&
                obj.depthLayer === config.depthLayer &&
                obj.assetId === assetId) {
              skip = true;
            }
          });
          if (skip) continue;

          const objId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const objData = {
            id: objId,
            assetId,
            mapId: this.currentMapId,
            x: tileX,
            y: tileY,
            scaleX,
            scaleY,
            rotation: 0,
            flipX: false,
            flipY: false,
            isSolid: Boolean(config.brushIsSolid),
            isWater: Boolean(config.brushIsWater),
            isClimbable: Boolean(config.brushIsClimbable),
            depthLayer: config.depthLayer,
            triggerType: "none",
            triggerTargetX: 0,
            triggerTargetY: 0,
            tileX: col * tileW,
            tileY: row * tileH,
            tileW,
            tileH,
            frameRate: 6,
            solidWidth: 0,
            solidHeight: 0,
            solidOffsetX: 0,
            solidOffsetY: 0
          };

          window.dispatchEvent(new CustomEvent("editor_action_performed", {
            detail: { type: "place", id: objId, data: objData }
          }));
          this.room.send("place_object", objData);
        }
      }
      return;
    }

    // ── Single-tile placement (existing behaviour) ───────────────────────────
    // Stack tiles: only skip if the exact same asset already exists here
    let skip = false;
    const finalDepthLayer = (config.selectedAsset === "tilled_soil_dry" || config.selectedAsset === "tilled_soil_wet") ? "below" : config.depthLayer;
    this.room.state.mapObjects.forEach((obj: any) => {
      const objMap = obj.mapId || "world_1";
      if (objMap !== this.currentMapId) return;

      if (Math.round(obj.x) === Math.round(x) && Math.round(obj.y) === Math.round(y) && obj.depthLayer === finalDepthLayer) {
        if (obj.assetId === config.selectedAsset) {
          skip = true;
        }
      }
    });
    if (skip) return;

    // For terrain tiles, apply scale from grid size selection
    const isTerrain = config.selectedAsset && (config.selectedAsset.startsWith("terrain_") || config.selectedAsset.startsWith("wf_"));
    const scaleX = isTerrain ? (config.tileScaleX ?? 1) : 1;
    const scaleY = isTerrain ? (config.tileScaleY ?? 1) : 1;

    const objId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const objData = {
      id: objId,
      assetId: config.selectedAsset,
      mapId: this.currentMapId,
      x: x,
      y: y,
      scaleX: scaleX,
      scaleY: scaleY,
      rotation: 0,
      flipX: false,
      flipY: false,
      isSolid: config.selectedAsset === "collision_block" ? true : Boolean(config.brushIsSolid),
      isWater: Boolean(config.brushIsWater),
      isClimbable: Boolean(config.brushIsClimbable),
      depthLayer: finalDepthLayer,
      triggerType: "none",
      triggerTargetX: 0,
      triggerTargetY: 0,
      tileX: config.selectedTile ? config.selectedTile.x : -1,
      tileY: config.selectedTile ? config.selectedTile.y : -1,
      tileW: config.selectedTile ? config.selectedTile.w : 0,
      tileH: config.selectedTile ? config.selectedTile.h : 0,
      frameRate: 6,
      solidWidth: config.solidWidth !== undefined ? config.solidWidth : 0,
      solidHeight: config.solidHeight !== undefined ? config.solidHeight : 0,
      solidOffsetX: config.solidOffsetX !== undefined ? config.solidOffsetX : 0,
      solidOffsetY: config.solidOffsetY !== undefined ? config.solidOffsetY : 0
    };

    window.dispatchEvent(new CustomEvent("editor_action_performed", {
      detail: { type: "place", id: objId, data: objData }
    }));

    this.room.send("place_object", objData);
  }

  private selectObjectById(id: string): void {
    const obj = this.room.state.mapObjects.get(id);
    if (obj) {
      window.dispatchEvent(new CustomEvent("editor_object_selected", {
        detail: {
          id: obj.id,
          assetId: obj.assetId,
          x: obj.x,
          y: obj.y,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          rotation: obj.rotation,
          flipX: obj.flipX,
          flipY: obj.flipY,
          isSolid: obj.isSolid,
          isWater: obj.isWater,
          isClimbable: obj.isClimbable,
          depthLayer: obj.depthLayer,
          triggerType: obj.triggerType,
          triggerTargetX: obj.triggerTargetX,
          triggerTargetY: obj.triggerTargetY,
          tileX: obj.tileX,
          tileY: obj.tileY,
          tileW: obj.tileW,
          tileH: obj.tileH,
          frameRate: obj.frameRate,
          solidWidth: obj.solidWidth,
          solidHeight: obj.solidHeight,
          solidOffsetX: obj.solidOffsetX,
          solidOffsetY: obj.solidOffsetY
        }
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Enemy & Merchant Client Management
  // -------------------------------------------------------------------------
  private spawnEnemy(data: any, id: string): void {
    if (this.enemySprites.has(id)) return;

    const container = this.add.container(data.x, data.y);
    container.setDepth(2 + data.y / 10000);

    let initialTexture = "archer_goblin_idle";
    let scale = 1.8;

    if (data.type === "bomb_goblin") {
      initialTexture = "bomb_goblin_idle";
    } else if (data.type === "spear_goblin") {
      initialTexture = "spear_goblin_idle";
    } else if (data.type === "blue_enemy") {
      initialTexture = "blue_enemy_idle";
    } else if (data.type === "green_enemy") {
      initialTexture = "green_enemy_idle";
    } else if (data.type === "pink_myconid") {
      initialTexture = "pink_myconid_idle";
    } else if (data.type === "purple_myconid") {
      initialTexture = "purple_myconid_idle";
    } else if (data.type === "red_myconid") {
      initialTexture = "red_myconid_idle";
    } else if (data.type === "spike") {
      initialTexture = "spike_idle";
    } else if (data.type === "goblin_merchant") {
      initialTexture = "goblin_merchant";
      scale = 1.2;
    } else if (data.type && data.type.startsWith("animal_")) {
      initialTexture = data.type;
      const spawner = this.room.state.mapObjects.get(id.replace("enemy_", ""));
      scale = spawner ? spawner.scaleX : 1.0;
    }

    const sprite = this.add.sprite(0, 0, initialTexture, 0);
    sprite.setScale(scale);

    // HP Bar UI
    const hpBg = this.add.rectangle(0, -32, 36, 6, 0x000000, 0.6);
    hpBg.setStrokeStyle(1, 0xffffff, 0.4);

    const hpFill = this.add.rectangle(-17, -32, 34, 4, 0xff4757, 1);
    hpFill.setOrigin(0, 0.5);

    let displayName = "Okçu Goblin";
    let nameColor = "#ff4757";

    if (data.type === "bomb_goblin") {
      displayName = "Bombalı Goblin";
    } else if (data.type === "spear_goblin") {
      displayName = "Mızraklı Goblin";
    } else if (data.type === "blue_enemy") {
      displayName = "Mavi Canavar";
      nameColor = "#00d2d3";
    } else if (data.type === "green_enemy") {
      displayName = "Yeşil Canavar";
      nameColor = "#2ecc71";
    } else if (data.type === "pink_myconid") {
      displayName = "Pembe Canavar";
      nameColor = "#ff69b4";
    } else if (data.type === "purple_myconid") {
      displayName = "Mor Canavar";
      nameColor = "#9b59b6";
    } else if (data.type === "red_myconid") {
      displayName = "Kırmızı Canavar";
      nameColor = "#ff4757";
    } else if (data.type === "spike") {
      displayName = "Diken";
      nameColor = "#e67e22";
    } else if (data.type === "goblin_merchant") {
      displayName = "💰 Tüccar Goblin";
      nameColor = "#f1c40f";
      hpBg.setVisible(false);
      hpFill.setVisible(false);

      // Make merchant interactive on click
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        window.dispatchEvent(new CustomEvent("open_merchant_shop"));
      });
    } else if (data.type && data.type.startsWith("animal_")) {
      if (data.type === "animal_chicken_black_white") displayName = "🐔 Siyah-Beyaz Tavuk";
      else if (data.type === "animal_chicken_black") displayName = "🐔 Siyah Tavuk";
      else if (data.type === "animal_chicken_blonde_green") displayName = "🐔 Sarı-Yeşil Tavuk";
      else if (data.type === "animal_chicken_blonde") displayName = "🐔 Sarı Tavuk";
      else if (data.type === "animal_chicken_brown_black") displayName = "🐔 Kahve-Siyah Tavuk";
      else if (data.type === "animal_chicken_brown_white") displayName = "🐔 Kahverengi Tavuk";
      else if (data.type === "animal_chicken_evil") displayName = "😈 Hain Tavuk";
      else if (data.type === "animal_chicken_full") displayName = "🐔 Kızıl Tavuk";
      else if (data.type === "animal_chicken_green") displayName = "🐔 Yeşil Tavuk";
      else if (data.type === "animal_chicken_pink") displayName = "🐔 Pembe Tavuk";
      else if (data.type === "animal_chicken_red") displayName = "🐔 Kırmızı Tavuk";
      else if (data.type === "animal_chicken_universe") displayName = "🌌 Evrensel Tavuk";
      else if (data.type === "animal_chicken_white") displayName = "🐔 Beyaz Tavuk";
      else if (data.type === "animal_cow_black") displayName = "🐄 Siyah İnek";
      else if (data.type === "animal_cow_blonde") displayName = "🐄 Sarı İnek";
      else if (data.type === "animal_cow_brown") displayName = "🐄 Kahverengi İnek";
      else if (data.type === "animal_cow_pink") displayName = "🐄 Pembe İnek";
      else if (data.type === "animal_sheep_white") displayName = "🐑 Beyaz Koyun";
      else if (data.type === "animal_sheep_spotted") displayName = "🐑 Kıvırcık Koyun";
      else if (data.type === "animal_pig_baby_mud") displayName = "🐖 Çamurlu Yavru Domuz";
      else if (data.type === "animal_pig_baby") displayName = "🐖 Yavru Domuz";
      else if (data.type === "animal_pig_mud") displayName = "🐖 Çamurlu Domuz";
      else if (data.type === "animal_pig_pink") displayName = "🐖 Pembe Domuz";
      else displayName = data.type.replace("animal_", "Hayvan ");
      
      nameColor = "#2dcf8e";
      hpBg.setVisible(false);
      hpFill.setVisible(false);
    }

    const nameLabel = this.add.text(0, -42, displayName, {
      fontFamily: "'Press Start 2P'",
      fontSize: "7px",
      color: nameColor,
      resolution: 2
    });
    nameLabel.setOrigin(0.5, 0.5);

    container.add([sprite, hpBg, hpFill, nameLabel]);

    const enemyData: EnemySpriteData = {
      container,
      sprite,
      hpBg,
      hpFill,
      nameLabel,
      targetX: data.x,
      targetY: data.y,
      type: data.type
    };

    this.enemySprites.set(id, enemyData);
    this.updateEnemy(data, id);
  }

  private updateEnemy(data: any, id: string): void {
    const enemyData = this.enemySprites.get(id);
    if (!enemyData) return;

    enemyData.targetX = data.x;
    enemyData.targetY = data.y;

    enemyData.container.setPosition(data.x, data.y);
    enemyData.container.setDepth(2 + data.y / 10000);

    if (enemyData.type === "goblin_merchant") {
      enemyData.sprite.anims.stop();
      enemyData.sprite.setFrame(0);
      return;
    }

    if (enemyData.type && enemyData.type.startsWith("animal_")) {
      const spawner = this.room.state.mapObjects.get(id.replace("enemy_", ""));
      if (spawner) {
        const spawnerMap = spawner.mapId || "world_1";
        enemyData.container.setVisible(spawnerMap === this.currentMapId && data.action !== "dead");
        enemyData.sprite.setScale(spawner.scaleX, spawner.scaleY);
      }
    }

    // HP Bar calculation
    const maxHp = data.maxHp || (data.type === "spike" ? 150 : (data.type === "red_myconid" ? 250 : (data.type === "purple_myconid" ? 220 : (data.type === "pink_myconid" ? 200 : (data.type === "green_enemy" ? 180 : (data.type === "blue_enemy" ? 150 : (data.type === "spear_goblin" ? 120 : (data.type === "bomb_goblin" ? 100 : 80))))))));
    const hpRatio = Math.max(0, Math.min(1, (data.hp || 0) / maxHp));
    enemyData.hpFill.width = Math.round(34 * hpRatio);
    
    if (data.action === "dead") {
      enemyData.container.setVisible(false);
    } else if (data.action === "hidden") {
      enemyData.sprite.setVisible(false);
      enemyData.hpBg.setVisible(false);
      enemyData.hpFill.setVisible(false);
      enemyData.nameLabel.setVisible(false);
      enemyData.container.setVisible(true);
    } else {
      enemyData.container.setVisible(true);
      enemyData.sprite.setVisible(true);
      if (enemyData.type !== "goblin_merchant" && !enemyData.type.startsWith("animal_")) {
        enemyData.hpBg.setVisible(true);
        enemyData.hpFill.setVisible(true);
      }
      enemyData.nameLabel.setVisible(true);
    }

    // Hit Flash
    if (data.hitFlash) {
      enemyData.sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemyData.sprite && enemyData.sprite.active) {
          enemyData.sprite.clearTint();
        }
      });
    }

    // Play correct animation & direction flipping
    const dir = data.direction || "down";
    const act = data.action || "idle";
    const animKey = `${data.type}_${act}_${dir}`;

    if (dir === "left" && !enemyData.type.startsWith("animal_") && enemyData.type !== "blue_enemy" && enemyData.type !== "green_enemy" && enemyData.type !== "pink_myconid" && enemyData.type !== "purple_myconid" && enemyData.type !== "red_myconid") {
      enemyData.sprite.setFlipX(true);
    } else {
      enemyData.sprite.setFlipX(false);
    }

    // Spike Projectile Firing
    if (enemyData.type === "spike" && act === "attack") {
      const now = this.time.now;
      if (!enemyData.lastAttackTime || now - enemyData.lastAttackTime > 1200) {
        enemyData.lastAttackTime = now;

        // Find closest player to start position
        let closestPlayerSprite: any = null;
        let closestDist = Infinity;
        this.playerSprites.forEach((ps) => {
          const dx = ps.container.x - enemyData.container.x;
          const dy = ps.container.y - enemyData.container.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestPlayerSprite = ps;
          }
        });

        if (closestPlayerSprite) {
          this.fireSpikeProjectile(
            enemyData.container.x,
            enemyData.container.y - 12,
            closestPlayerSprite.container.x,
            closestPlayerSprite.container.y,
            dir
          );
        }
      }
    }

    if (this.anims.exists(animKey)) {
      if (enemyData.sprite.anims.currentAnim?.key !== animKey) {
        enemyData.sprite.play(animKey);
      }
    }
  }

  private fireSpikeProjectile(startX: number, startY: number, targetX: number, targetY: number, direction: string): void {
    const colors = ["yellow", "green", "pink", "pupple", "red"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const projectile = this.add.sprite(startX, startY, `spike_projectile_${color}`);
    projectile.setScale(1.5);
    projectile.setDepth(4);

    const dir = direction || "down";
    projectile.play(`spike_projectile_${color}_${dir}`);

    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      duration: 350,
      onComplete: () => {
        projectile.destroy();
      }
    });
  }

  private despawnEnemy(id: string): void {
    const enemyData = this.enemySprites.get(id);
    if (enemyData) {
      enemyData.container.destroy();
      this.enemySprites.delete(id);
    }
  }
}
