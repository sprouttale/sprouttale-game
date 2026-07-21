import { useState, useCallback, useEffect, useRef } from "react";
import { PhaserGame, type ConnectionStatus, type GameMeta } from "./game/PhaserGame";
import { CharacterSelect, type CharacterSelectData } from "./ui/CharacterSelect";
import { TerrainEditorPanel } from "./ui/TerrainEditorPanel";
import { Minimap } from "./ui/Minimap";
import { type Room } from "colyseus.js";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------
type AppPhase = "select" | "connecting" | "connected" | "error" | "disconnected";

interface HatItem {
  id:    string;
  name:  string;
  cost:  number;
}

const HATS_LIST: HatItem[] = [
  { id: "Beret",           name: "Beret",           cost: 80 },
  { id: "Chicken",         name: "Chicken Hat",     cost: 150 },
  { id: "Cook",            name: "Chef's Hat",      cost: 100 },
  { id: "Cow",             name: "Cow Hat",         cost: 120 },
  { id: "Deer",            name: "Deer Antlers",    cost: 130 },
  { id: "Farm",            name: "Farmer Hat",      cost: 90 },
  { id: "Frog",            name: "Frog Cap",        cost: 120 },
  { id: "Leprechaun",      name: "Leprechaun Hat",  cost: 200 },
  { id: "Pirate eyepatch", name: "Eye Patch",       cost: 60 },
  { id: "Pirate",          name: "Pirate Hat",      cost: 150 },
  { id: "Santa Hat",       name: "Santa Hat",       cost: 100 },
  { id: "Wizard",          name: "Wizard Hat",      cost: 250 },
];

export interface ToolItem {
  id:   string;
  name: string;
  icon: string;
  desc: string;
}

export const INVENTORY_TOOLS: ToolItem[] = [
  { id: "bug_net", name: "Catching Net", icon: "🕸️", desc: "Basic Bug Net" }
];

const TIER_MATERIALS = [
  "Wood", "Copper", "Iron", "Gold", "Platinum",
  "Crimson", "Frost", "Shadow", "Fairy", "Obsidian"
];

const TIER_PREFIXES = [
  "wood", "copper", "iron", "gold", "platinum",
  "crimson", "frost", "shadow", "fairy", "obsidian"
];

for (let i = 1; i <= 10; i++) {
  const mat = TIER_MATERIALS[i - 1];

  const prefix = TIER_PREFIXES[i - 1];
  const toolIcon = (type: string) => `/assets/tools/${prefix}_${type}.png`;

  INVENTORY_TOOLS.push({
    id: `pickaxe_${i}`,
    name: `${mat} Pickaxe`,
    icon: toolIcon("pickaxe") ?? "⛏️",
    desc: `Tier ${i} Mining Tool`
  });
  INVENTORY_TOOLS.push({
    id: `hoe_${i}`,
    name: `${mat} Hoe`,
    icon: toolIcon("hoe") ?? "🧑‍🌾",
    desc: `Tier ${i} Farming Tool`
  });
  INVENTORY_TOOLS.push({
    id: `axe_${i}`,
    name: `${mat} Axe`,
    icon: toolIcon("axe") ?? "🪓",
    desc: `Tier ${i} Chopping Tool`
  });
  INVENTORY_TOOLS.push({
    id: `sickle_${i}`,
    name: `${mat} Sickle`,
    icon: toolIcon("sickle") ?? "🌾",
    desc: `Tier ${i} Harvesting Tool`
  });
  INVENTORY_TOOLS.push({
    id: `shovel_${i}`,
    name: `${mat} Shovel`,
    icon: toolIcon("shovel") ?? "🥄",
    desc: `Tier ${i} Digging Tool`
  });
  INVENTORY_TOOLS.push({
    id: `watering_${i}`,
    name: `${mat} Watering Can`,
    icon: toolIcon("watering_can") ?? "🪣",
    desc: `Tier ${i} Watering Tool`
  });
  INVENTORY_TOOLS.push({
    id: `sword_${i}`,
    name: `${mat} Sword`,
    icon: toolIcon("sword") ?? "⚔️",
    desc: `Tier ${i} Combat Weapon`
  });
  INVENTORY_TOOLS.push({
    id: `archer_${i}`,
    name: `${mat} Bow`,
    icon: toolIcon("bow") ?? "🏹",
    desc: `Tier ${i} Ranged Weapon`
  });
  INVENTORY_TOOLS.push({
    id: `fishing_${i}`,
    name: `${mat} Fishing Rod`,
    icon: toolIcon("fishing_rod") ?? "🎣",
    desc: `Tier ${i} Fishing Rod`
  });
  INVENTORY_TOOLS.push({
    id: `staff_${i}`,
    name: `${mat} Staff`,
    icon: toolIcon("staff") ?? "🪄",
    desc: `Tier ${i} Mage Weapon`
  });
  INVENTORY_TOOLS.push({
    id: `arrow_${i}`,
    name: `${mat} Arrow`,
    icon: toolIcon("arrow") ?? "🏹",
    desc: `Tier ${i} Ranged Ammo`
  });
  INVENTORY_TOOLS.push({
    id: `helmet_${i}`,
    name: `${mat} Helmet`,
    icon: toolIcon("helmet") ?? "🪖",
    desc: `Tier ${i} Armor (+${10 * i} Max HP)`
  });
  INVENTORY_TOOLS.push({
    id: `chestplate_${i}`,
    name: `${mat} Chestplate`,
    icon: toolIcon("chestplate") ?? "🛡️",
    desc: `Tier ${i} Armor (+${15 * i} Max HP)`
  });
  INVENTORY_TOOLS.push({
    id: `leggings_${i}`,
    name: `${mat} Leggings`,
    icon: toolIcon("leggings") ?? "👖",
    desc: `Tier ${i} Armor (+${10 * i} Max HP)`
  });
  INVENTORY_TOOLS.push({
    id: `boots_${i}`,
    name: `${mat} Boots`,
    icon: toolIcon("boots") ?? "🥾",
    desc: `Tier ${i} Armor (+${5 * i} Max HP)`
  });
}

export function getToolDisplayName(toolId: string): string {
  if (toolId === "bug_net") return "🕸️ Catching Net";
  if (toolId.startsWith("pickaxe_")) {
    const tier = parseInt(toolId.replace("pickaxe_", ""), 10);
    return `⛏️ ${TIER_MATERIALS[tier - 1] || ""} Pickaxe`;
  }
  if (toolId.startsWith("hoe_")) {
    const tier = parseInt(toolId.replace("hoe_", ""), 10);
    return `🧑‍🌾 ${TIER_MATERIALS[tier - 1] || ""} Hoe`;
  }
  if (toolId.startsWith("axe_")) {
    const tier = parseInt(toolId.replace("axe_", ""), 10);
    return `🪓 ${TIER_MATERIALS[tier - 1] || ""} Axe`;
  }
  if (toolId.startsWith("sickle_")) {
    const tier = parseInt(toolId.replace("sickle_", ""), 10);
    return `🌾 ${TIER_MATERIALS[tier - 1] || ""} Sickle`;
  }
  if (toolId.startsWith("shovel_")) {
    const tier = parseInt(toolId.replace("shovel_", ""), 10);
    return `🥄 ${TIER_MATERIALS[tier - 1] || ""} Shovel`;
  }
  if (toolId.startsWith("watering_")) {
    const tier = parseInt(toolId.replace("watering_", ""), 10);
    return `🪣 ${TIER_MATERIALS[tier - 1] || ""} Watering Can`;
  }
  if (toolId.startsWith("sword_")) {
    const tier = parseInt(toolId.replace("sword_", ""), 10);
    return `⚔️ ${TIER_MATERIALS[tier - 1] || ""} Sword`;
  }
  if (toolId.startsWith("archer_")) {
    const tier = parseInt(toolId.replace("archer_", ""), 10);
    return `🏹 ${TIER_MATERIALS[tier - 1] || ""} Bow`;
  }
  if (toolId.startsWith("fishing_")) {
    const tier = parseInt(toolId.replace("fishing_", ""), 10);
    return `🎣 ${TIER_MATERIALS[tier - 1] || ""} Fishing Rod`;
  }
  if (toolId.startsWith("staff_")) {
    const tier = parseInt(toolId.replace("staff_", ""), 10);
    return `🪄 ${TIER_MATERIALS[tier - 1] || ""} Staff`;
  }
  if (toolId.startsWith("arrow_")) {
    const tier = parseInt(toolId.replace("arrow_", ""), 10);
    return `🏹 ${TIER_MATERIALS[tier - 1] || ""} Arrow`;
  }
  if (toolId.startsWith("helmet_")) {
    const tier = parseInt(toolId.replace("helmet_", ""), 10);
    return `🪖 ${TIER_MATERIALS[tier - 1] || ""} Helmet`;
  }
  if (toolId.startsWith("chestplate_")) {
    const tier = parseInt(toolId.replace("chestplate_", ""), 10);
    return `🛡️ ${TIER_MATERIALS[tier - 1] || ""} Chestplate`;
  }
  if (toolId.startsWith("leggings_")) {
    const tier = parseInt(toolId.replace("leggings_", ""), 10);
    return `👖 ${TIER_MATERIALS[tier - 1] || ""} Leggings`;
  }
  if (toolId.startsWith("boots_")) {
    const tier = parseInt(toolId.replace("boots_", ""), 10);
    return `🥾 ${TIER_MATERIALS[tier - 1] || ""} Boots`;
  }
  if (toolId === "carrying") {
    return "📦 Carried Cargo";
  }
  if (toolId.startsWith("horse")) {
    const variantNames = ["White Stallion", "Ebony Charger", "Chestnut Courser", "Dappled Gray", "Golden Palomino"];
    const variantId = parseInt(toolId.replace("horse_", ""), 10) || 1;
    return `🐎 ${variantNames[variantId - 1] || "Horse Mount"}`;
  }
  if (toolId.startsWith("bicycle")) {
    const color = toolId.replace("bicycle_", "");
    return `🚲 ${color} Cruiser`;
  }
  if (toolId.startsWith("bear")) {
    return "🐻 Grizzly Bear";
  }
  if (toolId.startsWith("broomstick")) {
    const variantNames = ["Nimble Broomstick", "Firebolt Broom", "Magic Star Sweeper"];
    const variantId = parseInt(toolId.replace("broomstick_", ""), 10) || 1;
    return `🧹 ${variantNames[variantId - 1] || "Broomstick Mount"}`;
  }
  return "None";
}

// ---------------------------------------------------------------------------
// HatPreview Component
// ---------------------------------------------------------------------------
function HatPreview({ hatId }: { hatId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = `/assets/hats/${hatId}.png`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      // Draw col 2, row 0 (64x64px cell, neutral pose)
      ctx.drawImage(
        img,
        2 * 64, 0, 64, 64, // source
        0, 0, canvas.width, canvas.height // dest
      );
    };
  }, [hatId]);

  return (
    <canvas 
      ref={canvasRef} 
      width={64} 
      height={64} 
      style={{ width: 64, height: 64, imageRendering: "pixelated", display: "block" }} 
    />
  );
}

const MOUNTS_LIST = [
  { id: 1, type: "horse" as const, name: "White Stallion", cost: 0, colorCode: "#ffffff", desc: "Classic white stallion. Fast and reliable." },
  { id: 2, type: "horse" as const, name: "Ebony Charger", cost: 100, colorCode: "#1e272e", desc: "Sleek black charger. Runs like the wind." },
  { id: 3, type: "horse" as const, name: "Chestnut Courser", cost: 150, colorCode: "#cd6133", desc: "Fiery chestnut courser. Full of energy." },
  { id: 4, type: "horse" as const, name: "Dappled Gray", cost: 200, colorCode: "#84817a", desc: "Elegant dappled gray. Strong endurance." },
  { id: 5, type: "horse" as const, name: "Golden Palomino", cost: 300, colorCode: "#fbc531", desc: "Regal golden palomino. Royal bloodline." },
  { id: 6, type: "bear" as const, name: "Grizzly Bear", cost: 450, colorCode: "#cd84f1", desc: "Mighty grizzly bear. Feared by all beasts." },
  { id: 1, type: "broomstick" as const, name: "Nimble Broomstick", cost: 200, colorCode: "#e1b12c", desc: "Nimble wizarding broomstick. Fast and flighty." },
  { id: 2, type: "broomstick" as const, name: "Firebolt Broom", cost: 350, colorCode: "#4cd137", desc: "Professional firebolt broom. Built for speed." },
  { id: 3, type: "broomstick" as const, name: "Magic Star Sweeper", cost: 500, colorCode: "#9c88ff", desc: "Regal magical star sweeper. Supreme flying." },
  { id: 1, type: "tractor" as const, name: "Mavi Traktör", cost: 0, colorCode: "#54a0ff", desc: "Güçlü motorlu tarla traktörü. Hızlı ve dayanıklı." }
];

const BICYCLES_LIST = [
  { color: "Red", name: "Red Cruiser", cost: 0, colorCode: "#ff4757", desc: "Classic red cruiser. Simple and fun." },
  { color: "Blue", name: "Blue Roadster", cost: 80, colorCode: "#54a0ff", desc: "Stylish blue roadster. Smooth riding." },
  { color: "Green", name: "Green Explorer", cost: 120, colorCode: "#1dd1a1", desc: "Sporty green explorer. Off-road capable." },
  { color: "Pink", name: "Pink Dreamer", cost: 180, colorCode: "#ff9ff3", desc: "Bright pink dreamer. Looks absolutely fabulous." },
  { color: "Orange", name: "Orange Bullet", cost: 240, colorCode: "#ff9f43", desc: "Rapid orange bullet. Built for speed." }
];

// ---------------------------------------------------------------------------
// HorsePreview Component
// ---------------------------------------------------------------------------
function HorsePreview({ variantId }: { variantId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = `/assets/horse/idle/horse/${variantId}.png`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      // Draw first cell (32x32) of the idle sheet
      ctx.drawImage(
        img,
        0, 0, 32, 32, // source
        0, 0, canvas.width, canvas.height // dest
      );
    };
  }, [variantId]);

  return (
    <canvas 
      ref={canvasRef} 
      width={32} 
      height={32} 
      style={{ width: 64, height: 64, imageRendering: "pixelated", display: "block" }} 
    />
  );
}

// ---------------------------------------------------------------------------
// BicyclePreview Component
// ---------------------------------------------------------------------------
function BicyclePreview({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = `/assets/bicycle/idle/Bicycle/${color}.png`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        0, 0, 32, 32, // source
        0, 0, canvas.width, canvas.height // dest
      );
    };
  }, [color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={32} 
      height={32} 
      style={{ width: 64, height: 64, imageRendering: "pixelated", display: "block" }} 
    />
  );
}

// ---------------------------------------------------------------------------
// BearPreview Component
// ---------------------------------------------------------------------------
function BearPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = "/assets/bear/idle/Bear/Brown.png";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        0, 0, 32, 32, // source
        0, 0, canvas.width, canvas.height // dest
      );
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      width={32} 
      height={32} 
      style={{ width: 64, height: 64, imageRendering: "pixelated", display: "block" }} 
    />
  );
}

// ---------------------------------------------------------------------------
// BroomstickPreview Component
// ---------------------------------------------------------------------------
function BroomstickPreview({ variantId }: { variantId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = `/assets/broomstick/Broomstick/${variantId}.png`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        0, 0, 32, 32, // source (first frame of sheet)
        0, 0, canvas.width, canvas.height // dest
      );
    };
  }, [variantId]);

  return (
    <canvas 
      ref={canvasRef} 
      width={32} 
      height={32} 
      style={{ width: 64, height: 64, imageRendering: "pixelated", display: "block" }} 
    />
  );
}

function TractorPreview() {
  return (
    <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <img 
        src="/assets/vehicles/Tractor_16x16.png" 
        style={{
          width: "288px",
          height: "240px",
          marginLeft: "-144px",
          marginTop: "0px",
          imageRendering: "pixelated",
          flexShrink: 0
        }}
        alt="Tractor Preview"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoReconnect Component — auto reloads after disconnect
// ---------------------------------------------------------------------------
function AutoReconnect({ phase }: { phase: string }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="error-screen" style={{ position: "fixed" }}>
      <h2>⚠ {phase === "error" ? "Bağlantı Hatası" : "Bağlantı Kesildi"}</h2>
      <p style={{ marginBottom: "12px" }}>
        {phase === "disconnected"
          ? "Sunucu yeniden başlatıldı. Otomatik bağlanıyor..."
          : "Sunucuya bağlanılamadı. Yeniden deneniyor..."}
      </p>
      <div style={{
        fontSize: "32px", fontFamily: "'Press Start 2P'",
        color: "#00b8d9", marginBottom: "16px"
      }}>
        {countdown}
      </div>
      <div style={{
        width: "200px", height: "4px", background: "rgba(255,255,255,0.1)",
        borderRadius: "2px", overflow: "hidden", marginBottom: "16px"
      }}>
        <div style={{
          width: `${(countdown / 5) * 100}%`, height: "100%",
          background: "#00b8d9", transition: "width 1s linear"
        }} />
      </div>
      <button onClick={() => window.location.reload()}
        style={{ fontSize: "10px", padding: "8px 20px" }}>
        HEMEN YENİDEN BAĞLAN
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------
export default function App() {
  const [phase,          setPhase]         = useState<AppPhase>("select");
  const [charData,       setChar]          = useState<CharacterSelectData | null>(null);
  const [meta,           setMeta]          = useState<GameMeta | null>(null);
  const [room,           setRoom]          = useState<Room | null>(null);
  const [playerHp,       setPlayerHp]      = useState<number>(100);
  const [playerMaxHp,    setPlayerMaxHp]   = useState<number>(100);
  const [isShopOpen,     setIsShopOpen]    = useState(false);
  const [shopTab,        setShopTab]       = useState<"hats" | "pets" | "farming">("hats");
  
  // Farming state synced authoritative data
  const [playerSeeds,    setPlayerSeeds]   = useState<Record<string, number>>({});
  const [playerHarvests, setPlayerHarvests] = useState<Record<string, number>>({});

  // Shop State (local simulation for the client)
  const [gold,           setGold]          = useState<number>(() => {
    const saved = localStorage.getItem("player_gold");
    return saved ? parseInt(saved, 10) : 600;
  });
  const [woodCount,      setWoodCount]     = useState<number>(() => {
    const saved = localStorage.getItem("player_wood_count");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [purchasedHats,  setPurchasedHats] = useState<string[]>([]);
  const [consoleErrors,  setConsoleErrors]  = useState<string[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isMerchantOpen,  setIsMerchantOpen]  = useState(false);
  const [hasGoblinDamageBoost, setHasGoblinDamageBoost] = useState(false);
  const [invTab,          setInvTab]          = useState<"pickaxe" | "axe" | "hoe" | "sickle" | "shovel" | "watering" | "sword" | "archer" | "bug_net" | "fishing" | "crops" | "staff" | "arrow" | "helmet" | "chestplate" | "leggings" | "boots">("pickaxe");
  const [isStableOpen,    setIsStableOpen]    = useState(false);
  const [purchasedHorses, setPurchasedHorses] = useState<number[]>([1]); // Starts with variant 1 (White Stallion)
  const [activeHorseVariant, setActiveHorseVariant] = useState<number>(1);
  const [activeMountType,    setActiveMountType]    = useState<"horse" | "bicycle" | "bear" | "broomstick" | "tractor">("horse");
  const [purchasedBicycles,  setPurchasedBicycles]  = useState<string[]>(["Red"]); // Starts with Red bicycle unlocked
  const [activeBicycleColor, setActiveBicycleColor] = useState<string>("Red");
  const [purchasedBears,     setPurchasedBears]     = useState<number[]>([]);
  const [purchasedBroomsticks, setPurchasedBroomsticks] = useState<number[]>([]);
  const [activeBroomstickVariant, setActiveBroomstickVariant] = useState<number>(1);
  const [purchasedTractors,  setPurchasedTractors]  = useState<number[]>([]);
  const [stableTab,          setStableTab]          = useState<"horses" | "bicycles">("horses");

  // Map Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMapEditorCollapsed, setIsMapEditorCollapsed] = useState(false);
  const [isTerrainEditorOpen, setIsTerrainEditorOpen] = useState(false);
  const [isAnimalEditorOpen, setIsAnimalEditorOpen] = useState(false);
  const [activeEditorTool, setActiveEditorTool] = useState<"brush" | "eraser" | "select" | "solid" | "pipette" | "fill_region">("brush");
  const [selectedPaletteAsset, setSelectedPaletteAsset] = useState<string>("test_block");
  const [editorCategory, setEditorCategory] = useState<"gif" | "dekorasyon" | "ev" | "zemin" | "indoor" | "tree" | "plant" | "mine" | "enemy" | "merchant" | "waterfall" | "box" | "trunks" | "big_old_tree" | "bushes" | "animal" | "decor2" | "yon">("gif");
  const [wfTheme, setWfTheme] = useState<"summer" | "deepforest" | "fall" | "spring">("summer");
  const [wfGridSize, setWfGridSize] = useState<16 | 32>(16);
  const [wfAnimated, setWfAnimated] = useState(true);
  const [wfSelectedTile, setWfSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [boxSelectedTile, setBoxSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [trunksSelectedTile, setTrunksSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [treeSelectedTile, setTreeSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [bushesSelectedTile, setBushesSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // const [tilesetGridSize, setTilesetGridSize] = useState<16 | 32 | 64>(32);
  const [editorGridSnap, setEditorGridSnap] = useState(true);
  const [editorDepthLayer, setEditorDepthLayer] = useState<"below" | "same" | "above">("same");
  const [brushIsSolid, setBrushIsSolid] = useState(false);
  const [brushIsWater, setBrushIsWater] = useState(false);
  const [brushIsClimbable, setBrushIsClimbable] = useState(false);
  const [editorSolidWidth, setEditorSolidWidth] = useState(0);
  const [editorSolidHeight, setEditorSolidHeight] = useState(0);
  const [editorSolidOffsetX, setEditorSolidOffsetX] = useState(0);
  const [editorSolidOffsetY, setEditorSolidOffsetY] = useState(0);
  const [pathDrawingTargetId, setPathDrawingTargetId] = useState<string | null>(null);
  const [tempPathPoints, setTempPathPoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedObject, setSelectedObject] = useState<any | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [copiedTileTemplate, setCopiedTileTemplate] = useState<any | null>(null);

  useEffect(() => {
    localStorage.setItem("player_gold", gold.toString());
  }, [gold]);

  useEffect(() => {
    localStorage.setItem("player_wood_count", woodCount.toString());
  }, [woodCount]);

  // ── Tool equips and use handlers ───────────────────────────────────────
  const handleEquipTool = useCallback((tool: string) => {
    if (room) {
      room.send("equip_tool", { tool });
    }
  }, [room]);

  const handleEquipArmor = useCallback((slot: string, itemId: string) => {
    if (room) {
      room.send("equip_armor", { slot, itemId });
    }
  }, [room]);

  const handleUseTool = useCallback(() => {
    if (room) {
      room.send("use_tool");
    }
  }, [room]);

  const handleTakeDamage = useCallback(() => {
    if (room) {
      room.send("take_damage");
    }
  }, [room]);

  const handleDie = useCallback(() => {
    if (room) {
      room.send("die");
    }
  }, [room]);

  const handleRespawn = useCallback(() => {
    if (room) {
      room.send("respawn");
    }
  }, [room]);

  // Synchronize Editor States with window.editorConfig
  useEffect(() => {
    (window as any).editorConfig = {
      active: isEditorOpen || isTerrainEditorOpen || isAnimalEditorOpen,
      tool: activeEditorTool,
      selectedAsset: selectedPaletteAsset,
      gridSnap: editorGridSnap,
      snapSize: (selectedPaletteAsset && selectedPaletteAsset.startsWith("wf_")) ? wfGridSize : 16,
      depthLayer: editorDepthLayer,
      selectedObjectId: selectedObject?.id || null,
      selectedTile: selectedTile,
      solidWidth: editorSolidWidth,
      solidHeight: editorSolidHeight,
      solidOffsetX: editorSolidOffsetX,
      solidOffsetY: editorSolidOffsetY,
      brushIsSolid: brushIsSolid,
      brushIsWater: brushIsWater,
      brushIsClimbable: brushIsClimbable,
      pathDrawingTargetId: pathDrawingTargetId,
      tempPathPoints: tempPathPoints,
      copiedTileTemplate: copiedTileTemplate
    };

    if (room) {
      room.send("editor_mode", { active: isEditorOpen || isTerrainEditorOpen || isAnimalEditorOpen });
    }
  }, [
    isEditorOpen, isTerrainEditorOpen, isAnimalEditorOpen, activeEditorTool, selectedPaletteAsset, editorGridSnap, editorDepthLayer,
    selectedObject, selectedTile, room, editorSolidWidth, editorSolidHeight,
    editorSolidOffsetX, editorSolidOffsetY, pathDrawingTargetId, tempPathPoints,
    brushIsSolid, brushIsWater, brushIsClimbable, copiedTileTemplate
  ]);

  // Handle selected object updates from Phaser
  useEffect(() => {
    const handleObjectSelected = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setSelectedObject(data);
    };

    window.addEventListener("editor_object_selected", handleObjectSelected);
    return () => {
      window.removeEventListener("editor_object_selected", handleObjectSelected);
    };
  }, []);

  // Handle action triggers from Phaser to record Undo/Redo history
  useEffect(() => {
    const handleAction = (e: Event) => {
      const action = (e as CustomEvent).detail;
      setUndoStack((prev: any[]) => [...prev, action]);
      setRedoStack([]); // Clear redo stack on new action
    };
    window.addEventListener("editor_action_performed", handleAction);
    return () => window.removeEventListener("editor_action_performed", handleAction);
  }, []);

  // Handle path drawing waypoint placement from Phaser
  useEffect(() => {
    const handlePointAdded = (e: Event) => {
      const pt = (e as CustomEvent).detail;
      setTempPathPoints((prev) => [...prev, pt]);
    };
    window.addEventListener("editor_path_point_added", handlePointAdded);
    return () => window.removeEventListener("editor_path_point_added", handlePointAdded);
  }, []);

  // Handle pipette clone triggers from Phaser
  useEffect(() => {
    const handlePipette = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setSelectedPaletteAsset(data.assetId);
      setEditorDepthLayer(data.depthLayer);
      
      if (data.solidWidth !== undefined) setEditorSolidWidth(data.solidWidth);
      if (data.solidHeight !== undefined) setEditorSolidHeight(data.solidHeight);
      if (data.solidOffsetX !== undefined) setEditorSolidOffsetX(data.solidOffsetX);
      if (data.solidOffsetY !== undefined) setEditorSolidOffsetY(data.solidOffsetY);

      if (data.assetId === "zemin_tileset") {
        setEditorCategory("zemin");
        setSelectedTile({ x: data.tileX, y: data.tileY, w: data.tileW, h: data.tileH });
        // setTilesetGridSize(data.tileW);
      } else if (data.assetId && data.assetId.startsWith("wf_")) {
        // Restore waterfall tile state from assetId: wf_{theme}_{col}_{row}_{tw}_{th}_{animated}
        const parts = data.assetId.split("_");
        const theme = parts[1] as "summer" | "deepforest" | "fall" | "spring";
        const col = parseInt(parts[2], 10);
        const row = parseInt(parts[3], 10);
        const tw = parseInt(parts[4], 10) as 16 | 32;
        const animated = parts[6] === "1";
        setEditorCategory("waterfall");
        setWfTheme(theme);
        setWfGridSize(tw);
        setWfAnimated(animated);
        setWfSelectedTile({ col, row });
        setSelectedTile({ x: col * tw, y: row * tw, w: tw, h: tw });
      } else if (data.assetId === "wood") {
        setEditorCategory("gif");
      }
      
      setActiveEditorTool("brush");
    };
    window.addEventListener("editor_pipette_cloned", handlePipette);
    return () => window.removeEventListener("editor_pipette_cloned", handlePipette);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !room) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    if (action.type === "place") {
      room.send("delete_object", { id: action.id });
    } else if (action.type === "delete") {
      room.send("place_object", { ...action.data });
    } else if (action.type === "update") {
      room.send("update_object", { id: action.id, ...action.oldData });
    }
  }, [undoStack, room]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !room) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    if (action.type === "place") {
      room.send("place_object", { ...action.data });
    } else if (action.type === "delete") {
      room.send("delete_object", { id: action.id });
    } else if (action.type === "update") {
      room.send("update_object", { id: action.id, ...action.newData });
    }
  }, [redoStack, room]);

  const handleSaveMap = useCallback(() => {
    if (!room) return;
    const objectsArray: any[] = [];
    room.state.mapObjects.forEach((obj: any) => {
      objectsArray.push({
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
        solidOffsetY: obj.solidOffsetY,
        treeState: obj.treeState,
        treeHp: obj.treeHp
      });
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objectsArray, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `map_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [room]);

  const handleLoadMap = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && room) {
            room.send("load_map", { objects: parsed });
          } else {
            alert("Invalid map file format!");
          }
        } catch (err) {
          alert("Error parsing map file!");
        }
      };
    }
  }, [room]);

  const handlePickUp = useCallback(() => {
    if (room) {
      room.send("pick_up");
    }
  }, [room]);

  const handleThrow = useCallback(() => {
    if (room) {
      room.send("throw");
    }
  }, [room]);

  const handleClimb = useCallback(() => {
    if (room) {
      room.send("climb");
    }
  }, [room]);

  const handleMountHorse = useCallback(() => {
    if (room) {
      if (activeMountType === "horse") {
        room.send("mount_horse", { variant: activeHorseVariant });
      } else if (activeMountType === "bicycle") {
        room.send("mount_bicycle", { color: activeBicycleColor });
      } else if (activeMountType === "bear") {
        room.send("mount_bear");
      } else if (activeMountType === "broomstick") {
        room.send("mount_broomstick", { variant: activeBroomstickVariant });
      } else if (activeMountType === "tractor") {
        room.send("mount_tractor");
      }
    }
  }, [room, activeMountType, activeHorseVariant, activeBicycleColor, activeBroomstickVariant]);

  const handleBuyHorse = useCallback((id: number, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedHorses(prev => [...prev, id]);
  }, [gold]);

  const handleEquipHorse = useCallback((id: number) => {
    setActiveHorseVariant(id);
    setActiveMountType("horse");
    if (room && meta?.mount?.startsWith("horse")) {
      room.send("mount_horse", { variant: id });
    } else if (room && meta?.mount?.startsWith("bicycle")) {
      room.send("mount_bicycle", { color: activeBicycleColor });
      room.send("mount_horse", { variant: id });
    } else if (room && meta?.mount?.startsWith("bear")) {
      room.send("mount_bear");
      room.send("mount_horse", { variant: id });
    } else if (room && meta?.mount?.startsWith("broomstick")) {
      room.send("mount_broomstick", { variant: activeBroomstickVariant });
      room.send("mount_horse", { variant: id });
    } else if (room && meta?.mount === "tractor") {
      room.send("mount_tractor");
      room.send("mount_horse", { variant: id });
    } else if (room) {
      room.send("mount_horse", { variant: id });
    }
  }, [room, meta, activeBicycleColor, activeBroomstickVariant]);

  const handleBuyBicycle = useCallback((color: string, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedBicycles(prev => [...prev, color]);
  }, [gold]);

  const handleEquipBicycle = useCallback((color: string) => {
    setActiveBicycleColor(color);
    setActiveMountType("bicycle");
    if (room && meta?.mount?.startsWith("bicycle")) {
      room.send("mount_bicycle", { color });
    } else if (room && meta?.mount?.startsWith("horse")) {
      room.send("mount_horse", { variant: activeHorseVariant });
      room.send("mount_bicycle", { color });
    } else if (room && meta?.mount?.startsWith("bear")) {
      room.send("mount_bear");
      room.send("mount_bicycle", { color });
    } else if (room && meta?.mount?.startsWith("broomstick")) {
      room.send("mount_broomstick", { variant: activeBroomstickVariant });
      room.send("mount_bicycle", { color });
    } else if (room && meta?.mount === "tractor") {
      room.send("mount_tractor");
      room.send("mount_bicycle", { color });
    } else if (room) {
      room.send("mount_bicycle", { color });
    }
  }, [room, meta, activeHorseVariant, activeBroomstickVariant]);

  const handleBuyBear = useCallback((id: number, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedBears(prev => [...prev, id]);
  }, [gold]);

  const handleEquipBear = useCallback(() => {
    setActiveMountType("bear");
    if (room && meta?.mount?.startsWith("bear")) {
      room.send("mount_bear");
    } else if (room && meta?.mount?.startsWith("horse")) {
      room.send("mount_horse", { variant: activeHorseVariant });
      room.send("mount_bear");
    } else if (room && meta?.mount?.startsWith("bicycle")) {
      room.send("mount_bicycle", { color: activeBicycleColor });
      room.send("mount_bear");
    } else if (room && meta?.mount?.startsWith("broomstick")) {
      room.send("mount_broomstick", { variant: activeBroomstickVariant });
      room.send("mount_bear");
    } else if (room && meta?.mount === "tractor") {
      room.send("mount_tractor");
      room.send("mount_bear");
    } else if (room) {
      room.send("mount_bear");
    }
  }, [room, meta, activeHorseVariant, activeBicycleColor, activeBroomstickVariant]);

  const handleBuyBroomstick = useCallback((id: number, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedBroomsticks(prev => [...prev, id]);
  }, [gold]);

  const handleEquipBroomstick = useCallback((id: number) => {
    setActiveBroomstickVariant(id);
    setActiveMountType("broomstick");
    if (room && meta?.mount?.startsWith("broomstick")) {
      room.send("mount_broomstick", { variant: id });
    } else if (room && meta?.mount?.startsWith("horse")) {
      room.send("mount_horse", { variant: activeHorseVariant });
      room.send("mount_broomstick", { variant: id });
    } else if (room && meta?.mount?.startsWith("bicycle")) {
      room.send("mount_bicycle", { color: activeBicycleColor });
      room.send("mount_broomstick", { variant: id });
    } else if (room && meta?.mount?.startsWith("bear")) {
      room.send("mount_bear");
      room.send("mount_broomstick", { variant: id });
    } else if (room && meta?.mount === "tractor") {
      room.send("mount_tractor");
      room.send("mount_broomstick", { variant: id });
    } else if (room) {
      room.send("mount_broomstick", { variant: id });
    }
  }, [room, meta, activeHorseVariant, activeBicycleColor, activeBroomstickVariant]);

  const handleBuyTractor = useCallback((id: number, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedTractors(prev => [...prev, id]);
  }, [gold]);

  const handleEquipTractor = useCallback(() => {
    setActiveMountType("tractor");
    if (room && meta?.mount === "tractor") {
      room.send("mount_tractor");
    } else if (room && meta?.mount?.startsWith("horse")) {
      room.send("mount_horse", { variant: activeHorseVariant });
      room.send("mount_tractor");
    } else if (room && meta?.mount?.startsWith("bicycle")) {
      room.send("mount_bicycle", { color: activeBicycleColor });
      room.send("mount_tractor");
    } else if (room && meta?.mount?.startsWith("broomstick")) {
      room.send("mount_broomstick", { variant: activeBroomstickVariant });
      room.send("mount_tractor");
    } else if (room && meta?.mount?.startsWith("bear")) {
      room.send("mount_bear");
      room.send("mount_tractor");
    } else if (room) {
      room.send("mount_tractor");
    }
  }, [room, meta, activeHorseVariant, activeBicycleColor, activeBroomstickVariant]);

  const handleDive = useCallback(() => {
    if (!room) return;
    room.send("dive");
  }, [room]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        // Global Edit Shortcuts
        if (e.ctrlKey && e.code === "KeyZ") {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (e.ctrlKey && e.code === "KeyY") {
          e.preventDefault();
          handleRedo();
          return;
        }

        if (e.code === "KeyH" && !isEditorOpen) {
          e.preventDefault();
          setIsAnimalEditorOpen(prev => {
            const next = !prev;
            if (next) {
              setIsTerrainEditorOpen(false);
            }
            return next;
          });
          return;
        }

        if (e.code === "KeyT" && !isEditorOpen) {
          e.preventDefault();
          setIsTerrainEditorOpen(prev => !prev);
          return;
        }

        if (isEditorOpen) {
          if (e.code === "KeyP") {
            e.preventDefault();
            setActiveEditorTool("brush");
          } else if (e.code === "KeyE") {
            e.preventDefault();
            setActiveEditorTool("eraser");
          } else if (e.code === "KeyS") {
            e.preventDefault();
            setActiveEditorTool("select");
          } else if (e.code === "KeyC") {
            e.preventDefault();
            setActiveEditorTool("solid");
          } else if (e.code === "KeyD") {
            e.preventDefault();
            setActiveEditorTool("pipette");
          } else if (e.code === "KeyF") {
            e.preventDefault();
            setActiveEditorTool("fill_region");
          }
        } else {
          // Normal game controls
          if (e.code === "Space") {
            e.preventDefault();
            handleUseTool();
          } else if (e.code === "KeyH") {
            e.preventDefault();
            handleTakeDamage();
          } else if (e.code === "KeyK") {
            e.preventDefault();
            handleDie();
          } else if (e.code === "KeyU") {
            e.preventDefault();
            handlePickUp();
          } else if (e.code === "KeyI") {
            e.preventDefault();
            handleThrow();
          } else if (e.code === "KeyM") {
            e.preventDefault();
            handleMountHorse();
          } else if (e.code === "KeyC") {
            e.preventDefault();
            handleClimb();
          } else if (e.code === "KeyV") {
            e.preventDefault();
            handleDive();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUseTool, handleTakeDamage, handleDie, handlePickUp, handleThrow, handleMountHorse, handleClimb, handleDive, isEditorOpen, isTerrainEditorOpen, isAnimalEditorOpen, handleUndo, handleRedo]);

  useEffect(() => {
    const handleMerchantOpen = () => {
      setIsMerchantOpen(true);
    };
    window.addEventListener("open_merchant_shop", handleMerchantOpen);

    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args) => {
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
      setConsoleErrors(prev => [...prev, "[ERROR] " + msg].slice(-10));
      originalError.apply(console, args);
    };
    console.warn = (...args) => {
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
      setConsoleErrors(prev => [...prev, "[WARN] " + msg].slice(-10));
      originalWarn.apply(console, args);
    };
    return () => {
      window.removeEventListener("open_merchant_shop", handleMerchantOpen);
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // ── CharacterSelect confirm handler ─────────────────────────────────────
  const handleCharConfirm = useCallback((data: CharacterSelectData) => {
    setChar(data);
    setPhase("connecting");
  }, []);

  // ── Colyseus status callback (memoized) ─────────────────────────────────
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setPhase(status as AppPhase);
  }, []);

  // ── Meta callback (player count, color, name, equippedHat) ────────────────
  const handleMetaChange = useCallback((m: GameMeta | null) => setMeta(m), []);

  // ── Room Join Callback ──────────────────────────────────────────────────
  const handleRoomJoin = useCallback((r: Room) => {
    setRoom(r);
  }, []);

  useEffect(() => {
    if (!room) return;

    const handleFishCaught = (message: { gold: number }) => {
      setGold(prev => prev + message.gold);
      
      const toast = document.createElement("div");
      toast.className = "fish-toast glass";
      toast.innerText = `🎣 Caught a fish! +${message.gold} Gold`;
      toast.style.position = "fixed";
      toast.style.top = "80px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "rgba(46, 204, 113, 0.9)";
      toast.style.border = "2px solid #2ecc71";
      toast.style.color = "white";
      toast.style.padding = "10px 20px";
      toast.style.borderRadius = "8px";
      toast.style.fontFamily = "'Press Start 2P'";
      toast.style.fontSize = "10px";
      toast.style.zIndex = "9999";
      toast.style.boxShadow = "0 4px 10px rgba(46, 204, 113, 0.4)";
      toast.style.pointerEvents = "none";
      toast.style.animation = "slideDownFade 3s forwards";
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleWoodCut = (message: { gold: number; item: string; message: string }) => {
      setGold(prev => prev + message.gold);
      setWoodCount(prev => prev + 1);
      
      const toast = document.createElement("div");
      toast.className = "fish-toast glass";
      
      let text = `🪓 Akçaağaç kestiniz! +1 Odun ve +${message.gold} Altın elde edildi!`;
      if (message.message === "kutuk") {
        text = `🪓 Akçaağaç kesildi ve kütüğe dönüştü! +1 Odun ve +${message.gold} Altın!`;
      }
      
      toast.innerText = text;
      toast.style.position = "fixed";
      toast.style.top = "80px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "rgba(230, 126, 34, 0.9)";
      toast.style.border = "2px solid #e67e22";
      toast.style.color = "white";
      toast.style.padding = "10px 20px";
      toast.style.borderRadius = "8px";
      toast.style.fontFamily = "'Press Start 2P'";
      toast.style.fontSize = "10px";
      toast.style.zIndex = "9999";
      toast.style.boxShadow = "0 4px 10px rgba(230, 126, 34, 0.4)";
      toast.style.pointerEvents = "none";
      toast.style.animation = "slideDownFade 3s forwards";
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleMineMined = (message: { gold: number; item: string }) => {
      setGold(prev => prev + message.gold);
      
      const toast = document.createElement("div");
      toast.className = "fish-toast glass";
      toast.innerText = `⛏️ ${message.item} kazıldı! +${message.gold} Altın elde edildi!`;
      toast.style.position = "fixed";
      toast.style.top = "80px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "rgba(52, 152, 219, 0.9)";
      toast.style.border = "2px solid #3498db";
      toast.style.color = "white";
      toast.style.padding = "10px 20px";
      toast.style.borderRadius = "8px";
      toast.style.fontFamily = "'Press Start 2P'";
      toast.style.fontSize = "10px";
      toast.style.zIndex = "9999";
      toast.style.boxShadow = "0 4px 10px rgba(52, 152, 219, 0.4)";
      toast.style.pointerEvents = "none";
      toast.style.animation = "slideDownFade 3s forwards";
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleEnemyKilled = (message: { gold: number; type: string }) => {
      setGold(prev => prev + message.gold);
      
      const toast = document.createElement("div");
      toast.className = "fish-toast glass";
      toast.innerText = `⚔️ Düşman yenildi! +${message.gold} Altın kazandın!`;
      toast.style.position = "fixed";
      toast.style.top = "80px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "rgba(231, 76, 60, 0.9)";
      toast.style.border = "2px solid #e74c3c";
      toast.style.color = "white";
      toast.style.padding = "10px 20px";
      toast.style.borderRadius = "8px";
      toast.style.fontFamily = "'Press Start 2P'";
      toast.style.fontSize = "10px";
      toast.style.zIndex = "9999";
      toast.style.boxShadow = "0 4px 10px rgba(231, 76, 60, 0.4)";
      toast.style.pointerEvents = "none";
      toast.style.animation = "slideDownFade 3s forwards";
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleGoldChange = (msg: { change: number }) => {
      setGold(prev => prev + msg.change);
      const toast = document.createElement("div");
      toast.className = "error-toast";
      toast.innerText = `💰 +${msg.change} Altın!`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleHarvested = (msg: { item: string, quantity: number }) => {
      const toast = document.createElement("div");
      toast.className = "error-toast";
      toast.innerText = `🌾 +${msg.quantity} adet ${msg.item.toUpperCase()} hasat edildi!`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const handleSeedPlanted = () => {
      const toast = document.createElement("div");
      toast.className = "error-toast";
      toast.innerText = `🌱 Tohum ekildi!`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    };

    const listener = room.onMessage("fish_caught", handleFishCaught);
    const woodListener = room.onMessage("wood_cut", handleWoodCut);
    const mineListener = room.onMessage("mine_mined", handleMineMined);
    const enemyListener = room.onMessage("enemy_killed", handleEnemyKilled);
    const goldChangeListener = room.onMessage("gold_change", handleGoldChange);
    const harvestedListener = room.onMessage("harvested", handleHarvested);
    const seedPlantedListener = room.onMessage("seed_planted", handleSeedPlanted);

    // Track local player HP and inventories from state
    room.state.players.onAdd((player: any, sessionId: string) => {
      if (sessionId === room.sessionId) {
        setPlayerHp(player.hp ?? 100);
        setPlayerMaxHp(player.maxHp ?? 100);
        
        const updateFarmingInventory = () => {
          const seedsObj: Record<string, number> = {};
          player.seeds.forEach((val: number, key: string) => {
            seedsObj[key] = val;
          });
          setPlayerSeeds(seedsObj);

          const harvestsObj: Record<string, number> = {};
          player.harvests.forEach((val: number, key: string) => {
            harvestsObj[key] = val;
          });
          setPlayerHarvests(harvestsObj);
        };

        updateFarmingInventory();

        player.onChange(() => {
          setPlayerHp(player.hp ?? 100);
          setPlayerMaxHp(player.maxHp ?? 100);
        });

        player.seeds.onAdd(() => updateFarmingInventory());
        player.seeds.onChange(() => updateFarmingInventory());

        player.harvests.onAdd(() => updateFarmingInventory());
        player.harvests.onChange(() => updateFarmingInventory());
      }
    });

    return () => {
      listener.clear();
      woodListener.clear();
      mineListener.clear();
      enemyListener.clear();
      goldChangeListener.clear();
      harvestedListener.clear();
      seedPlantedListener.clear();
    };
  }, [room]);

  // ── Buy Hat Action ──────────────────────────────────────────────────────
  const handleBuyHat = useCallback((hatId: string, cost: number) => {
    if (gold < cost) return;
    setGold(prev => prev - cost);
    setPurchasedHats(prev => [...prev, hatId]);
  }, [gold]);

  // ── Equip Hat Action ────────────────────────────────────────────────────
  const handleEquipHat = useCallback((hatId: string) => {
    if (!room) return;
    const currentEquipped = meta?.equippedHat ?? "";
    const isEquipped = currentEquipped === hatId;
    
    // Toggle equipped hat: send selected hat ID or empty string to unequip
    room.send("equip_hat", { hat: isEquipped ? "" : hatId });
  }, [room, meta]);

  // ── Farming Actions ─────────────────────────────────────────────────────
  const handleBuySeed = useCallback((seedType: string, price: number) => {
    if (gold < price) return;
    setGold(prev => prev - price);
    if (room) room.send("buy_seed", { seedType, quantity: 1 });
  }, [gold, room]);

  const handleSellHarvest = useCallback((cropType: string, price: number) => {
    const qty = playerHarvests[cropType] || 0;
    if (qty <= 0) return;
    if (room) room.send("sell_harvest", { cropType, quantity: 1, price });
  }, [playerHarvests, room]);

  // ── Render ────────────────────────────────--------------------------------
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* ── 1. Character Selection ── */}
      {phase === "select" && (
        <CharacterSelect onConfirm={handleCharConfirm} />
      )}

      {/* ── Game canvas ── */}
      {phase !== "select" && (
        <PhaserGame
          onStatusChange={handleStatusChange}
          onMetaChange={handleMetaChange}
          onRoomJoin={handleRoomJoin}
          characterData={charData}
        />
      )}

      {/* ── 2. Loading overlay ── */}
      {phase === "connecting" && (
        <div className="loading-screen" style={{ position: "fixed" }}>
          <span className="logo">⚔ MMORPG</span>
          <div className="spinner" aria-label="Connecting to server" />
          <span className="status">ENTERING THE WORLD...</span>
        </div>
      )}

      {/* ── 3. Error / Disconnected overlay ── */}
      {(phase === "error" || phase === "disconnected") && (
        <AutoReconnect phase={phase} />
      )}

      {/* ── 4. HUD ── */}
      {phase === "connected" && (
        <div className="hud" role="complementary" aria-label="Game HUD">

          {/* Top-left: player info */}
          {meta && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="hud__player-info glass" id="hud-player-info" style={{ marginBottom: 0 }}>
                <div className="hud__player-name">
                  <span
                    className="hud__player-color-swatch"
                    style={{ backgroundColor: meta.playerColor, color: meta.playerColor }}
                  />
                  {meta.playerName}
                </div>
                {/* Health Bar (HP) */}
                <div style={{ marginTop: "6px", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7.5px", marginBottom: "3px", color: "#ff4757", fontFamily: "'Press Start 2P'" }}>
                    <span>❤️ CAN:</span>
                    <span>{playerHp}/{playerMaxHp}</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "rgba(0,0,0,0.5)", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <div 
                      style={{ 
                        width: `${Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100))}%`, 
                        height: "100%", 
                        background: "linear-gradient(90deg, #ff4757, #ff6b81)", 
                        transition: "width 0.3s ease" 
                      }} 
                    />
                  </div>
                </div>
                <div className="hud__coords" style={{ marginTop: "4px" }}>
                  ID: {meta.sessionId.substring(0, 8)}...
                </div>
              </div>

              {/* Backpack Wood & Gold Widget */}
              <div 
                className="glass" 
                style={{
                  width: "160px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontFamily: "'Press Start 2P'",
                  color: "white",
                  fontSize: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#eccc68", fontWeight: "bold" }}>
                  <span>🎒 ÇANTA</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a4b0be" }}>🪵 ODUN:</span>
                  <span style={{ color: "#2ecc71", fontSize: "9px", fontWeight: "bold" }}>{woodCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a4b0be" }}>💰 ALTIN:</span>
                  <span style={{ color: "#f1c40f", fontSize: "9px", fontWeight: "bold" }}>{gold}G</span>
                </div>
                {hasGoblinDamageBoost && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#2ed573", fontSize: "7px", marginTop: "2px", background: "rgba(46, 213, 115, 0.15)", padding: "3px 4px", borderRadius: "3px", border: "1px solid rgba(46, 213, 115, 0.4)" }}>
                    <span>🧪 HASAR:</span>
                    <span style={{ fontWeight: "bold" }}>+%10 BUFF</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top-right action buttons (positioned cleanly to the left of the Minimap) */}
          <div className="hud__top-right-group" style={{ right: "230px", top: "12px" }}>
            {/* Inventory Button */}
            <button className="hud__inventory-btn glass" onClick={() => setIsInventoryOpen(prev => !prev)}>
              <span className="hud__inventory-icon">🎒</span>
              <span>INVENTORY</span>
            </button>

            {/* Shop Button */}
            <button className="hud__shop-btn glass" onClick={() => setIsShopOpen(prev => !prev)}>
              <span className="hud__shop-icon">🛒</span>
              <span>SHOP</span>
            </button>

            {/* Stable Button */}
            <button className="hud__shop-btn glass" style={{ borderColor: "#b79052", color: "#eccc68" }} onClick={() => setIsStableOpen(prev => !prev)}>
              <span className="hud__shop-icon">🐎</span>
              <span>STABLE</span>
            </button>
          </div>

          {/* Minimap Widget (Anchored top-right corner) */}
          <Minimap
            room={room}
            sessionId={meta?.sessionId || ""}
            worldWidth={5000}
            worldHeight={5000}
            playerCount={meta?.playerCount || 1}
          />

          {/* Bottom-center: controls hint */}
          <div className="hud__controls glass" id="hud-controls">
            Move:
            <span className="hud__key">W</span>
            <span className="hud__key">A</span>
            <span className="hud__key">S</span>
            <span className="hud__key">D</span>
            &nbsp;/&nbsp;
            <span className="hud__key">↑</span>
            <span className="hud__key">←</span>
            <span className="hud__key">↓</span>
            <span className="hud__key">→</span>
            &nbsp;|&nbsp; Run: <span className="hud__key" style={{ width: "auto", padding: "0 6px" }}>SHIFT</span>
            &nbsp;|&nbsp; Hit: <span className="hud__key">H</span>
            <button 
              onClick={handleTakeDamage}
              style={{
                marginLeft: "8px",
                background: "#ff4757",
                border: "none",
                color: "white",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              💥 HIT
            </button>
            &nbsp;|&nbsp; Die: <span className="hud__key">K</span>
            <button 
              onClick={handleDie}
              style={{
                marginLeft: "8px",
                background: "#3d3d3d",
                border: "1px solid #ff4757",
                color: "#ff4757",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              💀 DIE
            </button>
            &nbsp;|&nbsp; Pick: <span className="hud__key">U</span>
            <button 
              onClick={handlePickUp}
              style={{
                marginLeft: "8px",
                background: "#2d6a4f",
                border: "1px solid #52b788",
                color: "#52b788",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              📦 PICK UP
            </button>
            &nbsp;|&nbsp; Ride: <span className="hud__key">M</span>
            <button 
              onClick={handleMountHorse}
              style={{
                marginLeft: "8px",
                background: activeMountType === "broomstick" ? "#2c3e50" : activeMountType === "bear" ? "#4a154b" : activeMountType === "bicycle" ? "#1e3799" : "#4d3d24",
                border: activeMountType === "broomstick" ? "1px solid #e1b12c" : activeMountType === "bear" ? "1px solid #cd84f1" : activeMountType === "bicycle" ? "1px solid #82ccdd" : "1px solid #b79052",
                color: activeMountType === "broomstick" ? "#e1b12c" : activeMountType === "bear" ? "#cd84f1" : activeMountType === "bicycle" ? "#82ccdd" : "#b79052",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              {activeMountType === "broomstick" ? "🧹 FLY" : activeMountType === "bear" ? "🐻 RIDE" : activeMountType === "bicycle" ? "🚲 RIDE" : "🐎 MOUNT"}
            </button>
            &nbsp;|&nbsp; Climb: <span className="hud__key">C</span>
            <button 
              onClick={handleClimb}
              style={{
                marginLeft: "8px",
                background: meta?.action === "climb" ? "#192a56" : "#2f3640",
                border: meta?.action === "climb" ? "1px solid #00a8ff" : "1px solid #718093",
                color: meta?.action === "climb" ? "#00a8ff" : "#718093",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              {meta?.action === "climb" ? "🧗 STOP" : "🧗 CLIMB"}
            </button>
            {(meta?.action === "swim" || meta?.action === "swim_submerged") && (
              <>
                &nbsp;|&nbsp; Dive: <span className="hud__key">V</span>
                <button 
                  onClick={handleDive}
                  style={{
                    marginLeft: "8px",
                    background: meta?.action === "swim_submerged" ? "#0a3d62" : "#3c6382",
                    border: meta?.action === "swim_submerged" ? "1px solid #00d2d3" : "1px solid #0a3d62",
                    color: meta?.action === "swim_submerged" ? "#00d2d3" : "#f5f6fa",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "'Press Start 2P'",
                    fontSize: "7px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }}
                >
                  {meta?.action === "swim_submerged" ? "🫧 SURFACE" : "🤿 DIVE"}
                </button>
              </>
            )}
            &nbsp;|&nbsp;
            <button 
              onClick={() => {
                const newVal = !isEditorOpen;
                setIsEditorOpen(newVal);
                setIsMapEditorCollapsed(false);
                if (newVal) {
                  setIsTerrainEditorOpen(false);
                  setIsAnimalEditorOpen(false);
                }
              }}
              style={{
                marginLeft: "8px",
                background: isEditorOpen ? "#1e272e" : "#2f3542",
                border: isEditorOpen ? "1px solid #00d2d3" : "1px solid #747d8c",
                color: isEditorOpen ? "#00d2d3" : "#f1f2f6",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              {isEditorOpen ? "🛠️ PLAY MODE" : "🛠️ MAP EDITOR"}
            </button>
            <button 
              onClick={() => {
                const newVal = !isTerrainEditorOpen;
                setIsTerrainEditorOpen(newVal);
                if (newVal) {
                  setIsEditorOpen(false);
                  setIsAnimalEditorOpen(false);
                }
              }}
              style={{
                marginLeft: "6px",
                background: isTerrainEditorOpen ? "rgba(0,184,217,0.15)" : "#2f3542",
                border: isTerrainEditorOpen ? "1px solid #00b8d9" : "1px solid #747d8c",
                color: isTerrainEditorOpen ? "#00b8d9" : "#f1f2f6",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              {isTerrainEditorOpen ? "🏔️ KAPAT [T]" : "🏔️ ARAZİ [T]"}
            </button>
            <button 
              onClick={() => {
                const newVal = !isAnimalEditorOpen;
                setIsAnimalEditorOpen(newVal);
                if (newVal) {
                  setIsEditorOpen(false);
                  setIsTerrainEditorOpen(false);
                }
              }}
              style={{
                marginLeft: "6px",
                background: isAnimalEditorOpen ? "rgba(155, 89, 182, 0.15)" : "#2f3542",
                border: isAnimalEditorOpen ? "1px solid #9b59b6" : "1px solid #747d8c",
                color: isAnimalEditorOpen ? "#d08af6" : "#f1f2f6",
                padding: "2px 6px",
                borderRadius: "3px",
                fontFamily: "'Press Start 2P'",
                fontSize: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
            >
              {isAnimalEditorOpen ? "🐾 KAPAT [H]" : "🐾 HAYVAN [H]"}
            </button>
          </div>

          {/* Bottom-center: Equipped Tool Slot */}
          {meta && meta.equippedTool && meta.equippedTool !== "none" && (
            <div className="hud__equipped-tool glass" style={{ minWidth: "220px" }}>
              <span className="hud__equipped-label">HOLDING:</span>
              <span className="hud__equipped-name">
                {getToolDisplayName(meta.equippedTool)}
              </span>
              {meta.equippedTool === "carrying" ? (
                <button 
                  className="hud__use-btn" 
                  style={{ background: "#d97706", borderColor: "rgba(245,158,11,0.2)" }} 
                  onClick={handleThrow}
                >
                  THROW
                </button>
              ) : meta.equippedTool.startsWith("horse") ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button 
                    className="hud__use-btn" 
                    style={{ background: "#10b981", borderColor: "rgba(16,185,129,0.2)" }} 
                    onClick={handleUseTool}
                  >
                    EAT
                  </button>
                  <button 
                    className="hud__use-btn" 
                    style={{ background: "#6b7280", borderColor: "rgba(107,114,128,0.2)" }} 
                    onClick={handleMountHorse}
                  >
                    UNMOUNT
                  </button>
                </div>
              ) : meta.equippedTool.startsWith("bicycle") ? (
                <button 
                  className="hud__use-btn" 
                  style={{ background: "#6b7280", borderColor: "rgba(107,114,128,0.2)" }} 
                  onClick={handleMountHorse}
                >
                  UNMOUNT
                </button>
              ) : meta.equippedTool.startsWith("bear") ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button 
                    className="hud__use-btn" 
                    style={{ background: "#ff4757", borderColor: "rgba(255,71,87,0.2)" }} 
                    onClick={handleUseTool}
                  >
                    ATTACK
                  </button>
                  <button 
                    className="hud__use-btn" 
                    style={{ background: "#6b7280", borderColor: "rgba(107,114,128,0.2)" }} 
                    onClick={handleMountHorse}
                  >
                    UNMOUNT
                  </button>
                </div>
              ) : (
                <button className="hud__use-btn" onClick={handleUseTool}>
                  USE
                </button>
              )}
            </div>
          )}

          {/* Bottom-right: live badge */}
          <div className="hud__ping glass" id="hud-ping">
            <span className="hud__online-dot" />
            <span className="hud__ping-value">LIVE</span>
          </div>

        </div>
      )}

      {/* ── Respawn Overlay ── */}
      {phase === "connected" && meta?.action === "death" && (
        <div className="respawn-overlay glass" style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <h1 style={{
            fontFamily: "'Press Start 2P'",
            fontSize: "28px",
            color: "#ff4757",
            marginBottom: "20px",
            textShadow: "0 0 10px rgba(255, 71, 87, 0.5)"
          }}>
            YOU DIED
          </h1>
          <button 
            onClick={handleRespawn}
            style={{
              background: "#2ecc71",
              border: "none",
              color: "white",
              padding: "10px 20px",
              fontFamily: "'Press Start 2P'",
              fontSize: "12px",
              cursor: "pointer",
              borderRadius: "5px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
            }}
          >
            RESPAWN
          </button>
        </div>
      )}

      {/* ── Merchant Shop Modal ── */}
      {isMerchantOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div className="glass" style={{
            width: "420px",
            padding: "20px",
            borderRadius: "12px",
            border: "2px solid #f1c40f",
            boxShadow: "0 0 20px rgba(241, 196, 15, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            color: "white",
            fontFamily: "'Outfit', sans-serif"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>💰</span>
                <span style={{ fontFamily: "'Press Start 2P'", fontSize: "12px", color: "#f1c40f" }}>GIZLI TÜCCAR GOBLIN</span>
              </div>
              <button 
                onClick={() => setIsMerchantOpen(false)}
                style={{ background: "transparent", border: "none", color: "#a4b0be", fontSize: "16px", cursor: "pointer", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "11px", color: "#ced6e0", margin: 0, lineHeight: "1.4" }}>
              "Hehe! Hoşgeldin yabancı! Nadir iksirler ve efsanevi nesneler arıyorsan doğru yerdesin!"
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "🧪 %10 Goblin Hasar İksiri", desc: "Goblinlere verilen tüm silah hasarlarını %10 artırır", price: 100, action: () => {
                  if (gold >= 100) {
                    setGold(prev => prev - 100);
                    setHasGoblinDamageBoost(true);
                    (window as any).goblinDamageBoost = true;
                  }
                }},
                { name: "❤️ Can İksiri", desc: "Canını full (100 HP) yeniler", price: 100, action: () => {
                  if (gold >= 100) {
                    setGold(prev => prev - 100);
                    if (room) {
                      const p = room.state.players.get(room.sessionId);
                      if (p) p.hp = 100;
                    }
                  }
                }},
                { name: "🎁 Evcil Hayvan Kutusu", desc: "Şansa rastgele bir kedi veya köpek evcil hayvan arkadaşı verir", price: 150, action: () => {
                  if (gold >= 150) {
                    setGold(prev => prev - 150);
                    if (room) room.send("open_pet_box");
                  }
                }},
                { name: "👑 Efsanevi Okçu Yayı", desc: "Nadir Seviye 10 Yay (Envantere ekler)", price: 400, action: () => {
                  if (gold >= 400) {
                    setGold(prev => prev - 400);
                    if (room) room.send("equip_tool", { tool: "archer_10" });
                  }
                }}
              ].map((item, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "12px", color: "#f1c40f" }}>{item.name}</div>
                    <div style={{ fontSize: "9px", color: "#a4b0be", marginTop: "2px" }}>{item.desc}</div>
                  </div>
                  <button
                    onClick={item.action}
                    disabled={gold < item.price}
                    style={{
                      fontFamily: "'Press Start 2P'",
                      fontSize: "8px",
                      padding: "8px 12px",
                      background: gold >= item.price ? "linear-gradient(90deg, #f1c40f, #f39c12)" : "#747d8c",
                      color: "black",
                      border: "none",
                      borderRadius: "6px",
                      cursor: gold >= item.price ? "pointer" : "not-allowed",
                      fontWeight: "bold"
                    }}
                  >
                    {item.price} 🪙
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
              <button
                onClick={() => setIsMerchantOpen(false)}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "white",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "10px"
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5c. Stable Overlay Modal (Hayvan Pazarı) ── */}
      {phase === "connected" && isStableOpen && (
        <div className="shop-overlay" onClick={() => setIsStableOpen(false)}>
          <div className="shop-modal glass" style={{ borderColor: "#b79052" }} onClick={(e) => e.stopPropagation()}>
            <div className="shop-modal__header">
              <div className="shop-modal__header-left">
                <span className="shop-modal__title" style={{ color: "#eccc68" }}>🐎 STABLE (HAYVAN PAZARI)</span>
                <span className="shop-modal__gold">💰 {gold}G</span>
              </div>
              <button className="shop-modal__close" onClick={() => setIsStableOpen(false)}>✕</button>
            </div>
            
            <div className="shop-modal__tabs">
              <button 
                className={`shop-modal__tab ${stableTab === "horses" ? "shop-modal__tab--active" : ""}`}
                style={stableTab === "horses" ? { background: "#b79052", borderColor: "#eccc68" } : {}}
                onClick={() => setStableTab("horses")}
              >
                🐎 MOUNTS
              </button>
              <button 
                className={`shop-modal__tab ${stableTab === "bicycles" ? "shop-modal__tab--active" : ""}`}
                style={stableTab === "bicycles" ? { background: "#4a69bd", borderColor: "#82ccdd" } : {}}
                onClick={() => setStableTab("bicycles")}
              >
                🚲 BICYCLES
              </button>
            </div>

            <div className="shop-modal__grid">
              {stableTab === "horses" ? (
                MOUNTS_LIST.map((item) => {
                  const isBearType = item.type === "bear";
                  const isBroomstickType = item.type === "broomstick";
                  const isTractorType = item.type === "tractor";
                  const isPurchased = isBearType 
                    ? purchasedBears.includes(item.id) 
                    : isBroomstickType 
                    ? purchasedBroomsticks.includes(item.id) 
                    : isTractorType
                    ? purchasedTractors.includes(item.id)
                    : purchasedHorses.includes(item.id);
                  const isEquipped = isBearType 
                    ? activeMountType === "bear" 
                    : isBroomstickType 
                    ? activeMountType === "broomstick" && activeBroomstickVariant === item.id
                    : isTractorType
                    ? activeMountType === "tractor"
                    : activeMountType === "horse" && activeHorseVariant === item.id;
                  const canAfford = gold >= item.cost;

                  return (
                    <div key={`${item.type}_${item.id}`} className={`shop-item glass ${isEquipped ? "shop-item--equipped" : ""}`} style={{ borderColor: isEquipped ? "#eccc68" : "rgba(255,255,255,0.1)" }}>
                      <div className="shop-item__preview" style={{ padding: "10px", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                        {isBearType ? <BearPreview /> : isBroomstickType ? <BroomstickPreview variantId={item.id} /> : isTractorType ? <TractorPreview /> : <HorsePreview variantId={item.id} />}
                      </div>
                      <div className="shop-item__info">
                        <div className="shop-item__name" style={{ color: item.colorCode }}>{item.name}</div>
                        <div className="shop-item__cost" style={{ fontSize: "10px", color: "#a4b0be", marginTop: "4px" }}>{item.desc}</div>
                        <div className="shop-item__cost" style={{ color: "#eccc68", marginTop: "6px" }}>{item.cost > 0 ? `${item.cost}G` : "FREE"}</div>
                      </div>
                      <div className="shop-item__action">
                        {!isPurchased ? (
                          <button
                            className="shop-item__btn shop-item__btn--buy"
                            style={{ background: "#b79052" }}
                            disabled={!canAfford}
                            onClick={() => isBearType ? handleBuyBear(item.id, item.cost) : isBroomstickType ? handleBuyBroomstick(item.id, item.cost) : isTractorType ? handleBuyTractor(item.id, item.cost) : handleBuyHorse(item.id, item.cost)}
                          >
                            BUY
                          </button>
                        ) : (
                          <button
                            className={`shop-item__btn ${
                              isEquipped 
                                ? "shop-item__btn--equipped" 
                                : "shop-item__btn--equip"
                            }`}
                            style={isEquipped ? { background: "#2ecc71" } : {}}
                            onClick={() => isBearType ? handleEquipBear() : isBroomstickType ? handleEquipBroomstick(item.id) : isTractorType ? handleEquipTractor() : handleEquipHorse(item.id)}
                          >
                            {isEquipped ? "EQUIPPED" : "EQUIP"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                BICYCLES_LIST.map((item) => {
                  const isPurchased = purchasedBicycles.includes(item.color);
                  const isEquipped = activeMountType === "bicycle" && activeBicycleColor === item.color;
                  const canAfford = gold >= item.cost;

                  return (
                    <div key={item.color} className={`shop-item glass ${isEquipped ? "shop-item--equipped" : ""}`} style={{ borderColor: isEquipped ? "#82ccdd" : "rgba(255,255,255,0.1)" }}>
                      <div className="shop-item__preview" style={{ padding: "10px", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                        <BicyclePreview color={item.color} />
                      </div>
                      <div className="shop-item__info">
                        <div className="shop-item__name" style={{ color: item.colorCode }}>{item.name}</div>
                        <div className="shop-item__cost" style={{ fontSize: "10px", color: "#a4b0be", marginTop: "4px" }}>{item.desc}</div>
                        <div className="shop-item__cost" style={{ color: "#82ccdd", marginTop: "6px" }}>{item.cost > 0 ? `${item.cost}G` : "FREE"}</div>
                      </div>
                      <div className="shop-item__action">
                        {!isPurchased ? (
                          <button
                            className="shop-item__btn shop-item__btn--buy"
                            style={{ background: "#4a69bd" }}
                            disabled={!canAfford}
                            onClick={() => handleBuyBicycle(item.color, item.cost)}
                          >
                            BUY
                          </button>
                        ) : (
                          <button
                            className={`shop-item__btn ${
                              isEquipped 
                                ? "shop-item__btn--equipped" 
                                : "shop-item__btn--equip"
                            }`}
                            style={isEquipped ? { background: "#2ecc71" } : {}}
                            onClick={() => handleEquipBicycle(item.color)}
                          >
                            {isEquipped ? "EQUIPPED" : "EQUIP"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Shop Overlay Modal ── */}
      {phase === "connected" && isShopOpen && (
        <div className="shop-overlay" onClick={() => setIsShopOpen(false)}>
          <div className="shop-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="shop-modal__header">
              <div className="shop-modal__header-left">
                <span className="shop-modal__title">🛒 MARKETPLACE</span>
                <span className="shop-modal__gold">💰 {gold}G</span>
              </div>
              <button className="shop-modal__close" onClick={() => setIsShopOpen(false)}>✕</button>
            </div>
            
            <div className="shop-modal__tabs">
              <button 
                className={`shop-modal__tab ${shopTab === "hats" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setShopTab("hats")}
              >
                HATS
              </button>
              <button 
                className={`shop-modal__tab ${shopTab === "pets" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setShopTab("pets")}
              >
                PETS
              </button>
              <button 
                className={`shop-modal__tab ${shopTab === "farming" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setShopTab("farming")}
              >
                🌾 FARMING
              </button>
            </div>

            <div className="shop-modal__grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "12px",
              padding: "8px",
              maxHeight: "360px",
              overflowY: "auto"
            }}>
              {shopTab === "hats" && HATS_LIST.map((item) => {
                const isPurchased = purchasedHats.includes(item.id);
                const isEquipped = meta?.equippedHat === item.id;
                const canAfford = gold >= item.cost;

                return (
                  <div key={item.id} className={`shop-item glass ${isEquipped ? "shop-item--equipped" : ""}`}>
                    <div className="shop-item__preview">
                      <HatPreview hatId={item.id} />
                    </div>
                    <div className="shop-item__info">
                      <div className="shop-item__name">{item.name}</div>
                      <div className="shop-item__cost">{item.cost}G</div>
                    </div>
                    <div className="shop-item__action">
                      {!isPurchased ? (
                        <button
                          className="shop-item__btn shop-item__btn--buy"
                          disabled={!canAfford}
                          onClick={() => handleBuyHat(item.id, item.cost)}
                        >
                          BUY
                        </button>
                      ) : (
                        <button
                          className={`shop-item__btn ${
                            isEquipped 
                              ? "shop-item__btn--equipped" 
                              : "shop-item__btn--equip"
                          }`}
                          onClick={() => handleEquipHat(item.id)}
                        >
                          {isEquipped ? "EQUIPPED" : "EQUIP"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {shopTab === "pets" && (
                <div key="pet-box-item" className="shop-item glass" style={{ width: "100%", gridColumn: "span 2", display: "flex", gap: "16px", padding: "16px" }}>
                  <div className="shop-item__preview" style={{ fontSize: "42px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    🎁
                  </div>
                  <div className="shop-item__info" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div className="shop-item__name" style={{ fontSize: "14px", fontWeight: "bold", color: "#f1c40f" }}>🎁 Evcil Hayvan Kutusu (Pet Box)</div>
                    <div className="shop-item__cost" style={{ fontSize: "11px", color: "#ced6e0" }}>Maliyeti: <span style={{ color: "#f1c40f", fontWeight: "bold" }}>150 Altın</span></div>
                    <p style={{ fontSize: "9px", color: "#a4b0be", margin: 0, lineHeight: "1.4" }}>
                      Açıldığında şansa rastgele bir kedi veya köpek evcil hayvan arkadaşı kazandırır! Evcil hayvanınız sizi peşinizden takip eder ve durduğunuzda uyumaya geçer.
                    </p>
                  </div>
                  <div className="shop-item__action" style={{ display: "flex", alignItems: "center" }}>
                    <button
                      className="shop-item__btn shop-item__btn--buy"
                      disabled={gold < 150}
                      onClick={() => {
                        if (gold >= 150) {
                          setGold(prev => prev - 150);
                          if (room) room.send("open_pet_box");
                        }
                      }}
                      style={{
                        padding: "10px 16px",
                        fontSize: "9px",
                        background: gold >= 150 ? "linear-gradient(90deg, #f1c40f, #f39c12)" : "#747d8c",
                        color: "black",
                        fontWeight: "bold",
                        border: "none",
                        borderRadius: "6px",
                        cursor: gold >= 150 ? "pointer" : "not-allowed"
                      }}
                    >
                      SATIN AL & AÇ
                    </button>
                  </div>
                </div>
              )}

              {shopTab === "farming" && (
                <>
                  {/* Seeds Section */}
                  <div style={{ gridColumn: "1 / -1", fontSize: "11px", color: "#54a0ff", fontWeight: "bold", borderBottom: "1px solid rgba(84,160,255,0.2)", paddingBottom: "4px", marginTop: "8px" }}>
                    🌱 TOHUMLAR (SATIN AL)
                  </div>
                  {[
                    { id: "apple", name: "Elma Tohumu", cost: 0, icon: "🌱🍎" },
                    { id: "carrot", name: "Havuç Tohumu", cost: 0, icon: "/assets/mahsul/carrot_icon.png" },
                    { id: "wheat", name: "Buğday Tohumu", cost: 0, icon: "/assets/mahsul/wheat_icon.png" },
                    { id: "adzuki_bean", name: "Adzuki Tohumu", cost: 0, icon: "/assets/mahsul/adzuki_bean_icon.png" },
                    { id: "bell_pepper", name: "Biber Tohumu", cost: 0, icon: "/assets/mahsul/bell_pepper_icon.png" },
                    { id: "blackberry", name: "Böğürtlen Tohumu", cost: 0, icon: "/assets/mahsul/blackberry_icon.png" },
                    { id: "cucumber", name: "Salatalık Tohumu", cost: 0, icon: "/assets/mahsul/cucumber_icon.png" },
                    { id: "green_beans", name: "Taze Fasulye Tohumu", cost: 0, icon: "/assets/mahsul/green_beans_icon.png" },
                    { id: "hot_pepper", name: "Acı Biber Tohumu", cost: 0, icon: "/assets/mahsul/hot_pepper_icon.png" },
                    { id: "melon", name: "Kavun Tohumu", cost: 0, icon: "/assets/mahsul/melon_icon.png" },
                    { id: "pineapple", name: "Ananas Tohumu", cost: 0, icon: "/assets/mahsul/pineapple_icon.png" },
                    { id: "sunflower", name: "Ayçiçeği Tohumu", cost: 0, icon: "/assets/mahsul/sunflower_icon.png" },
                    { id: "tomato", name: "Domates Tohumu", cost: 0, icon: "/assets/mahsul/tomato_icon.png" },
                    { id: "watermelon", name: "Karpuz Tohumu", cost: 0, icon: "/assets/mahsul/watermelon_icon.png" },
                    { id: "asparagus", name: "Kuşkonmaz Tohumu", cost: 0, icon: "/assets/mahsul/asparagus_icon.png" },
                    { id: "blueberry", name: "Yaban Mersini Tohumu", cost: 0, icon: "/assets/mahsul/blueberry_icon.png" },
                    { id: "broccoli", name: "Brokoli Tohumu", cost: 0, icon: "/assets/mahsul/broccoli_icon.png" },
                    { id: "cabbage", name: "Lahana Tohumu", cost: 0, icon: "/assets/mahsul/cabbage_icon.png" },
                    { id: "cauliflower", name: "Karnabahar Tohumu", cost: 0, icon: "/assets/mahsul/cauliflower_icon.png" },
                    { id: "onion", name: "Soğan Tohumu", cost: 0, icon: "/assets/mahsul/onion_icon.png" },
                    { id: "parsnip", name: "Yaban Havucu Tohumu", cost: 0, icon: "/assets/mahsul/parsnip_icon.png" },
                    { id: "potato", name: "Patates Tohumu", cost: 0, icon: "/assets/mahsul/potato_icon.png" },
                    { id: "rice", name: "Pirinç Tohumu", cost: 0, icon: "/assets/mahsul/rice_icon.png" },
                    { id: "spring_onion", name: "Taze Soğan Tohumu", cost: 0, icon: "/assets/mahsul/spring_onion_icon.png" },
                    { id: "strawberry", name: "Çilek Tohumu", cost: 0, icon: "/assets/mahsul/strawberry_icon.png" },
                  ].map(s => (
                    <div key={`shop_seed_${s.id}`} className="shop-item glass" style={{ padding: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      {s.icon.endsWith(".png") ? (
                        <img src={s.icon} style={{ width: "32px", height: "32px", imageRendering: "pixelated" }} alt={s.name} />
                      ) : (
                        <span style={{ fontSize: "28px" }}>{s.icon}</span>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: "bold", textAlign: "center" }}>{s.name}</div>
                      <div style={{ fontSize: "9px", color: "#f1c40f" }}>{s.cost}G</div>
                      <button
                        className="shop-item__btn shop-item__btn--buy"
                        disabled={gold < s.cost}
                        onClick={() => handleBuySeed(s.id, s.cost)}
                        style={{ width: "100%", padding: "4px 8px", fontSize: "8px" }}
                      >
                        SATIN AL
                      </button>
                    </div>
                  ))}

                  {/* Harvests Section */}
                  <div style={{ gridColumn: "1 / -1", fontSize: "11px", color: "#2ed573", fontWeight: "bold", borderBottom: "1px solid rgba(46,213,115,0.2)", paddingBottom: "4px", marginTop: "16px" }}>
                    🌾 MAHSULLER (SAT)
                  </div>
                  {[
                    { id: "apple", name: "Elma", price: 35, icon: "🍎" },
                    { id: "carrot", name: "Havuç", price: 25, icon: "/assets/mahsul/carrot_icon.png" },
                    { id: "wheat", name: "Buğday", price: 15, icon: "/assets/mahsul/wheat_icon.png" },
                    { id: "adzuki_bean", name: "Adzuki Fasulyesi", price: 55, icon: "/assets/mahsul/adzuki_bean_icon.png" },
                    { id: "bell_pepper", name: "Dolmalık Biber", price: 40, icon: "/assets/mahsul/bell_pepper_icon.png" },
                    { id: "blackberry", name: "Böğürtlen", price: 45, icon: "/assets/mahsul/blackberry_icon.png" },
                    { id: "cucumber", name: "Salatalık", price: 50, icon: "/assets/mahsul/cucumber_icon.png" },
                    { id: "green_beans", name: "Taze Fasulye", price: 60, icon: "/assets/mahsul/green_beans_icon.png" },
                    { id: "hot_pepper", name: "Acı Biber", price: 42, icon: "/assets/mahsul/hot_pepper_icon.png" },
                    { id: "melon", name: "Kavun", price: 65, icon: "/assets/mahsul/melon_icon.png" },
                    { id: "pineapple", name: "Ananas", price: 75, icon: "/assets/mahsul/pineapple_icon.png" },
                    { id: "sunflower", name: "Ayçiçeği", price: 80, icon: "/assets/mahsul/sunflower_icon.png" },
                    { id: "tomato", name: "Domates", price: 48, icon: "/assets/mahsul/tomato_icon.png" },
                    { id: "watermelon", name: "Karpuz", price: 90, icon: "/assets/mahsul/watermelon_icon.png" },
                    { id: "asparagus", name: "Kuşkonmaz", price: 30, icon: "/assets/mahsul/asparagus_icon.png" },
                    { id: "blueberry", name: "Yaban Mersini", price: 48, icon: "/assets/mahsul/blueberry_icon.png" },
                    { id: "broccoli", name: "Brokoli", price: 32, icon: "/assets/mahsul/broccoli_icon.png" },
                    { id: "cabbage", name: "Lahana", price: 35, icon: "/assets/mahsul/cabbage_icon.png" },
                    { id: "cauliflower", name: "Karnabahar", price: 38, icon: "/assets/mahsul/cauliflower_icon.png" },
                    { id: "onion", name: "Soğan", price: 28, icon: "/assets/mahsul/onion_icon.png" },
                    { id: "parsnip", name: "Yaban Havucu", price: 26, icon: "/assets/mahsul/parsnip_icon.png" },
                    { id: "potato", name: "Patates", price: 34, icon: "/assets/mahsul/potato_icon.png" },
                    { id: "rice", name: "Pirinç", price: 22, icon: "/assets/mahsul/rice_icon.png" },
                    { id: "spring_onion", name: "Taze Soğan", price: 24, icon: "/assets/mahsul/spring_onion_icon.png" },
                    { id: "strawberry", name: "Çilek", price: 52, icon: "/assets/mahsul/strawberry_icon.png" },
                  ].map(h => {
                    const owned = playerHarvests[h.id] || 0;
                    return (
                      <div key={`shop_harvest_${h.id}`} className="shop-item glass" style={{ padding: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        {h.icon.endsWith(".png") ? (
                          <img src={h.icon} style={{ width: "32px", height: "32px", imageRendering: "pixelated" }} alt={h.name} />
                        ) : (
                          <span style={{ fontSize: "28px" }}>{h.icon}</span>
                        )}
                        <div style={{ fontSize: "10px", fontWeight: "bold", textAlign: "center" }}>{h.name}</div>
                        <div style={{ fontSize: "9px", color: "#2ed573" }}>{h.price}G Satış</div>
                        <div style={{ fontSize: "8px", color: "#a4b0be" }}>Sahip: {owned} adet</div>
                        <button
                          className="shop-item__btn shop-item__btn--buy"
                          disabled={owned <= 0}
                          onClick={() => handleSellHarvest(h.id, h.price)}
                          style={{ width: "100%", padding: "4px 8px", fontSize: "8px", background: "#2ed573" }}
                        >
                          SAT
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5b. Inventory Overlay Modal ── */}
      {phase === "connected" && isInventoryOpen && (
        <div className="shop-overlay" onClick={() => setIsInventoryOpen(false)}>
          <div className="shop-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="shop-modal__header">
              <div className="shop-modal__header-left">
                <span className="shop-modal__title">🎒 BACKPACK INVENTORY</span>
              </div>
              <button className="shop-modal__close" onClick={() => setIsInventoryOpen(false)}>✕</button>
            </div>

            <div className="shop-modal__tabs" style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              <button
                className={`shop-modal__tab ${invTab === "pickaxe" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("pickaxe")}
              >
                ⛏️ PICKAXES
              </button>
              <button
                className={`shop-modal__tab ${invTab === "axe" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("axe")}
              >
                🪓 AXES
              </button>
              <button
                className={`shop-modal__tab ${invTab === "hoe" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("hoe")}
              >
                🧑‍🌾 HOES
              </button>
              <button
                className={`shop-modal__tab ${invTab === "sickle" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("sickle")}
              >
                🌾 SICKLES
              </button>
              <button
                className={`shop-modal__tab ${invTab === "shovel" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("shovel")}
              >
                🥄 SHOVELS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "watering" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("watering")}
              >
                🪣 WATERING
              </button>
              <button
                className={`shop-modal__tab ${invTab === "sword" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("sword")}
              >
                ⚔️ SWORDS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "archer" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("archer")}
              >
                🏹 BOWS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "bug_net" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("bug_net")}
              >
                🕸️ NETS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "fishing" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("fishing")}
              >
                🎣 FISHING
              </button>
               <button
                className={`shop-modal__tab ${invTab === "crops" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("crops")}
              >
                🌾 FARMING
              </button>
              <button
                className={`shop-modal__tab ${invTab === "staff" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("staff")}
              >
                🪄 STAFFS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "arrow" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("arrow")}
              >
                🏹 AMMO
              </button>
              <button
                className={`shop-modal__tab ${invTab === "helmet" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("helmet")}
              >
                🪖 HELMETS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "chestplate" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("chestplate")}
              >
                🛡️ CHESTPLATES
              </button>
              <button
                className={`shop-modal__tab ${invTab === "leggings" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("leggings")}
              >
                👖 LEGGINGS
              </button>
              <button
                className={`shop-modal__tab ${invTab === "boots" ? "shop-modal__tab--active" : ""}`}
                onClick={() => setInvTab("boots")}
              >
                🥾 BOOTS
              </button>
            </div>

            <div className="shop-modal__grid" style={{ maxHeight: "350px", overflowY: "auto" }}>
              {invTab === "crops" ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Seeds Section */}
                  <div>
                    <div style={{ fontSize: "11px", color: "#54a0ff", fontWeight: "bold", borderBottom: "1px solid rgba(84,160,255,0.2)", paddingBottom: "4px", marginBottom: "8px" }}>
                      🌱 TOHUMLAR (EKMEK İÇİN KUŞANIN)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                      {[
                        { id: "apple", name: "Elma Tohumu", icon: "🌱🍎" },
                        { id: "carrot", name: "Havuç Tohumu", icon: "/assets/mahsul/carrot_icon.png" },
                        { id: "wheat", name: "Buğday Tohumu", icon: "/assets/mahsul/wheat_icon.png" },
                        { id: "adzuki_bean", name: "Adzuki Tohumu", icon: "/assets/mahsul/adzuki_bean_icon.png" },
                        { id: "bell_pepper", name: "Biber Tohumu", icon: "/assets/mahsul/bell_pepper_icon.png" },
                        { id: "blackberry", name: "Böğürtlen Tohumu", icon: "/assets/mahsul/blackberry_icon.png" },
                        { id: "cucumber", name: "Salatalık Tohumu", icon: "/assets/mahsul/cucumber_icon.png" },
                        { id: "green_beans", name: "Taze Fasulye Tohumu", icon: "/assets/mahsul/green_beans_icon.png" },
                        { id: "hot_pepper", name: "Acı Biber Tohumu", icon: "/assets/mahsul/hot_pepper_icon.png" },
                        { id: "melon", name: "Kavun Tohumu", icon: "/assets/mahsul/melon_icon.png" },
                        { id: "pineapple", name: "Ananas Tohumu", icon: "/assets/mahsul/pineapple_icon.png" },
                        { id: "sunflower", name: "Ayçiçeği Tohumu", icon: "/assets/mahsul/sunflower_icon.png" },
                        { id: "tomato", name: "Domates Tohumu", icon: "/assets/mahsul/tomato_icon.png" },
                        { id: "watermelon", name: "Karpuz Tohumu", icon: "/assets/mahsul/watermelon_icon.png" },
                        { id: "asparagus", name: "Kuşkonmaz Tohumu", icon: "/assets/mahsul/asparagus_icon.png" },
                        { id: "blueberry", name: "Yaban Mersini Tohumu", icon: "/assets/mahsul/blueberry_icon.png" },
                        { id: "broccoli", name: "Brokoli Tohumu", icon: "/assets/mahsul/broccoli_icon.png" },
                        { id: "cabbage", name: "Lahana Tohumu", icon: "/assets/mahsul/cabbage_icon.png" },
                        { id: "cauliflower", name: "Karnabahar Tohumu", icon: "/assets/mahsul/cauliflower_icon.png" },
                        { id: "onion", name: "Soğan Tohumu", icon: "/assets/mahsul/onion_icon.png" },
                        { id: "parsnip", name: "Yaban Havucu Tohumu", icon: "/assets/mahsul/parsnip_icon.png" },
                        { id: "potato", name: "Patates Tohumu", icon: "/assets/mahsul/potato_icon.png" },
                        { id: "rice", name: "Pirinç Tohumu", icon: "/assets/mahsul/rice_icon.png" },
                        { id: "spring_onion", name: "Taze Soğan Tohumu", icon: "/assets/mahsul/spring_onion_icon.png" },
                        { id: "strawberry", name: "Çilek Tohumu", icon: "/assets/mahsul/strawberry_icon.png" },
                      ].map(s => {
                        const count = playerSeeds[s.id] || 0;
                        const toolId = `seed_${s.id}`;
                        const isEquipped = meta?.equippedTool === toolId;
                        return (
                          <div key={`inv_seed_${s.id}`} className={`shop-item glass ${isEquipped ? "shop-item--equipped" : ""}`} style={{ padding: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                            {s.icon.endsWith(".png") ? (
                              <img src={s.icon} style={{ width: "32px", height: "32px", imageRendering: "pixelated" }} alt={s.name} />
                            ) : (
                              <span style={{ fontSize: "32px" }}>{s.icon}</span>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "10px", fontWeight: "bold" }}>{s.name}</div>
                              <div style={{ fontSize: "8px", color: "#a4b0be" }}>Miktar: {count} adet</div>
                            </div>
                            <div className="shop-item__action">
                              {count > 0 ? (
                                <button
                                  className={`shop-item__btn ${
                                    isEquipped ? "shop-item__btn--equipped" : "shop-item__btn--equip"
                                  }`}
                                  onClick={() => handleEquipTool(isEquipped ? "none" : toolId)}
                                  style={{ padding: "6px 12px", fontSize: "8px" }}
                                >
                                  {isEquipped ? "UNEQUIP" : "EQUIP"}
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="shop-item__btn"
                                  style={{ padding: "6px 12px", fontSize: "8px", background: "#747d8c", color: "white", border: "none", cursor: "not-allowed" }}
                                >
                                  YOK
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Harvested Crops Section */}
                  <div>
                    <div style={{ fontSize: "11px", color: "#2ed573", fontWeight: "bold", borderBottom: "1px solid rgba(46,213,115,0.2)", paddingBottom: "4px", marginBottom: "8px" }}>
                      🌾 HASAT EDİLEN MAHSULLER (MARKETTE SATILABİLİR)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                      {[
                        { id: "apple", name: "Elma", icon: "🍎" },
                        { id: "carrot", name: "Havuç", icon: "/assets/mahsul/carrot_icon.png" },
                        { id: "wheat", name: "Buğday", icon: "/assets/mahsul/wheat_icon.png" },
                        { id: "adzuki_bean", name: "Adzuki Fasulyesi", icon: "/assets/mahsul/adzuki_bean_icon.png" },
                        { id: "bell_pepper", name: "Dolmalık Biber", icon: "/assets/mahsul/bell_pepper_icon.png" },
                        { id: "blackberry", name: "Böğürtlen", icon: "/assets/mahsul/blackberry_icon.png" },
                        { id: "cucumber", name: "Salatalık", icon: "/assets/mahsul/cucumber_icon.png" },
                        { id: "green_beans", name: "Taze Fasulye", icon: "/assets/mahsul/green_beans_icon.png" },
                        { id: "hot_pepper", name: "Acı Biber", icon: "/assets/mahsul/hot_pepper_icon.png" },
                        { id: "melon", name: "Kavun", icon: "/assets/mahsul/melon_icon.png" },
                        { id: "pineapple", name: "Ananas", icon: "/assets/mahsul/pineapple_icon.png" },
                        { id: "sunflower", name: "Ayçiçeği", icon: "/assets/mahsul/sunflower_icon.png" },
                        { id: "tomato", name: "Domates", icon: "/assets/mahsul/tomato_icon.png" },
                        { id: "watermelon", name: "Karpuz", icon: "/assets/mahsul/watermelon_icon.png" },
                        { id: "asparagus", name: "Kuşkonmaz", icon: "/assets/mahsul/asparagus_icon.png" },
                        { id: "blueberry", name: "Yaban Mersini", icon: "/assets/mahsul/blueberry_icon.png" },
                        { id: "broccoli", name: "Brokoli", icon: "/assets/mahsul/broccoli_icon.png" },
                        { id: "cabbage", name: "Lahana", icon: "/assets/mahsul/cabbage_icon.png" },
                        { id: "cauliflower", name: "Karnabahar", icon: "/assets/mahsul/cauliflower_icon.png" },
                        { id: "onion", name: "Soğan", icon: "/assets/mahsul/onion_icon.png" },
                        { id: "parsnip", name: "Yaban Havucu", icon: "/assets/mahsul/parsnip_icon.png" },
                        { id: "potato", name: "Patates", icon: "/assets/mahsul/potato_icon.png" },
                        { id: "rice", name: "Pirinç", icon: "/assets/mahsul/rice_icon.png" },
                        { id: "spring_onion", name: "Taze Soğan", icon: "/assets/mahsul/spring_onion_icon.png" },
                        { id: "strawberry", name: "Çilek", icon: "/assets/mahsul/strawberry_icon.png" },
                      ].map(h => {
                        const count = playerHarvests[h.id] || 0;
                        return (
                          <div key={`inv_harvest_${h.id}`} className="shop-item glass" style={{ padding: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                            {h.icon.endsWith(".png") ? (
                              <img src={h.icon} style={{ width: "32px", height: "32px", imageRendering: "pixelated" }} alt={h.name} />
                            ) : (
                              <span style={{ fontSize: "32px" }}>{h.icon}</span>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "10px", fontWeight: "bold" }}>{h.name}</div>
                              <div style={{ fontSize: "8px", color: "#a4b0be" }}>Miktar: {count} adet</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                INVENTORY_TOOLS
                  .filter((item) => {
                    if (invTab === "bug_net") return item.id === "bug_net";
                    return item.id.startsWith(invTab + "_");
                  })
                  .map((item) => {
                    // Determine if this is armor and get its slot
                    let armorSlot: "helmet" | "chestplate" | "leggings" | "boots" | null = null;
                    if (item.id.startsWith("helmet_")) armorSlot = "helmet";
                    else if (item.id.startsWith("chestplate_")) armorSlot = "chestplate";
                    else if (item.id.startsWith("leggings_")) armorSlot = "leggings";
                    else if (item.id.startsWith("boots_")) armorSlot = "boots";

                    const isEquipped = armorSlot 
                      ? (
                          armorSlot === "helmet" ? meta?.helmet === item.id :
                          armorSlot === "chestplate" ? meta?.chestplate === item.id :
                          armorSlot === "leggings" ? meta?.leggings === item.id :
                          meta?.boots === item.id
                        )
                      : meta?.equippedTool === item.id;

                    const handleEquipClick = () => {
                      if (armorSlot) {
                        handleEquipArmor(armorSlot, isEquipped ? "none" : item.id);
                      } else {
                        handleEquipTool(isEquipped ? "none" : item.id);
                      }
                    };

                    return (
                      <div key={item.id} className={`shop-item glass ${isEquipped ? "shop-item--equipped" : ""}`}>
                        <div className="shop-item__preview" style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {item.icon.endsWith(".png") ? (
                            <img src={item.icon} style={{ width: "32px", height: "32px", imageRendering: "pixelated" }} alt={item.name} />
                          ) : (
                            <span style={{ fontSize: "28px" }}>{item.icon}</span>
                          )}
                        </div>
                        <div className="shop-item__info">
                          <div className="shop-item__name">{item.name}</div>
                          <div className="shop-item__cost" style={{ color: "#a4b0be" }}>{item.desc}</div>
                        </div>
                        <div className="shop-item__action">
                          {isEquipped ? (
                            <button className="shop-item__btn shop-item__btn--equipped" onClick={handleEquipClick}>
                              UNEQUIP
                            </button>
                          ) : (
                            <button className="shop-item__btn shop-item__btn--equip" onClick={handleEquipClick}>
                              EQUIP
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Console Error Overlay for debugging ── */}
      {consoleErrors.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "60px",
          left: "16px",
          maxWidth: "400px",
          maxHeight: "200px",
          overflowY: "auto",
          background: "rgba(220, 38, 38, 0.95)",
          border: "1px solid #ef4444",
          color: "white",
          padding: "10px",
          borderRadius: "8px",
          zIndex: 9999,
          fontSize: "9px",
          fontFamily: "monospace",
          pointerEvents: "auto",
          lineHeight: "1.3"
        }}>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "4px", marginBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>DEBUG CONSOLE:</span>
            <button 
              onClick={() => setConsoleErrors([])} 
              style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
          {consoleErrors.map((err, i) => (
            <div key={i} style={{ marginBottom: "3px", whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          ))}
        </div>
      )}

      {/* ── 5. Map Editor Overlay UI Panel ── */}
      {isEditorOpen && isMapEditorCollapsed && (
        <div
          onClick={() => setIsMapEditorCollapsed(false)}
          title="Harita Editörünü Aç"
          style={{
            position: "fixed",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1001,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            background: "rgba(13,18,32,0.96)",
            border: "1px solid rgba(0,210,211,0.3)",
            borderLeft: "none",
            borderRadius: "0 10px 10px 0",
            padding: "14px 10px",
            boxShadow: "4px 0 24px rgba(0,0,0,0.6)",
            transition: "all .2s",
            color: "#00d2d3"
          }}
        >
          <span style={{ fontSize: "20px" }}>🛠️</span>
          <span style={{
            fontSize: "7px",
            fontFamily: "'Press Start 2P'",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            letterSpacing: "2px",
            marginTop: "4px"
          }}>EDİTÖR</span>
          <span style={{ fontSize: "10px", color: "#636e72" }}>▶</span>
        </div>
      )}

      {isEditorOpen && !isMapEditorCollapsed && (
        <div 
          className="map-editor-panel glass"
          style={{
            position: "fixed",
            top: "70px",
            left: "20px",
            width: "320px",
            bottom: "80px",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px",
            boxSizing: "border-box",
            overflowY: "auto",
            color: "white",
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: "10px", color: "#00d2d3" }}>🛠️ HARİTA EDİTÖRÜ</span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button 
                onClick={() => setIsMapEditorCollapsed(true)}
                title="Paneli gizle"
                style={{ background: "rgba(0,210,211,0.1)", border: "1px solid rgba(0,210,211,0.3)", color: "#00d2d3", cursor: "pointer", borderRadius: "4px", padding: "2px 8px", fontSize: "11px" }}
              >
                ◀ Gizle
              </button>
              <button 
                onClick={() => setIsEditorOpen(false)}
                style={{ background: "transparent", border: "none", color: "#ff4757", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* History Operations */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              onClick={handleUndo} 
              disabled={undoStack.length === 0}
              className="editor-btn-small"
              style={{ flex: 1, opacity: undoStack.length === 0 ? 0.4 : 1 }}
            >
              ↩ Geri Al (Ctrl+Z)
            </button>
            <button 
              onClick={handleRedo} 
              disabled={redoStack.length === 0}
              className="editor-btn-small"
              style={{ flex: 1, opacity: redoStack.length === 0 ? 0.4 : 1 }}
            >
              ↪ Yinele (Ctrl+Y)
            </button>
          </div>

          {/* Active Map Selector / Indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,184,217,0.1)", border: "1px solid rgba(0,184,217,0.3)", borderRadius: "6px", padding: "6px 10px" }}>
            <span style={{ fontSize: "9px", color: "#00d2d3", fontWeight: "bold" }}>
              🗺️ {(() => {
                const p = (room && room.state && room.state.players) ? room.state.players.get(room.sessionId) : null;
                if (p?.currentMap === "world_5") return "HARİTA 5 (1500×1500 px)";
                if (p?.currentMap === "world_4") return "HARİTA 4 (1500×1500 px)";
                if (p?.currentMap === "world_3") return "HARİTA 3 (2000×2000 px)";
                if (p?.currentMap === "world_2") return "HARİTA 2 (2000×2000 px)";
                return "HARİTA 1 (1500×2500 px)";
              })()}
            </span>
            <button
              onClick={() => {
                const p = (room && room.state && room.state.players) ? room.state.players.get(room.sessionId) : null;
                const cur = p?.currentMap || "world_1";
                const nextMap = cur === "world_1" ? "world_2" : (cur === "world_2" ? "world_3" : (cur === "world_3" ? "world_4" : (cur === "world_4" ? "world_5" : "world_1")));
                if (room) room.send("switch_map", { mapId: nextMap });
              }}
              title="Diğer haritaya geç"
              style={{ background: "#00d2d3", border: "none", color: "#0d1220", fontWeight: "bold", fontSize: "9px", borderRadius: "4px", padding: "3px 8px", cursor: "pointer" }}
            >
              🔄 Değiştir
            </button>
          </div>

          {/* Map Operations (Save/Load) */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px", color: "#a4b0be" }}>HARİTA DOSYALARI</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button 
                onClick={handleSaveMap}
                className="editor-btn-small"
                style={{ flex: 1, background: "#2ed573", borderColor: "#26af5f", color: "white" }}
              >
                💾 HARİTAYI KAYDET
              </button>
              <label 
                className="editor-btn-small"
                style={{ flex: 1, background: "#1e90ff", borderColor: "#1c82e6", color: "white", textAlign: "center", cursor: "pointer", display: "inline-block" }}
              >
                📂 HARİTA YÜKLE
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleLoadMap} 
                  style={{ display: "none" }} 
                />
              </label>
            </div>
          </div>

          {/* Tool Selection */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px", color: "#a4b0be" }}>DÜZENLEME ARACI</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button 
                onClick={() => setActiveEditorTool("brush")}
                className={`editor-tool-select ${activeEditorTool === "brush" ? "active" : ""}`}
              >
                🖌️ Fırça (P)
              </button>
              <button 
                onClick={() => setActiveEditorTool("eraser")}
                className={`editor-tool-select ${activeEditorTool === "eraser" ? "active" : ""}`}
              >
                🧹 Silgi (E)
              </button>
              <button 
                onClick={() => setActiveEditorTool("select")}
                className={`editor-tool-select ${activeEditorTool === "select" ? "active" : ""}`}
              >
                🖐️ Sürükle/Taşı (S)
              </button>
              <button 
                onClick={() => setActiveEditorTool("solid")}
                className={`editor-tool-select ${activeEditorTool === "solid" ? "active" : ""}`}
              >
                🧱 Duvar/Engel (C)
              </button>
              <button 
                onClick={() => setActiveEditorTool("pipette")}
                className={`editor-tool-select ${activeEditorTool === "pipette" ? "active" : ""}`}
              >
                🧪 Damlalık (D)
              </button>
              <button 
                onClick={() => setActiveEditorTool("fill_region")}
                className={`editor-tool-select ${activeEditorTool === "fill_region" ? "active" : ""}`}
                style={{ gridColumn: "1 / -1" }}
                title="Bir karo şablonu kopyalayın, sonra bu araçla sürükleyip alan doldurun"
              >
                🗂️ Alan Doldur (F)
              </button>
            </div>
          </div>

          {/* Copied Tile Template Panel */}
          {copiedTileTemplate && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px", marginTop: "4px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px", color: "#f9ca24" }}>📋 KOPYALANAN KARO ŞABLonu</div>
              <div style={{ background: "rgba(249,202,36,0.08)", border: "1px solid rgba(249,202,36,0.3)", borderRadius: "6px", padding: "8px", fontSize: "11px", color: "#eccc68" }}>
                <div style={{ marginBottom: "4px" }}>🎨 <strong>{copiedTileTemplate.assetId}</strong></div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {copiedTileTemplate.isSolid && <span style={{ background: "rgba(255,71,87,0.3)", padding: "1px 6px", borderRadius: "3px" }}>🧱 Engel</span>}
                  {copiedTileTemplate.isWater && <span style={{ background: "rgba(30,136,229,0.3)", padding: "1px 6px", borderRadius: "3px" }}>🌊 Su</span>}
                  {copiedTileTemplate.isClimbable && <span style={{ background: "rgba(46,204,113,0.3)", padding: "1px 6px", borderRadius: "3px" }}>🪜 Tırmanma</span>}
                  <span style={{ background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: "3px" }}>{copiedTileTemplate.depthLayer}</span>
                </div>
              </div>
              <button
                onClick={() => { setCopiedTileTemplate(null); setActiveEditorTool("brush"); }}
                style={{ marginTop: "6px", width: "100%", padding: "4px", fontSize: "11px", background: "rgba(255,71,87,0.15)", border: "1px solid rgba(255,71,87,0.4)", color: "#ff4757", borderRadius: "4px", cursor: "pointer" }}
              >
                ✕ Şablonu Temizle
              </button>
            </div>
          )}

          {/* Global Brush Settings */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px", color: "#a4b0be" }}>FIRÇA AYARLARI</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={editorGridSnap} 
                  onChange={(e) => setEditorGridSnap(e.target.checked)} 
                />
                Izgaraya Hizala
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                <span style={{ fontSize: "11px", color: "#a4b0be" }}>Derinlik Katmanı:</span>
                <select 
                  value={editorDepthLayer} 
                  onChange={(e: any) => setEditorDepthLayer(e.target.value)}
                  style={{ background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontFamily: "inherit" }}
                >
                  <option value="below">Oyuncunun Altında (Zemin/Halı)</option>
                  <option value="same">Aynı Seviyede (Duvar/Ağaç)</option>
                  <option value="above">Oyuncunun Üstünde (Çatı/Gökyüzü)</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "#a4b0be", fontWeight: "bold" }}>Boya Özellikleri:</span>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={brushIsSolid} 
                    onChange={(e) => setBrushIsSolid(e.target.checked)} 
                  />
                  Engel / Duvar (Geçilemez)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={brushIsWater} 
                    onChange={(e) => setBrushIsWater(e.target.checked)} 
                  />
                  Deniz / Su Alanı (Yüzülür)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={brushIsClimbable} 
                    onChange={(e) => setBrushIsClimbable(e.target.checked)} 
                  />
                  Tırmanmalı / Merdiven (Tırmanılır)
                </label>
              </div>
            </div>
          </div>

          {/* Palette Items */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "8px", color: "#a4b0be" }}>VARLIK PALETİ</div>
            
            {/* Category Selector Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
              <button 
                onClick={() => setEditorCategory("gif")}
                className={`editor-btn-small ${editorCategory === "gif" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "gif" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "gif" ? "#00d2d3" : "#747d8c", color: editorCategory === "gif" ? "#00d2d3" : "white" }}
              >
                ✨ GIF
              </button>
              <button 
                onClick={() => setEditorCategory("dekorasyon")}
                className={`editor-btn-small ${editorCategory === "dekorasyon" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "dekorasyon" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "dekorasyon" ? "#00d2d3" : "#747d8c", color: editorCategory === "dekorasyon" ? "#00d2d3" : "white" }}
              >
                🪴 Dekor
              </button>
              <button 
                onClick={() => setEditorCategory("ev")}
                className={`editor-btn-small ${editorCategory === "ev" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "ev" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "ev" ? "#00d2d3" : "#747d8c", color: editorCategory === "ev" ? "#00d2d3" : "white" }}
              >
                🏠 Ev/Yapı
              </button>
              <button 
                onClick={() => setEditorCategory("zemin")}
                className={`editor-btn-small ${editorCategory === "zemin" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "zemin" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "zemin" ? "#00d2d3" : "#747d8c", color: editorCategory === "zemin" ? "#00d2d3" : "white" }}
              >
                🧱 Zemin
              </button>
              <button 
                onClick={() => setEditorCategory("tree")}
                className={`editor-btn-small ${editorCategory === "tree" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "tree" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "tree" ? "#00d2d3" : "#747d8c", color: editorCategory === "tree" ? "#00d2d3" : "white" }}
              >
                🌲 Ağaç
              </button>
              <button 
                onClick={() => setEditorCategory("plant")}
                className={`editor-btn-small ${editorCategory === "plant" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "plant" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "plant" ? "#00d2d3" : "#747d8c", color: editorCategory === "plant" ? "#00d2d3" : "white" }}
              >
                🌱 Bitki
              </button>
              <button 
                onClick={() => setEditorCategory("mine")}
                className={`editor-btn-small ${editorCategory === "mine" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "mine" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: editorCategory === "mine" ? "#00d2d3" : "#747d8c", color: editorCategory === "mine" ? "#00d2d3" : "white" }}
              >
                ⛏️ Maden
              </button>
              <button 
                onClick={() => setEditorCategory("enemy")}
                className={`editor-btn-small ${editorCategory === "enemy" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "enemy" ? "rgba(231, 76, 60, 0.2)" : "#2f3542", borderColor: editorCategory === "enemy" ? "#e74c3c" : "#747d8c", color: editorCategory === "enemy" ? "#ff4757" : "white" }}
              >
                ⚔️ Düşman
              </button>
              <button 
                onClick={() => setEditorCategory("merchant")}
                className={`editor-btn-small ${editorCategory === "merchant" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "merchant" ? "rgba(241, 196, 15, 0.2)" : "#2f3542", borderColor: editorCategory === "merchant" ? "#f1c40f" : "#747d8c", color: editorCategory === "merchant" ? "#f1c40f" : "white" }}
              >
                💰 Market
              </button>
              <button 
                onClick={() => setEditorCategory("waterfall")}
                className={`editor-btn-small ${editorCategory === "waterfall" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "waterfall" ? "rgba(0, 120, 255, 0.2)" : "#2f3542", borderColor: editorCategory === "waterfall" ? "#0078ff" : "#747d8c", color: editorCategory === "waterfall" ? "#54a0ff" : "white" }}
              >
                🌊 Şelale
              </button>
              <button 
                onClick={() => setEditorCategory("box")}
                className={`editor-btn-small ${editorCategory === "box" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "box" ? "rgba(0, 184, 217, 0.2)" : "#2f3542", borderColor: editorCategory === "box" ? "#00b8d9" : "#747d8c", color: editorCategory === "box" ? "#00b8d9" : "white" }}
              >
                📦 Kasa Dekor
              </button>
              <button 
                onClick={() => setEditorCategory("trunks")}
                className={`editor-btn-small ${editorCategory === "trunks" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "trunks" ? "rgba(230, 126, 34, 0.2)" : "#2f3542", borderColor: editorCategory === "trunks" ? "#e67e22" : "#747d8c", color: editorCategory === "trunks" ? "#f39c12" : "white" }}
              >
                🪵 Kütükler
              </button>
              <button 
                onClick={() => setEditorCategory("big_old_tree")}
                className={`editor-btn-small ${editorCategory === "big_old_tree" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "big_old_tree" ? "rgba(46, 204, 113, 0.2)" : "#2f3542", borderColor: editorCategory === "big_old_tree" ? "#2ecc71" : "#747d8c", color: editorCategory === "big_old_tree" ? "#2ecc71" : "white" }}
              >
                🌳 Koca Ağaç
              </button>
              <button 
                onClick={() => setEditorCategory("bushes")}
                className={`editor-btn-small ${editorCategory === "bushes" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "bushes" ? "rgba(26, 188, 156, 0.2)" : "#2f3542", borderColor: editorCategory === "bushes" ? "#1abc9c" : "#747d8c", color: editorCategory === "bushes" ? "#1abc9c" : "white" }}
              >
                🌿 Çalılar
              </button>
              <button 
                onClick={() => setEditorCategory("decor2")}
                className={`editor-btn-small ${editorCategory === "decor2" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "decor2" ? "rgba(243, 156, 18, 0.2)" : "#2f3542", borderColor: editorCategory === "decor2" ? "#f39c12" : "#747d8c", color: editorCategory === "decor2" ? "#f39c12" : "white" }}
              >
                🌾 Kara Dekor 2
              </button>
              <button 
                onClick={() => setEditorCategory("yon")}
                className={`editor-btn-small ${editorCategory === "yon" ? "active" : ""}`}
                style={{ fontSize: "8px", padding: "4px 8px", background: editorCategory === "yon" ? "rgba(0,184,217,0.2)" : "#2f3542", borderColor: editorCategory === "yon" ? "#00b8d9" : "#747d8c", color: editorCategory === "yon" ? "#00b8d9" : "white" }}
              >
                🧭 Yön Okları
              </button>

            </div>

            {/* Category Items List */}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", minHeight: "80px" }}>
              {editorCategory === "decor2" && (
                <>
                  {[
                    { id: "decor2_barn_small", name: "Küçük Ahır", file: "Barn_Small_16x16.png", w: 128, h: 160 },
                    { id: "decor2_bucket_load", name: "Kova Yükü", file: "Bucket_Load_16x16.png", w: 32, h: 32 },
                    { id: "decor2_fruit_tree_stairs", name: "Meyve Ağacı Merdiveni", file: "Fruit_Tree_Stairs_16x16.png", w: 32, h: 48 },
                    { id: "decor2_hay_fresh_pile", name: "Taze Saman Yığını", file: "Hay_Fresh_Pile_16x16.png", w: 32, h: 16 },
                    { id: "decor2_hay_fresh_pile_rake_red", name: "Tırmıklı Kırmızı Saman", file: "Hay_Fresh_Pile_Rake_Red_16x16.png", w: 32, h: 32 },
                    { id: "decor2_nest_chicken", name: "Tavuk Yuvası", file: "Nest_Chicken_16x16.png", w: 32, h: 48 },
                    { id: "decor2_pot_tree_apple", name: "Saksıda Elma Ağacı", file: "Pot_Tree_Apple_16x16.png", w: 32, h: 48 },
                    { id: "decor2_pot_tree_banana", name: "Saksıda Muz Ağacı", file: "Pot_Tree_Banana_16x16.png", w: 32, h: 48 },
                    { id: "decor2_pot_tree_lemon", name: "Saksıda Limon Ağacı", file: "Pot_Tree_Lemon_16x16.png", w: 32, h: 48 },
                    { id: "decor2_pot_tree_orange", name: "Saksıda Portakal Ağacı", file: "Pot_Tree_Orange_16x16.png", w: 32, h: 48 },
                    { id: "decor2_pot_tree_peach", name: "Saksıda Şeftali Ağacı", file: "Pot_Tree_Peach_16x16.png", w: 32, h: 48 },
                    { id: "decor2_silos", name: "Silo", file: "Silos_1_16x16.png", w: 112, h: 224 },
                    { id: "decor2_stable_example_outside", name: "Binek Ahırı (Dış)", file: "Stable_Example_Outside_16x16.png", w: 160, h: 128 },
                    { id: "decor2_stone_oven", name: "Taş Fırın", file: "Stone_Oven_3_16x16.png", w: 80, h: 64 },
                    { id: "decor2_tailor_crafting_table_full", name: "Terzi Tezgahı", file: "Tailor_Crafting_Table_Full_16x16.png", w: 48, h: 48 },
                    { id: "decor2_tree_pine_dark_green_medium", name: "Koyu Çam Ağacı", file: "Tree_Pine_Dark_Green_Medium_16x16.png", w: 64, h: 80 },
                    { id: "decor2_tree_trunk_oak_big", name: "Meşe Kütüğü (Büyük)", file: "Tree_Trunk_Oak_Big_16x16.png", w: 48, h: 32 },
                    { id: "decor2_tree_trunk_oak_huge", name: "Meşe Kütüğü (Kocaman)", file: "Tree_Trunk_Oak_Huge_16x16.png", w: 48, h: 48 },
                    { id: "decor2_weathercock_roof_farmer_house", name: "Rüzgar Gülü (Çatı)", file: "Weathercock_Roof_Farmer_House_16x16.png", w: 16, h: 32 },
                    { id: "decor2_well_stone", name: "Taş Kuyu", file: "Well_Stone_16x16.png", w: 32, h: 32 },
                    { id: "decor2_wood_board_load", name: "Ahşap Tahta Yükü", file: "Wood_Board_Load_16x16.png", w: 32, h: 32 },
                    { id: "decor2_woodwork_crafting_table_full", name: "Marangoz Tezgahı", file: "Woodwork_Crafting_Table_Full_16x16.png", w: 80, h: 64 }
                  ].map((dec) => (
                    <div 
                      key={dec.id}
                      onClick={() => setSelectedPaletteAsset(dec.id)}
                      style={{
                        minWidth: "90px",
                        height: "85px",
                        background: selectedPaletteAsset === dec.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === dec.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src={`/assets/decor2/${dec.file}`} 
                          style={{ 
                            maxWidth: "100%", 
                            maxHeight: "100%", 
                            objectFit: "contain",
                            imageRendering: "pixelated" 
                          }} 
                          alt={dec.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "80px", textAlign: "center" }}>{dec.name}</span>
                    </div>
                  ))}
                </>
              )}
              {editorCategory === "gif" && (
                <>
                  {/* === Su Animasyonları: Taş, Tekne, Kano === */}
                  {[
                    { id: "stones_small_anim", name: "Küçük Taşlar", src: "/assets/editor/stones_anim.png",    fw: 48,  fh: 32,  previewW: 192, row: 0 },
                    { id: "stones_large_anim", name: "Büyük Taşlar", src: "/assets/editor/stones_anim.png",    fw: 48,  fh: 32,  previewW: 192, row: 1 },
                    { id: "wood_boat_anim",    name: "Tekne",        src: "/assets/editor/wood_boat_anim.png", fw: 176, fh: 112, previewW: 704 },
                    { id: "wood_canoe_anim",   name: "Kano",         src: "/assets/editor/wood_canoe_anim.png",fw: 32,  fh: 48,  previewW: 128 },
                  ].map((item) => (
                    <div key={item.id} onClick={() => setSelectedPaletteAsset(item.id)}
                      style={{ minWidth: "90px", height: "85px",
                        background: selectedPaletteAsset === item.id ? "rgba(0,210,211,0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === item.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", cursor: "pointer", boxSizing: "border-box", padding: "4px" }}
                    >
                      <div style={{ width: `${Math.min(item.fw,64)}px`, height: `${Math.min(item.fh,56)}px`, overflow: "hidden", background: "rgba(255,255,255,0.05)", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={item.src} style={{
                          width: `${item.previewW}px`,
                          height: item.row !== undefined ? `${item.fh * 2}px` : `${item.fh}px`,
                          marginTop: item.row !== undefined ? `-${item.row * item.fh}px` : "0px",
                          imageRendering: "pixelated",
                          flexShrink: 0
                        }} alt={item.id} />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px", textAlign: "center", color: selectedPaletteAsset === item.id ? "#00d2d3" : "#a4b0be" }}>{item.name}</span>
                    </div>
                  ))}

                  <div 
                    onClick={() => setSelectedPaletteAsset("wood")}
                    style={{
                      minWidth: "80px",
                      height: "85px",
                      background: selectedPaletteAsset === "wood" ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                      border: selectedPaletteAsset === "wood" ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ width: "24px", height: "24px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                      <img 
                        src="/assets/editor/wood.png" 
                        style={{ width: "96px", height: "24px", imageRendering: "pixelated" }} 
                        alt="wood"
                      />
                    </div>
                    <span style={{ fontSize: "9px", marginTop: "4px" }}>Wood (Anim)</span>
                  </div>

                  {[0, 1, 2, 3].map((idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedPaletteAsset(`well_${idx}`)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === `well_${idx}` ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === `well_${idx}` ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "32px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/well.png" 
                          style={{ 
                            width: "128px", 
                            height: "192px", 
                            marginLeft: "0px",
                            marginTop: `-${idx * 48}px`,
                            imageRendering: "pixelated" 
                          }} 
                          alt={`well_${idx}`}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px" }}>Kuyu (Tip {idx + 1})</span>
                    </div>
                  ))}

                  {[0, 1].map((idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedPaletteAsset(`fountain_${idx}`)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === `fountain_${idx}` ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === `fountain_${idx}` ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "48px", height: "64px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/fountain.png" 
                          style={{ 
                            width: "192px", 
                            height: "128px", 
                            marginLeft: "0px",
                            marginTop: `-${idx * 64}px`,
                            imageRendering: "pixelated" 
                          }} 
                          alt={`fountain_${idx}`}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px" }}>Fıskiye (Tip {idx + 1})</span>
                    </div>
                  ))}

                  {[0, 1, 2, 3].map((idx) => (
                    <div 
                      key={`tree_water_2_${idx}`}
                      onClick={() => setSelectedPaletteAsset(`tree_water_2_${idx}`)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === `tree_water_2_${idx}` ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === `tree_water_2_${idx}` ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "32px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/tree_water_2.png" 
                          style={{ 
                            width: "128px", 
                            height: "192px", 
                            marginLeft: "0px",
                            marginTop: `-${idx * 48}px`,
                            imageRendering: "pixelated" 
                          }} 
                          alt={`tree_water_2_${idx}`}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textAlign: "center" }}>Su Ağacı 2 (Tip {idx + 1})</span>
                    </div>
                  ))}

                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div 
                      key={`fish_point_${i}`}
                      onClick={() => setSelectedPaletteAsset(`fish_point_${i}`)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === `fish_point_${i}` ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === `fish_point_${i}` ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "16px", height: "16px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src={`/assets/editor/fish_point_${i}.png`} 
                          style={{ width: "64px", height: "16px", imageRendering: "pixelated" }} 
                          alt={`fish_point_${i}`}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px" }}>Balık {i}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "dekorasyon" && (
                <>
                  {[
                    { id: "dekor_tree_2", name: "Yeşil Ağaç", row: 0, col: 2 },
                    { id: "dekor_tree_5", name: "Turkuaz Ağaç", row: 1, col: 2 },
                    { id: "dekor_tree_8", name: "Koyu Turkuaz Ağaç", row: 2, col: 2 },
                    { id: "dekor_tree_11", name: "Pembe Ağaç", row: 3, col: 2 },
                    { id: "dekor_tree_14", name: "Mavi Ağaç", row: 4, col: 2 },
                    { id: "dekor_tree_15", name: "Çiçekli Açık Mavi", row: 5, col: 0 },
                    { id: "dekor_tree_16", name: "Çiçekli Pembe", row: 5, col: 1 },
                    { id: "dekor_tree_17", name: "Çiçekli Yeşil", row: 5, col: 2 }
                  ].map((tree) => (
                    <div 
                      key={tree.id}
                      onClick={() => setSelectedPaletteAsset(tree.id)}
                      style={{
                        minWidth: "90px",
                        height: "85px",
                        background: selectedPaletteAsset === tree.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === tree.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "32px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/Tree.png" 
                          style={{ 
                            width: "96px", 
                            height: "288px", 
                            marginLeft: `-${tree.col * 32}px`,
                            marginTop: `-${tree.row * 48}px`,
                            imageRendering: "pixelated" 
                          }} 
                          alt={tree.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "80px", textAlign: "center" }}>{tree.name}</span>
                    </div>
                  ))}
                  {[
                    { id: "construction_area", name: "İnşaat Alanı", file: "construction_area.png" },
                    { id: "newsstand", name: "Gazete Bayii", file: "newsstand.png" },
                    { id: "sawmill", name: "Hızar/Kereste", file: "sawmill.png" },
                    { id: "sharpening_station", name: "Bileme İstasyonu", file: "sharpening_station.png" },
                    { id: "telephone", name: "Telefon Kulübesi", file: "telephone.png" },
                    { id: "workbench", name: "Çalışma Tezgahı", file: "workbench.png" },
                    { id: "ice_cream_car", name: "Dondurma Arabası", file: "ice_cream_car.png" },
                    { id: "water_box", name: "Su Kutusu/Deposu", file: "water_box.png" }
                  ].map((dec) => (
                    <div 
                      key={dec.id}
                      onClick={() => setSelectedPaletteAsset(dec.id)}
                      style={{
                        minWidth: "90px",
                        height: "85px",
                        background: selectedPaletteAsset === dec.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === dec.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src={`/assets/editor/${dec.file}`} 
                          style={{ 
                            maxWidth: "100%", 
                            maxHeight: "100%", 
                            objectFit: "contain",
                            imageRendering: "pixelated" 
                          }} 
                          alt={dec.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "80px", textAlign: "center" }}>{dec.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "tree" && (
                <>
                  {[
                    { id: "maple_tree_0", name: "Küçük Yeşil", row: 0 },
                    { id: "maple_tree_1", name: "Büyük Yeşil", row: 1 },
                    { id: "maple_tree_2", name: "Sonbahar", row: 2 },
                    { id: "maple_tree_3", name: "Karlı Kış", row: 3 },
                    { id: "maple_tree_4", name: "Koyu Yeşil", row: 4 }
                  ].map((tree) => (
                    <div 
                      key={tree.id}
                      onClick={() => setSelectedPaletteAsset(tree.id)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === tree.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === tree.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "32px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/Maple Tree Animation.png" 
                          style={{ 
                            width: "128px", 
                            height: "336px", 
                            marginLeft: "0px",
                            marginTop: `-${tree.row * 48}px`,
                            imageRendering: "pixelated" 
                          }} 
                          alt={tree.id}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "70px", textAlign: "center" }}>{tree.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "plant" && (
                <>
                  {(() => {
                    const colors = ["Pembe-1", "Pembe-2", "Mavi", "Kırmızı", "Turkuaz"];
                    const stages = ["Fidan", "Gövde", "Çiçek"];
                    const list: any[] = [];
                    
                    // Land plants (static)
                    for (let c = 0; c < 5; c++) {
                      for (let s = 0; s < 3; s++) {
                        list.push({
                          id: `root_land_${c}_${s}`,
                          name: `${colors[c]} ${stages[s]} (Kara)`,
                          isWater: false,
                          colorIndex: c,
                          stageIndex: s
                        });
                      }
                    }
                    // Water plants (animated)
                    for (let c = 0; c < 5; c++) {
                      for (let s = 1; s <= 3; s++) {
                        list.push({
                          id: `root_water_${c}_${s}`,
                          name: `${colors[c]} ${stages[s-1]} (Su)`,
                          isWater: true,
                          colorIndex: c,
                          stageIndex: s
                        });
                      }
                    }

                    return list.map((plant) => (
                      <div 
                        key={plant.id}
                        onClick={() => setSelectedPaletteAsset(plant.id)}
                        style={{
                          minWidth: "100px",
                          height: "85px",
                          background: selectedPaletteAsset === plant.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                          border: selectedPaletteAsset === plant.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "6px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxSizing: "border-box",
                          padding: "4px"
                        }}
                      >
                        <div style={{ width: "32px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                          <img 
                            src={plant.isWater ? `/assets/su_animasyonu/Root Water ${plant.stageIndex}.png` : "/assets/su_animasyonu/Root.png"} 
                            style={{ 
                              width: plant.isWater ? "128px" : "96px", 
                              height: "240px", 
                              marginLeft: `-${(plant.isWater ? 0 : plant.stageIndex) * 32}px`,
                              marginTop: `-${plant.colorIndex * 48}px`,
                              imageRendering: "pixelated" 
                            }} 
                            alt={plant.id}
                          />
                        </div>
                        <span style={{ fontSize: "7.5px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "90px", textAlign: "center" }}>{plant.name}</span>
                      </div>
                    ));
                  })()}
                </>
              )}

              {editorCategory === "mine" && (
                <>
                  {[
                    // Row 2 (y=32), 16x16 sprites. Each col=16px.
                    // Skip col 3 (x=48, white) and col 9 (x=144, white)
                    { id: "mineral_mine_1", name: "Bakır",    sx: 0,   sy: 32 },
                    { id: "mineral_mine_2", name: "Gümüş",   sx: 16,  sy: 32 },
                    { id: "mineral_mine_3", name: "Altın",   sx: 32,  sy: 32 },
                    { id: "mineral_mine_4", name: "Ametist", sx: 64,  sy: 32 },
                    { id: "mineral_mine_5", name: "Yakut",   sx: 80,  sy: 32 },
                    { id: "mineral_mine_6", name: "Zümrüt",  sx: 96,  sy: 32 },
                    { id: "mineral_mine_7", name: "Safir",   sx: 112, sy: 32 },
                    { id: "mineral_mine_8", name: "Obsidyen",sx: 128, sy: 32 }
                  ].map((mine) => (
                    <div 
                      key={mine.id}
                      onClick={() => setSelectedPaletteAsset(mine.id)}
                      style={{
                        minWidth: "72px",
                        height: "75px",
                        background: selectedPaletteAsset === mine.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === mine.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "32px", height: "32px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(0,0,0,0.3)", borderRadius: "3px" }}>
                        <img 
                          src="/assets/editor/stone_with_minerals.png" 
                          style={{ 
                            width: "176px", 
                            height: "272px", 
                            marginLeft: `-${mine.sx * 2}px`,
                            marginTop: `-${mine.sy * 2}px`,
                            imageRendering: "pixelated",
                            transform: "scale(2)",
                            transformOrigin: "top left"
                          }} 
                          alt={mine.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "65px", textAlign: "center" }}>{mine.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "enemy" && (
                <>
                  {[
                    { id: "spawn_archer_goblin", name: "Okçu Goblin", src: "/assets/enemy/Goblins/Archer Goblin/Idle.png" },
                    { id: "spawn_bomb_goblin",   name: "Bombalı Goblin", src: "/assets/enemy/Goblins/Bomb Goblin/Idle bomb.png" },
                    { id: "spawn_spear_goblin",  name: "Mızraklı Goblin", src: "/assets/enemy/Goblins/Spear Goblin/Idle.png" },
                    { id: "spawn_blue_enemy",    name: "Mavi Canavar", src: "/assets/enemy/Blue/Idle.png" },
                    { id: "spawn_green_enemy",   name: "Yeşil Canavar", src: "/assets/enemy/Green/Idle.png" },
                    { id: "spawn_pink_myconid",  name: "Pembe Mantar", src: "/assets/enemy/Myconid/Pink/Idle.png" },
                    { id: "spawn_purple_myconid", name: "Mor Mantar", src: "/assets/enemy/Myconid/Purple/Idle.png" },
                    { id: "spawn_red_myconid",   name: "Kırmızı Mantar", src: "/assets/enemy/Myconid/Red/Idle.png" },
                    { id: "spawn_spike",         name: "Diken", src: "/assets/enemy/Spike/idle.png" }
                  ].map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedPaletteAsset(item.id)}
                      style={{
                        minWidth: "85px",
                        height: "85px",
                        background: selectedPaletteAsset === item.id ? "rgba(231, 76, 60, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === item.id ? "2px solid #e74c3c" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "32px", height: "32px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(0,0,0,0.3)", borderRadius: "3px" }}>
                        <img 
                          src={item.src} 
                          style={{ 
                            width: "128px", 
                            height: "96px", 
                            imageRendering: "pixelated",
                            transform: "scale(1)",
                            transformOrigin: "top left"
                          }} 
                          alt={item.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "75px", textAlign: "center", color: "#ff4757" }}>{item.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "merchant" && (
                <>
                  {[
                    { id: "spawn_goblin_merchant", name: "Tüccar Goblin (Market)", src: "/assets/enemy/Goblins/Goblin merchant/1.png" }
                  ].map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedPaletteAsset(item.id)}
                      style={{
                        minWidth: "95px",
                        height: "85px",
                        background: selectedPaletteAsset === item.id ? "rgba(241, 196, 15, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === item.id ? "2px solid #f1c40f" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        padding: "4px"
                      }}
                    >
                      <div style={{ width: "32px", height: "32px", overflow: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "rgba(0,0,0,0.3)", borderRadius: "3px" }}>
                        <img 
                          src={item.src} 
                          style={{ 
                            width: "384px", 
                            height: "64px", 
                            imageRendering: "pixelated",
                            transform: "scale(1)",
                            transformOrigin: "top left"
                          }} 
                          alt={item.id}
                        />
                      </div>
                      <span style={{ fontSize: "8px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "85px", textAlign: "center", color: "#f1c40f" }}>{item.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "ev" && (
                <>
                  {Array.from({ length: 27 }, (_, i) => i + 1).map((num) => (
                    <div 
                      key={`house_${num}`}
                      onClick={() => setSelectedPaletteAsset(`house_${num}`)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === `house_${num}` ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === `house_${num}` ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src={`/assets/editor/house_${num}.png`} 
                          style={{ 
                            maxWidth: "100%", 
                            maxHeight: "100%", 
                            objectFit: "contain",
                            imageRendering: "pixelated" 
                          }} 
                          alt={`house_${num}`}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px" }}>Ev {num}</span>
                    </div>
                  ))}
                  {[
                    { id: "indoor_barn_summer_full", name: "Yaz Ahırı", file: "indoor_barn_summer_full.png" },
                    { id: "indoor_barn_winter_full", name: "Kış Ahırı", file: "indoor_barn_winter_full.png" }
                  ].map((barn) => (
                    <div 
                      key={barn.id}
                      onClick={() => setSelectedPaletteAsset(barn.id)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === barn.id ? "rgba(0, 210, 211, 0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === barn.id ? "2px solid #00d2d3" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                        <img 
                          src={`/assets/editor/${barn.file}`} 
                          style={{ 
                            maxWidth: "100%", 
                            maxHeight: "100%", 
                            objectFit: "contain",
                            imageRendering: "pixelated" 
                          }} 
                          alt={barn.id}
                        />
                      </div>
                      <span style={{ fontSize: "9px", marginTop: "4px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", width: "70px" }}>{barn.name}</span>
                    </div>
                  ))}
                </>
              )}

              {editorCategory === "zemin" && (
                <>
                  <div 
                    onClick={() => setSelectedPaletteAsset("collision_block")}
                    style={{
                      minWidth: "120px",
                      height: "85px",
                      background: selectedPaletteAsset === "collision_block" ? "rgba(255, 71, 87, 0.2)" : "rgba(255,255,255,0.05)",
                      border: selectedPaletteAsset === "collision_block" ? "2px solid #ff4757" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ width: "48px", height: "48px", border: "2px dashed #ff4757", borderRadius: "4px", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,71,87,0.1)" }}>
                      <span style={{ fontSize: "20px" }}>🧱</span>
                    </div>
                    <span style={{ fontSize: "9px", marginTop: "4px", color: "#ff4757", fontWeight: "bold" }}>Görünmez Engel</span>
                  </div>

                  <div 
                    onClick={() => {
                      setSelectedPaletteAsset("tilled_soil_dry");
                      setSelectedTile(null);
                    }}
                    style={{
                      minWidth: "120px",
                      height: "85px",
                      background: selectedPaletteAsset === "tilled_soil_dry" ? "rgba(130, 90, 44, 0.3)" : "rgba(255,255,255,0.05)",
                      border: selectedPaletteAsset === "tilled_soil_dry" ? "2px solid #825a2c" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ width: "48px", height: "48px", border: "1.5px solid #5a3e1e", borderRadius: "4px", display: "flex", justifyContent: "center", alignItems: "center", background: "#825a2c" }}>
                      <span style={{ fontSize: "20px" }}>🟫</span>
                    </div>
                    <span style={{ fontSize: "9px", marginTop: "4px", color: "#825a2c", fontWeight: "bold" }}>Sürülmüş Toprak (Kuru)</span>
                  </div>

                  <div 
                    onClick={() => {
                      setSelectedPaletteAsset("tilled_soil_wet");
                      setSelectedTile(null);
                    }}
                    style={{
                      minWidth: "120px",
                      height: "85px",
                      background: selectedPaletteAsset === "tilled_soil_wet" ? "rgba(80, 55, 26, 0.3)" : "rgba(255,255,255,0.05)",
                      border: selectedPaletteAsset === "tilled_soil_wet" ? "2px solid #50371a" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ width: "48px", height: "48px", border: "1.5px solid #2d1f0e", borderRadius: "4px", display: "flex", justifyContent: "center", alignItems: "center", background: "#50371a" }}>
                      <span style={{ fontSize: "20px" }}>🟫</span>
                    </div>
                    <span style={{ fontSize: "9px", marginTop: "4px", color: "#50371a", fontWeight: "bold" }}>Sürülmüş Toprak (Nemli)</span>
                  </div>
                </>
              )}

              {editorCategory === "waterfall" && (() => {
                const WF_THEMES = [
                  { key: "summer", label: "☀️ Yaz", file: "Summer Waterfall.png" },
                  { key: "deepforest", label: "🌲 Derin Orman", file: "Deep Forest Waterfall.png" },
                  { key: "fall", label: "🍂 Sonbahar", file: "Fall Waterfall.png" },
                  { key: "spring", label: "🌸 İlkbahar", file: "Spring Waterfall.png" }
                ] as const;
                const themeObj = WF_THEMES.find(t => t.key === wfTheme) ?? WF_THEMES[0];
                const imgSrc = `/assets/waterfall/${themeObj.file}`;
                // Image is 512x128, tiles are 16x16. Display at 2x = 32px per tile
                const TILE = wfGridSize; // 16 or 32
                const DISPLAY_SCALE = 2; // each 16px tile shown as 32px
                const COLS = 512 / TILE; // 32 or 16 per row
                const ROWS = 4; // only top half (rows 0-3 = frame 1)
                const IMG_W = 512;
                const DISPLAYED_TILE = TILE * DISPLAY_SCALE;
                return (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {/* Theme selector */}
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {WF_THEMES.map(t => (
                        <button
                          key={t.key}
                          onClick={() => { setWfTheme(t.key); setWfSelectedTile(null); setSelectedPaletteAsset("zemin_tileset"); }}
                          style={{
                            fontSize: "8px", padding: "3px 6px", cursor: "pointer",
                            background: wfTheme === t.key ? "rgba(0,120,255,0.3)" : "#2f3542",
                            border: wfTheme === t.key ? "1px solid #54a0ff" : "1px solid #747d8c",
                            color: wfTheme === t.key ? "#54a0ff" : "white",
                            borderRadius: "4px"
                          }}
                        >{t.label}</button>
                      ))}
                    </div>

                    {/* Options row */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {([16, 32] as const).map(sz => (
                          <button
                            key={sz}
                            onClick={() => { setWfGridSize(sz); setWfSelectedTile(null); setSelectedPaletteAsset("zemin_tileset"); }}
                            style={{
                              fontSize: "8px", padding: "3px 6px", cursor: "pointer",
                              background: wfGridSize === sz ? "rgba(0,210,211,0.2)" : "#2f3542",
                              border: wfGridSize === sz ? "1px solid #00d2d3" : "1px solid #747d8c",
                              color: wfGridSize === sz ? "#00d2d3" : "white",
                              borderRadius: "4px"
                            }}
                          >{sz}×{sz}</button>
                        ))}
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px", cursor: "pointer", color: wfAnimated ? "#54a0ff" : "#a4b0be" }}>
                        <input
                          type="checkbox"
                          checked={wfAnimated}
                          onChange={e => setWfAnimated(e.target.checked)}
                        />
                        💧 Animasyonlu
                      </label>
                    </div>

                    {/* Selected tile info */}
                    {wfSelectedTile && (
                      <div style={{ fontSize: "8px", padding: "4px 6px", background: "rgba(0,120,255,0.15)", border: "1px solid #54a0ff", borderRadius: "4px", color: "#54a0ff" }}>
                        ✅ Seçili: Sütun {wfSelectedTile.col}, Satır {wfSelectedTile.row} — {wfGridSize}×{wfGridSize}px
                        {wfAnimated && wfSelectedTile.row < 2 ? " (Akan Su 💧)" : " (Statik)"}
                      </div>
                    )}

                    {/* Unity-style tile picker */}
                    <div style={{ fontSize: "8px", color: "#a4b0be", marginBottom: "2px" }}>🎨 Tile Seç (tıkla yerleştir):</div>
                    <div
                      style={{
                        position: "relative",
                        width: `${COLS * DISPLAYED_TILE}px`,
                        maxWidth: "288px",
                        overflowX: "auto",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        cursor: "crosshair",
                        flexShrink: 0
                      }}
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        const col = Math.floor(clickX / DISPLAYED_TILE);
                        const row = Math.floor(clickY / DISPLAYED_TILE);
                        if (col >= COLS || row >= ROWS) return;

                        setWfSelectedTile({ col, row });

                        // Build assetId: wf_{theme}_{tileX}_{tileY}_{tileW}_{tileH}_{animated}
                        const animated = wfAnimated && row < 2 ? 1 : 0;
                        const assetId = `wf_${wfTheme}_${col}_${row}_${TILE}_${TILE}_${animated}`;
                        setSelectedPaletteAsset(assetId);
                        // Tell editor we now have a "tile" selected (for placement)
                        setSelectedTile({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });
                      }}
                    >
                      {/* The actual spritesheet image, only top half (rows 0-3) shown */}
                      <img
                        src={imgSrc}
                        style={{
                          display: "block",
                          width: `${IMG_W * DISPLAY_SCALE}px`,
                          height: `${128 * DISPLAY_SCALE}px`, // full 128px shown (8 rows)
                          imageRendering: "pixelated",
                          clipPath: `inset(0 0 ${128 * DISPLAY_SCALE / 2}px 0)`, // only top half
                          marginBottom: `-${128 * DISPLAY_SCALE / 2}px` // collapse bottom
                        }}
                        alt="waterfall tileset"
                      />
                      {/* Grid overlay */}
                      <svg
                        style={{
                          position: "absolute",
                          top: 0, left: 0,
                          width: `${COLS * DISPLAYED_TILE}px`,
                          height: `${ROWS * DISPLAYED_TILE}px`,
                          pointerEvents: "none"
                        }}
                        viewBox={`0 0 ${COLS * DISPLAYED_TILE} ${ROWS * DISPLAYED_TILE}`}
                      >
                        {/* Vertical grid lines */}
                        {Array.from({ length: COLS + 1 }, (_, i) => (
                          <line key={`v${i}`} x1={i * DISPLAYED_TILE} y1={0} x2={i * DISPLAYED_TILE} y2={ROWS * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                        ))}
                        {/* Horizontal grid lines */}
                        {Array.from({ length: ROWS + 1 }, (_, i) => (
                          <line key={`h${i}`} x1={0} y1={i * DISPLAYED_TILE} x2={COLS * DISPLAYED_TILE} y2={i * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                        ))}
                        {/* Animate row separator (rows 0-1 animate, rows 2-3 static) */}
                        <line x1={0} y1={2 * DISPLAYED_TILE} x2={COLS * DISPLAYED_TILE} y2={2 * DISPLAYED_TILE} stroke="#54a0ff" strokeWidth="1" strokeDasharray="4 2" />
                        {/* Selected tile highlight */}
                        {wfSelectedTile && (
                          <rect
                            x={wfSelectedTile.col * DISPLAYED_TILE}
                            y={wfSelectedTile.row * DISPLAYED_TILE}
                            width={DISPLAYED_TILE}
                            height={DISPLAYED_TILE}
                            fill="rgba(84,160,255,0.35)"
                            stroke="#54a0ff"
                            strokeWidth="1.5"
                          />
                        )}
                      </svg>
                    </div>
                    {/* Legend */}
                    <div style={{ fontSize: "7px", color: "#a4b0be", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ color: "#54a0ff" }}>━━ Mavi çizgi: Üst = Akan Su (animasyonlu) / Alt = Kaya/Kıyı (statik)</span>
                      <span>• Yerleştirmek için tile seç → haritaya tıkla/sürükle</span>
                    </div>
                  </div>
                );
              })()}

              {editorCategory === "box" && (() => {
                const imgSrc = "/assets/tileset/Box.png";
                const TILE = 16;
                const DISPLAY_SCALE = 2; 
                const COLS = 9; 
                const ROWS = 20; 
                const IMG_W = 144;
                const DISPLAYED_TILE = TILE * DISPLAY_SCALE;
                return (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {boxSelectedTile && (
                      <div style={{ fontSize: "8px", padding: "4px 6px", background: "rgba(0,184,217,0.15)", border: "1px solid #00b8d9", borderRadius: "4px", color: "#00b8d9" }}>
                        ✅ Seçili: Sütun {boxSelectedTile.col}, Satır {boxSelectedTile.row} — 16×16px
                      </div>
                    )}

                    <div style={{ fontSize: "8px", color: "#a4b0be", marginBottom: "2px" }}>🎨 Kutu/Kasa Seç (tıkla yerleştir):</div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "250px",
                        overflowY: "auto",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        cursor: "crosshair",
                        background: "rgba(0,0,0,0.25)"
                      }}
                      onClick={(e) => {
                        const container = e.currentTarget as HTMLDivElement;
                        const rect = container.getBoundingClientRect();
                        const clickX = e.clientX - rect.left + container.scrollLeft;
                        const clickY = e.clientY - rect.top + container.scrollTop;
                        const col = Math.floor(clickX / DISPLAYED_TILE);
                        const row = Math.floor(clickY / DISPLAYED_TILE);
                        if (col >= COLS || row >= ROWS) return;

                        setBoxSelectedTile({ col, row });

                        const assetId = `terrain_box_dekor_${col}_${row}_${TILE}_${TILE}`;
                        setSelectedPaletteAsset(assetId);
                        setSelectedTile({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });
                      }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, width: `${COLS * DISPLAYED_TILE}px`, height: `${ROWS * DISPLAYED_TILE}px` }}>
                        <img
                          src={imgSrc}
                          style={{
                            display: "block",
                            width: `${IMG_W * DISPLAY_SCALE}px`,
                            height: `${320 * DISPLAY_SCALE}px`,
                            imageRendering: "pixelated"
                          }}
                          alt="box tileset"
                        />
                        {/* Grid overlay */}
                        <svg
                          style={{
                            position: "absolute",
                            top: 0, left: 0,
                            width: `${COLS * DISPLAYED_TILE}px`,
                            height: `${ROWS * DISPLAYED_TILE}px`,
                            pointerEvents: "none"
                          }}
                          viewBox={`0 0 ${COLS * DISPLAYED_TILE} ${ROWS * DISPLAYED_TILE}`}
                        >
                          {Array.from({ length: COLS + 1 }, (_, i) => (
                            <line key={`v${i}`} x1={i * DISPLAYED_TILE} y1={0} x2={i * DISPLAYED_TILE} y2={ROWS * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {Array.from({ length: ROWS + 1 }, (_, i) => (
                            <line key={`h${i}`} x1={0} y1={i * DISPLAYED_TILE} x2={COLS * DISPLAYED_TILE} y2={i * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {boxSelectedTile && (
                            <rect
                              x={boxSelectedTile.col * DISPLAYED_TILE}
                              y={boxSelectedTile.row * DISPLAYED_TILE}
                              width={DISPLAYED_TILE}
                              height={DISPLAYED_TILE}
                              fill="rgba(0,184,217,0.35)"
                              stroke="#00b8d9"
                              strokeWidth="1.5"
                            />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {editorCategory === "trunks" && (() => {
                const imgSrc = "/assets/tileset/TreeTrunks.png";
                const TILE_W = 32;
                const TILE_H = 16;
                const DISPLAY_SCALE = 2; 
                const COLS = 4; 
                const ROWS = 2; 
                const IMG_W = 128;
                const DISPLAYED_W = TILE_W * DISPLAY_SCALE;
                const DISPLAYED_H = TILE_H * DISPLAY_SCALE;
                return (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {trunksSelectedTile && (
                      <div style={{ fontSize: "8px", padding: "4px 6px", background: "rgba(230,126,34,0.15)", border: "1px solid #e67e22", borderRadius: "4px", color: "#f39c12" }}>
                        ✅ Seçili: Sütun {trunksSelectedTile.col}, Satır {trunksSelectedTile.row} — 32×16px
                      </div>
                    )}

                    <div style={{ fontSize: "8px", color: "#a4b0be", marginBottom: "2px" }}>🎨 Kütük Seç (tıkla yerleştir):</div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100px",
                        overflowY: "auto",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        cursor: "crosshair",
                        background: "rgba(0,0,0,0.25)"
                      }}
                      onClick={(e) => {
                        const container = e.currentTarget as HTMLDivElement;
                        const rect = container.getBoundingClientRect();
                        const clickX = e.clientX - rect.left + container.scrollLeft;
                        const clickY = e.clientY - rect.top + container.scrollTop;
                        const col = Math.floor(clickX / DISPLAYED_W);
                        const row = Math.floor(clickY / DISPLAYED_H);
                        if (col >= COLS || row >= ROWS) return;

                        setTrunksSelectedTile({ col, row });

                        const assetId = `terrain_tree_trunks_${col}_${row}_${TILE_W}_${TILE_H}`;
                        setSelectedPaletteAsset(assetId);
                        setSelectedTile({ x: col * TILE_W, y: row * TILE_H, w: TILE_W, h: TILE_H });
                      }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, width: `${COLS * DISPLAYED_W}px`, height: `${ROWS * DISPLAYED_H}px` }}>
                        <img
                          src={imgSrc}
                          style={{
                            display: "block",
                            width: `${IMG_W * DISPLAY_SCALE}px`,
                            height: `${32 * DISPLAY_SCALE}px`,
                            imageRendering: "pixelated"
                          }}
                          alt="tree trunks tileset"
                        />
                        {/* Grid overlay */}
                        <svg
                          style={{
                            position: "absolute",
                            top: 0, left: 0,
                            width: `${COLS * DISPLAYED_W}px`,
                            height: `${ROWS * DISPLAYED_H}px`,
                            pointerEvents: "none"
                          }}
                          viewBox={`0 0 ${COLS * DISPLAYED_W} ${ROWS * DISPLAYED_H}`}
                        >
                          {Array.from({ length: COLS + 1 }, (_, i) => (
                            <line key={`v${i}`} x1={i * DISPLAYED_W} y1={0} x2={i * DISPLAYED_W} y2={ROWS * DISPLAYED_H} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {Array.from({ length: ROWS + 1 }, (_, i) => (
                            <line key={`h${i}`} x1={0} y1={i * DISPLAYED_H} x2={COLS * DISPLAYED_W} y2={i * DISPLAYED_H} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {trunksSelectedTile && (
                            <rect
                              x={trunksSelectedTile.col * DISPLAYED_W}
                              y={trunksSelectedTile.row * DISPLAYED_H}
                              width={DISPLAYED_W}
                              height={DISPLAYED_H}
                              fill="rgba(230,126,34,0.35)"
                              stroke="#e67e22"
                              strokeWidth="1.5"
                            />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {editorCategory === "big_old_tree" && (() => {
                const imgSrc = "/assets/tileset/BigOldTree.png";
                const TILE = 16;
                const DISPLAY_SCALE = 2; 
                const COLS = 8; 
                const ROWS = 10; 
                const IMG_W = 128;
                const DISPLAYED_TILE = TILE * DISPLAY_SCALE;
                return (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {treeSelectedTile && (
                      <div style={{ fontSize: "8px", padding: "4px 6px", background: "rgba(46,204,113,0.15)", border: "1px solid #2ecc71", borderRadius: "4px", color: "#2ecc71" }}>
                        ✅ Seçili: Sütun {treeSelectedTile.col}, Satır {treeSelectedTile.row} — 16×16px
                      </div>
                    )}

                    <div style={{ fontSize: "8px", color: "#a4b0be", marginBottom: "2px" }}>🎨 Koca Ağaç Parçası Seç (tıkla yerleştir):</div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "220px",
                        overflowY: "auto",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        cursor: "crosshair",
                        background: "rgba(0,0,0,0.25)"
                      }}
                      onClick={(e) => {
                        const container = e.currentTarget as HTMLDivElement;
                        const rect = container.getBoundingClientRect();
                        const clickX = e.clientX - rect.left + container.scrollLeft;
                        const clickY = e.clientY - rect.top + container.scrollTop;
                        const col = Math.floor(clickX / DISPLAYED_TILE);
                        const row = Math.floor(clickY / DISPLAYED_TILE);
                        if (col >= COLS || row >= ROWS) return;

                        setTreeSelectedTile({ col, row });

                        const assetId = `terrain_big_old_tree_${col}_${row}_${TILE}_${TILE}`;
                        setSelectedPaletteAsset(assetId);
                        setSelectedTile({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });
                      }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, width: `${COLS * DISPLAYED_TILE}px`, height: `${ROWS * DISPLAYED_TILE}px` }}>
                        <img
                          src={imgSrc}
                          style={{
                            display: "block",
                            width: `${IMG_W * DISPLAY_SCALE}px`,
                            height: `${160 * DISPLAY_SCALE}px`,
                            imageRendering: "pixelated"
                          }}
                          alt="big old tree tileset"
                        />
                        {/* Grid overlay */}
                        <svg
                          style={{
                            position: "absolute",
                            top: 0, left: 0,
                            width: `${COLS * DISPLAYED_TILE}px`,
                            height: `${ROWS * DISPLAYED_TILE}px`,
                            pointerEvents: "none"
                          }}
                          viewBox={`0 0 ${COLS * DISPLAYED_TILE} ${ROWS * DISPLAYED_TILE}`}
                        >
                          {Array.from({ length: COLS + 1 }, (_, i) => (
                            <line key={`v${i}`} x1={i * DISPLAYED_TILE} y1={0} x2={i * DISPLAYED_TILE} y2={ROWS * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {Array.from({ length: ROWS + 1 }, (_, i) => (
                            <line key={`h${i}`} x1={0} y1={i * DISPLAYED_TILE} x2={COLS * DISPLAYED_TILE} y2={i * DISPLAYED_TILE} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {treeSelectedTile && (
                            <rect
                              x={treeSelectedTile.col * DISPLAYED_TILE}
                              y={treeSelectedTile.row * DISPLAYED_TILE}
                              width={DISPLAYED_TILE}
                              height={DISPLAYED_TILE}
                              fill="rgba(46,204,113,0.35)"
                              stroke="#2ecc71"
                              strokeWidth="1.5"
                            />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {editorCategory === "yon" && (
                <>
                  {[
                    { id: "yon_yukari",  label: "Yukarı ↑",  file: "yon/yon_yukari.png"  },
                    { id: "yon_asagi",   label: "Aşağı ↓",   file: "yon/yon_asagi.png"   },
                    { id: "yon_sag",     label: "Sağ →",     file: "yon/yon_sag.png"     },
                    { id: "yon_sol",     label: "Sol ←",     file: "yon/yon_sol.png"     },
                  ].map((arrow) => (
                    <div
                      key={arrow.id}
                      onClick={() => setSelectedPaletteAsset(arrow.id)}
                      style={{
                        minWidth: "80px",
                        height: "85px",
                        background: selectedPaletteAsset === arrow.id ? "rgba(0,184,217,0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedPaletteAsset === arrow.id ? "2px solid #00b8d9" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        gap: "4px",
                      }}
                    >
                      <div style={{ width: "48px", height: "48px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: "3px" }}>
                        <img
                          src={`/assets/${arrow.file}`}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          alt={arrow.label}
                        />
                      </div>
                      <span style={{ fontSize: "9px", color: selectedPaletteAsset === arrow.id ? "#00b8d9" : "#a4b0be" }}>{arrow.label}</span>
                    </div>
                  ))}
                </>
              )}
              {editorCategory === "bushes" && (() => {
                const imgSrc = "/assets/tileset/Bushes.png";
                const TILE_W = 48;
                const TILE_H = 32;
                const DISPLAY_SCALE = 2; 
                const COLS = 3; 
                const ROWS = 9; 
                const IMG_W = 144;
                const DISPLAYED_W = TILE_W * DISPLAY_SCALE;
                const DISPLAYED_H = TILE_H * DISPLAY_SCALE;
                return (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {bushesSelectedTile && (
                      <div style={{ fontSize: "8px", padding: "4px 6px", background: "rgba(26,188,156,0.15)", border: "1px solid #1abc9c", borderRadius: "4px", color: "#1abc9c" }}>
                        ✅ Seçili: Sütun {bushesSelectedTile.col}, Satır {bushesSelectedTile.row} — 48×32px
                      </div>
                    )}

                    <div style={{ fontSize: "8px", color: "#a4b0be", marginBottom: "2px" }}>🎨 Çalı Seç (tıkla yerleştir):</div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "220px",
                        overflowY: "auto",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        cursor: "crosshair",
                        background: "rgba(0,0,0,0.25)"
                      }}
                      onClick={(e) => {
                        const container = e.currentTarget as HTMLDivElement;
                        const rect = container.getBoundingClientRect();
                        const clickX = e.clientX - rect.left + container.scrollLeft;
                        const clickY = e.clientY - rect.top + container.scrollTop;
                        const col = Math.floor(clickX / DISPLAYED_W);
                        const row = Math.floor(clickY / DISPLAYED_H);
                        if (col >= COLS || row >= ROWS) return;

                        setBushesSelectedTile({ col, row });

                        const assetId = `terrain_bushes_${col}_${row}_${TILE_W}_${TILE_H}`;
                        setSelectedPaletteAsset(assetId);
                        setSelectedTile({ x: col * TILE_W, y: row * TILE_H, w: TILE_W, h: TILE_H });
                      }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, width: `${COLS * DISPLAYED_W}px`, height: `${ROWS * DISPLAYED_H}px` }}>
                        <img
                          src={imgSrc}
                          style={{
                            display: "block",
                            width: `${IMG_W * DISPLAY_SCALE}px`,
                            height: `${288 * DISPLAY_SCALE}px`,
                            imageRendering: "pixelated"
                          }}
                          alt="bushes tileset"
                        />
                        {/* Grid overlay */}
                        <svg
                          style={{
                            position: "absolute",
                            top: 0, left: 0,
                            width: `${COLS * DISPLAYED_W}px`,
                            height: `${ROWS * DISPLAYED_H}px`,
                            pointerEvents: "none"
                          }}
                          viewBox={`0 0 ${COLS * DISPLAYED_W} ${ROWS * DISPLAYED_H}`}
                        >
                          {Array.from({ length: COLS + 1 }, (_, i) => (
                            <line key={`v${i}`} x1={i * DISPLAYED_W} y1={0} x2={i * DISPLAYED_W} y2={ROWS * DISPLAYED_H} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {Array.from({ length: ROWS + 1 }, (_, i) => (
                            <line key={`h${i}`} x1={0} y1={i * DISPLAYED_H} x2={COLS * DISPLAYED_W} y2={i * DISPLAYED_H} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                          ))}
                          {bushesSelectedTile && (
                            <rect
                              x={bushesSelectedTile.col * DISPLAYED_W}
                              y={bushesSelectedTile.row * DISPLAYED_H}
                              width={DISPLAYED_W}
                              height={DISPLAYED_H}
                              fill="rgba(26,188,156,0.35)"
                              stroke="#1abc9c"
                              strokeWidth="1.5"
                            />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })()}



            </div>
          </div>

          {/* Selected Object Properties panel */}
          {selectedObject && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#00d2d3", display: "flex", justifyContent: "space-between" }}>
                <span>SEÇİLEN NESNE AYARLARI</span>
                <button 
                  onClick={() => {
                    if (room) {
                      setUndoStack((prev: any[]) => [...prev, { type: "delete", id: selectedObject.id, data: { ...selectedObject } }]);
                      room.send("delete_object", { id: selectedObject.id });
                      setSelectedObject(null);
                    }
                  }}
                  style={{ background: "transparent", border: "none", color: "#ff4757", cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}
                >
                  🗑️ NESNEYİ SİL
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "#ced6e0", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div>NESNE ID: <span style={{ fontFamily: "monospace" }}>{selectedObject.id}</span></div>
                <div>Nesne Türü: {(() => {
                  const aid = selectedObject.assetId;
                  if (aid === "spawn_archer_goblin") return "Okçu Goblin Doğma Noktası";
                  if (aid === "spawn_bomb_goblin") return "Bombalı Goblin Doğma Noktası";
                  if (aid === "spawn_spear_goblin") return "Mızraklı Goblin Doğma Noktası";
                  if (aid === "spawn_blue_enemy") return "Mavi Canavar Doğma Noktası";
                  if (aid === "spawn_green_enemy") return "Yeşil Canavar Doğma Noktası";
                  if (aid === "spawn_pink_myconid") return "Pembe Mantar Doğma Noktası";
                  if (aid === "spawn_purple_myconid") return "Mor Mantar Doğma Noktası";
                  if (aid === "spawn_red_myconid") return "Kırmızı Mantar Doğma Noktası";
                  if (aid === "spawn_spike") return "Diken Doğma Noktası";
                  if (aid === "wood") return "Ahşap (Animasyonlu)";
                  if (aid === "maple_tree_0") return "Küçük Yeşil Akçaağaç";
                  if (aid === "maple_tree_1") return "Büyük Yeşil Akçaağaç";
                  if (aid === "maple_tree_2") return "Sonbahar Akçaağacı";
                  if (aid === "maple_tree_3") return "Karlı Kış Akçaağacı";
                  if (aid === "maple_tree_4") return "Koyu Yeşil Akçaağaç";
                  if (aid.startsWith("well_")) return `Su Kuyusu (Tip ${parseInt(aid.split("_")[1], 10) + 1})`;
                  if (aid.startsWith("fountain_")) return `Su Fıskiyesi (Tip ${parseInt(aid.split("_")[1], 10) + 1})`;
                  if (aid.startsWith("house_")) return `Ev (Tip ${parseInt(aid.split("_")[1], 10)})`;
                  if (aid === "indoor_deluxe_barn") return "Lüks Ahır (Tüm Şablon)";
                  if (aid.startsWith("root_land_")) {
                    const parts = aid.split("_");
                    const colors = ["Pembe-1", "Pembe-2", "Mavi", "Kırmızı", "Turkuaz"];
                    const stages = ["Fidan", "Gövde", "Çiçek"];
                    return `${colors[parseInt(parts[2], 10) || 0]} ${stages[parseInt(parts[3], 10) || 0]} (Kara)`;
                  }
                  if (aid.startsWith("root_water_")) {
                    const parts = aid.split("_");
                    const colors = ["Pembe-1", "Pembe-2", "Mavi", "Kırmızı", "Turkuaz"];
                    const stages = ["Fidan", "Gövde", "Çiçek"];
                    return `${colors[parseInt(parts[2], 10) || 0]} ${stages[(parseInt(parts[3], 10) || 1) - 1]} (Su)`;
                  }
                  if (aid.startsWith("dekor_tree_")) {
                    const idx = parseInt(aid.replace("dekor_tree_", ""), 10) || 0;
                    const names: { [key: number]: string } = {
                      2: "Büyük Yeşil Dekoratif Ağaç",
                      5: "Büyük Turkuaz Dekoratif Ağaç",
                      8: "Büyük Koyu Turkuaz Dekoratif Ağaç",
                      11: "Büyük Pembe Dekoratif Ağaç",
                      14: "Büyük Mavi Dekoratif Ağaç",
                      15: "Büyük Çiçekli Açık Mavi Dekoratif Ağaç",
                      16: "Büyük Çiçekli Pembe Dekoratif Ağaç",
                      17: "Büyük Çiçekli Yeşil Dekoratif Ağaç"
                    };
                    return names[idx] || `Dekoratif Ağaç (Tip ${idx})`;
                  }
                  if (aid.startsWith("mineral_mine_")) {
                    const idx = parseInt(aid.replace("mineral_mine_", ""), 10) || 1;
                    const names: { [key: number]: string } = {
                      1: "Bakır Cevheri",
                      2: "Gümüş Cevheri",
                      3: "Altın Cevheri",
                      4: "Ametist Cevheri",
                      5: "Yakut Cevheri",
                      6: "Zümrüt Cevheri",
                      7: "Safir Cevheri",
                      8: "Obsidyen Cevheri"
                    };
                    return names[idx] || `Maden (Tip ${idx})`;
                  }
                  
                  const translations: { [key: string]: string } = {
                    construction_area: "İnşaat Alanı",
                    newsstand: "Gazete Bayii",
                    sawmill: "Hızar/Kereste İstasyonu",
                    sharpening_station: "Bileme İstasyonu",
                    telephone: "Telefon Kulübesi",
                    workbench: "Çalışma Tezgahı",
                    ice_cream_car: "Dondurma Arabası",
                    water_box: "Su Kutusu/Deposu",
                    indoor_barn_summer_full: "Lüks Ahır (Yaz - Dış)",
                    indoor_barn_summer_frame: "Lüks Ahır (Yaz - İç/Zemin)",
                    indoor_barn_roof_blue: "Mavi Çatı (Üst)",
                    indoor_barn_roof_red: "Kırmızı Çatı (Üst)",
                    indoor_barn_roof_grey: "Gri Çatı (Üst)",
                    indoor_barn_roof_brown: "Kahverengi Çatı (Üst)",
                    indoor_barn_wall_red: "Kırmızı Arka Duvar",
                    indoor_barn_wall_beige: "Krem Arka Duvar",
                    indoor_barn_wall_white: "Beyaz Arka Duvar",
                    indoor_barn_wall_brown: "Kahve Arka Duvar",
                    indoor_barn_winter_full: "Lüks Ahır (Kış - Dış)",
                    indoor_barn_winter_frame: "Lüks Ahır (Kış - İç/Zemin)",
                    indoor_barn_pole: "Yapı Kolonu/Direği",
                    indoor_barn_winter_roof_left: "Kışlık Çatı Sol",
                    indoor_barn_winter_roof_right: "Kışlık Çatı Sağ"
                  };
                  if (aid === "spawn_animal_chicken_black_white") return "🐔 Siyah-Beyaz Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_black") return "🐔 Siyah Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_blonde_green") return "🐔 Sarı-Yeşil Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_blonde") return "🐔 Sarı Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_brown_black") return "🐔 Kahve-Siyah Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_brown_white") return "🐔 Kahverengi Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_evil") return "😈 Hain Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_full") return "🐔 Kızıl Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_green") return "🐔 Yeşil Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_pink") return "🐔 Pembe Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_red") return "🐔 Kırmızı Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_universe") return "🌌 Evrensel Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_chicken_white") return "🐔 Beyaz Tavuk Doğma Noktası";
                  if (aid === "spawn_animal_cow_black") return "🐄 Siyah İnek Doğma Noktası";
                  if (aid === "spawn_animal_cow_blonde") return "🐄 Sarı İnek Doğma Noktası";
                  if (aid === "spawn_animal_cow_brown") return "🐄 Kahverengi İnek Doğma Noktası";
                  if (aid === "spawn_animal_cow_pink") return "🐄 Pembe İnek Doğma Noktası";
                  if (aid === "spawn_animal_sheep_white") return "🐑 Beyaz Koyun Doğma Noktası";
                  if (aid === "spawn_animal_sheep_spotted") return "🐑 Kıvırcık Koyun Doğma Noktası";
                  if (aid === "spawn_animal_pig_baby_mud") return "🐖 Çamurlu Yavru Domuz Doğma Noktası";
                  if (aid === "spawn_animal_pig_baby") return "🐖 Yavru Domuz Doğma Noktası";
                  if (aid === "spawn_animal_pig_mud") return "🐖 Çamurlu Domuz Doğma Noktası";
                  if (aid === "spawn_animal_pig_pink") return "🐖 Pembe Domuz Doğma Noktası";
                  if (translations[aid]) return translations[aid];
                  if (aid.startsWith("indoor_")) return `İç Mekan (${aid.split("_").slice(1).join(" ")})`;
                  return aid;
                })()}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span>X: {Math.round(selectedObject.x)}</span>
                  <span>Y: {Math.round(selectedObject.y)}</span>
                </div>
              </div>

              {/* Transform Operations */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    onClick={() => {
                      if (room) {
                        const oldRot = selectedObject.rotation || 0;
                        const newRot = (oldRot + 90) % 360;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { rotation: oldRot }, newData: { rotation: newRot } }]);
                        room.send("update_object", { id: selectedObject.id, rotation: newRot });
                        setSelectedObject((prev: any) => prev ? { ...prev, rotation: newRot } : null);
                      }
                    }}
                    className="editor-btn-small"
                    style={{ flex: 1 }}
                  >
                    🔄 90° Döndür
                  </button>
                  <button 
                    onClick={() => {
                      if (room) {
                        const oldFx = Boolean(selectedObject.flipX);
                        const newFx = !oldFx;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { flipX: oldFx }, newData: { flipX: newFx } }]);
                        room.send("update_object", { id: selectedObject.id, flipX: newFx });
                        setSelectedObject((prev: any) => prev ? { ...prev, flipX: newFx } : null);
                      }
                    }}
                    className="editor-btn-small"
                    style={{ flex: 1 }}
                  >
                    ↔️ Yatay Çevir
                  </button>
                  <button 
                    onClick={() => {
                      if (room) {
                        const oldFy = Boolean(selectedObject.flipY);
                        const newFy = !oldFy;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { flipY: oldFy }, newData: { flipY: newFy } }]);
                        room.send("update_object", { id: selectedObject.id, flipY: newFy });
                        setSelectedObject((prev: any) => prev ? { ...prev, flipY: newFy } : null);
                      }
                    }}
                    className="editor-btn-small"
                    style={{ flex: 1 }}
                  >
                    ↕️ Dikey Çevir
                  </button>
                </div>

                {/* Scale Sliders */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                    <span>Genişlik Ölçeği (Scale X):</span>
                    <span>{Number(selectedObject.scaleX || 1).toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5.0" 
                    step="0.1"
                    value={selectedObject.scaleX || 1} 
                    onChange={(e) => {
                      if (room) {
                        const newScaleX = parseFloat(e.target.value);
                        room.send("update_object", { id: selectedObject.id, scaleX: newScaleX });
                        setSelectedObject((prev: any) => prev ? { ...prev, scaleX: newScaleX } : null);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                    <span>Yükseklik Ölçeği (Scale Y):</span>
                    <span>{Number(selectedObject.scaleY || 1).toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5.0" 
                    step="0.1"
                    value={selectedObject.scaleY || 1} 
                    onChange={(e) => {
                      if (room) {
                        const newScaleY = parseFloat(e.target.value);
                        room.send("update_object", { id: selectedObject.id, scaleY: newScaleY });
                        setSelectedObject((prev: any) => prev ? { ...prev, scaleY: newScaleY } : null);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                {/* Animation Speed (Only for animated/wood/well/fountain assets) */}
                {(selectedObject.assetId === "wood" || selectedObject.assetId.startsWith("well_") || selectedObject.assetId.startsWith("fountain_")) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                      <span>Animasyon Hızı (fps):</span>
                      <span>{selectedObject.frameRate !== undefined ? selectedObject.frameRate : 6} fps</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="30" 
                      step="1"
                      value={selectedObject.frameRate !== undefined ? selectedObject.frameRate : 6} 
                      onChange={(e) => {
                        if (room) {
                          const newFPS = parseInt(e.target.value, 10);
                          room.send("update_object", { id: selectedObject.id, frameRate: newFPS });
                          setSelectedObject((prev: any) => prev ? { ...prev, frameRate: newFPS } : null);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </div>
                )}

                {/* Solidity Checkbox */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", marginTop: "4px" }}>
                  <input 
                    type="checkbox" 
                    checked={Boolean(selectedObject.isSolid)} 
                    onChange={(e) => {
                      if (room) {
                        const oldSolid = Boolean(selectedObject.isSolid);
                        const newSolid = e.target.checked;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { isSolid: oldSolid }, newData: { isSolid: newSolid } }]);
                        room.send("update_object", { id: selectedObject.id, isSolid: newSolid });
                        setSelectedObject((prev: any) => prev ? { ...prev, isSolid: newSolid } : null);
                      }
                    }}
                  />
                  Engel Olarak Ayarla (İçinden Geçilemez)
                </label>

                {/* Water Checkbox */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", marginTop: "4px" }}>
                  <input 
                    type="checkbox" 
                    checked={Boolean(selectedObject.isWater)} 
                    onChange={(e) => {
                      if (room) {
                        const oldWater = Boolean(selectedObject.isWater);
                        const newWater = e.target.checked;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { isWater: oldWater }, newData: { isWater: newWater } }]);
                        room.send("update_object", { id: selectedObject.id, isWater: newWater });
                        setSelectedObject((prev: any) => prev ? { ...prev, isWater: newWater } : null);
                      }
                    }}
                  />
                  Deniz / Su Alanı Olarak Ayarla (Suda Yüzülür)
                </label>

                {/* Climbable Checkbox */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", marginTop: "4px" }}>
                  <input 
                    type="checkbox" 
                    checked={Boolean(selectedObject.isClimbable)} 
                    onChange={(e) => {
                      if (room) {
                        const oldClimb = Boolean(selectedObject.isClimbable);
                        const newClimb = e.target.checked;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { isClimbable: oldClimb }, newData: { isClimbable: newClimb } }]);
                        room.send("update_object", { id: selectedObject.id, isClimbable: newClimb });
                        setSelectedObject((prev: any) => prev ? { ...prev, isClimbable: newClimb } : null);
                      }
                    }}
                  />
                  Tırmanma Yeri Olarak Ayarla (Merdiven)
                </label>

                {/* Depth Layer Dropdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#ced6e0" }}>Derinlik Katmanı:</span>
                  <select 
                    value={selectedObject.depthLayer || "same"} 
                    onChange={(e) => {
                      if (room) {
                        const oldLayer = selectedObject.depthLayer || "same";
                        const newLayer = e.target.value;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { depthLayer: oldLayer }, newData: { depthLayer: newLayer } }]);
                        room.send("update_object", { id: selectedObject.id, depthLayer: newLayer });
                        setSelectedObject((prev: any) => prev ? { ...prev, depthLayer: newLayer } : null);
                      }
                    }}
                    style={{ background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontSize: "12px", fontFamily: "inherit" }}
                  >
                    <option value="below">Karakterin Altında (below)</option>
                    <option value="same">Karakterle Aynı Seviyede (same)</option>
                    <option value="above">Karakterin Üstünde (above)</option>
                  </select>
                </div>



                {Boolean(selectedObject.isSolid) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255, 255, 255, 0.03)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#a4b0be" }}>ENGEL (ÇAKIŞMA KUTUSU) BOYUTLARI</div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                        <span>Engel Genişliği (px):</span>
                        <span>{selectedObject.solidWidth > 0 ? `${selectedObject.solidWidth}px` : "Varsayılan"}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="500" 
                        step="2"
                        value={selectedObject.solidWidth || 0} 
                        onChange={(e) => {
                          if (room) {
                            const newW = parseInt(e.target.value, 10);
                            room.send("update_object", { id: selectedObject.id, solidWidth: newW });
                            setSelectedObject((prev: any) => prev ? { ...prev, solidWidth: newW } : null);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                        <span>Engel Yüksekliği (px):</span>
                        <span>{selectedObject.solidHeight > 0 ? `${selectedObject.solidHeight}px` : "Varsayılan"}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="500" 
                        step="2"
                        value={selectedObject.solidHeight || 0} 
                        onChange={(e) => {
                          if (room) {
                            const newH = parseInt(e.target.value, 10);
                            room.send("update_object", { id: selectedObject.id, solidHeight: newH });
                            setSelectedObject((prev: any) => prev ? { ...prev, solidHeight: newH } : null);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                        <span>Yatay Kaydırma (Offset X):</span>
                        <span>{selectedObject.solidOffsetX || 0}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-200" 
                        max="200" 
                        step="2"
                        value={selectedObject.solidOffsetX || 0} 
                        onChange={(e) => {
                          if (room) {
                            const newOx = parseInt(e.target.value, 10);
                            room.send("update_object", { id: selectedObject.id, solidOffsetX: newOx });
                            setSelectedObject((prev: any) => prev ? { ...prev, solidOffsetX: newOx } : null);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                        <span>Dikey Kaydırma (Offset Y):</span>
                        <span>{selectedObject.solidOffsetY || 0}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-200" 
                        max="200" 
                        step="2"
                        value={selectedObject.solidOffsetY || 0} 
                        onChange={(e) => {
                          if (room) {
                            const newOy = parseInt(e.target.value, 10);
                            room.send("update_object", { id: selectedObject.id, solidOffsetY: newOy });
                            setSelectedObject((prev: any) => prev ? { ...prev, solidOffsetY: newOy } : null);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                  </div>
                )}

                {/* Depth Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "11px", color: "#ced6e0" }}>Derinlik Katmanı (Z-Ekseni):</span>
                  <select 
                    value={selectedObject.depthLayer || "same"} 
                    onChange={(e) => {
                      if (room) {
                        const oldLayer = selectedObject.depthLayer || "same";
                        const newLayer = e.target.value;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { depthLayer: oldLayer }, newData: { depthLayer: newLayer } }]);
                        room.send("update_object", { id: selectedObject.id, depthLayer: newLayer });
                        setSelectedObject((prev: any) => prev ? { ...prev, depthLayer: newLayer } : null);
                      }
                    }}
                    style={{ background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontFamily: "inherit" }}
                  >
                    <option value="below">Oyuncunun Altında (Zemin/Halı)</option>
                    <option value="same">Aynı Seviyede (Duvar/Ağaç)</option>
                    <option value="above">Oyuncunun Üstünde (Çatı/Gökyüzü)</option>
                  </select>
                </div>

                {/* Trigger Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#ced6e0" }}>Etkileşim Tetikleyicisi:</span>
                  <select 
                    value={selectedObject.triggerType || "none"} 
                    onChange={(e) => {
                      if (room) {
                        const oldTrigger = selectedObject.triggerType || "none";
                        const newTrigger = e.target.value;
                        setUndoStack((prev: any[]) => [...prev, { type: "update", id: selectedObject.id, oldData: { triggerType: oldTrigger }, newData: { triggerType: newTrigger } }]);
                        room.send("update_object", { id: selectedObject.id, triggerType: newTrigger });
                        setSelectedObject((prev: any) => prev ? { ...prev, triggerType: newTrigger } : null);
                      }
                    }}
                    style={{ background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontFamily: "inherit" }}
                  >
                    <option value="none">Tetikleyici Yok</option>
                    <option value="teleport">Oyuncuyu Işınla</option>
                  </select>

                  {selectedObject.triggerType === "teleport" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: "#a4b0be" }}>Hedef Koordinatlar (X, Y):</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input 
                          type="number" 
                          placeholder="X"
                          value={selectedObject.triggerTargetX || 0}
                          onChange={(e) => {
                            if (room) {
                              const newTargetX = Number(e.target.value);
                              room.send("update_object", { id: selectedObject.id, triggerTargetX: newTargetX });
                              setSelectedObject((prev: any) => prev ? { ...prev, triggerTargetX: newTargetX } : null);
                            }
                          }}
                          style={{ width: "50%", background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontFamily: "inherit" }}
                        />
                        <input 
                          type="number" 
                          placeholder="Y"
                          value={selectedObject.triggerTargetY || 0}
                          onChange={(e) => {
                            if (room) {
                              const newTargetY = Number(e.target.value);
                              room.send("update_object", { id: selectedObject.id, triggerTargetY: newTargetY });
                              setSelectedObject((prev: any) => prev ? { ...prev, triggerTargetY: newTargetY } : null);
                            }
                          }}
                          style={{ width: "50%", background: "#2f3542", border: "1px solid #747d8c", color: "white", padding: "4px", borderRadius: "4px", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5.5 Animal Editor Panel (🐾) ── */}
      {isAnimalEditorOpen && (
        <div 
          className="map-editor-panel glass"
          style={{
            position: "fixed",
            top: "70px",
            left: "20px",
            width: "320px",
            bottom: "80px",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px",
            boxSizing: "border-box",
            overflowY: "auto",
            color: "white",
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: "10px", color: "#9b59b6" }}>🐾 HAYVAN EDİTÖRÜ</span>
            <button 
              onClick={() => setIsAnimalEditorOpen(false)}
              style={{ background: "transparent", border: "none", color: "#ff4757", cursor: "pointer", fontSize: "16px" }}
            >
              ✕
            </button>
          </div>

          {/* Tool Selector */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setActiveEditorTool("brush")}
              className={`editor-btn-small ${activeEditorTool === "brush" ? "active" : ""}`}
              style={{ flex: 1, background: activeEditorTool === "brush" ? "rgba(155, 89, 182, 0.2)" : "#2f3542", borderColor: activeEditorTool === "brush" ? "#9b59b6" : "#747d8c" }}
            >
              🖌️ Hayvan Koy
            </button>
            <button
              onClick={() => setActiveEditorTool("select")}
              className={`editor-btn-small ${activeEditorTool === "select" ? "active" : ""}`}
              style={{ flex: 1, background: activeEditorTool === "select" ? "rgba(0, 210, 211, 0.2)" : "#2f3542", borderColor: activeEditorTool === "select" ? "#00d2d3" : "#747d8c" }}
            >
              🔍 Seç / Düzenle
            </button>
          </div>

          {/* Palette (Only active when in placement brush mode) */}
          {activeEditorTool === "brush" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#ced6e0" }}>HAYVAN ŞABLONLARI:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { id: "spawn_animal_chicken_black_white",  label: "🐔 Siyah-Beyaz Tavuk",  desc: "Siyah beyaz benekli tavuk." },
                  { id: "spawn_animal_chicken_black",        label: "🐔 Siyah Tavuk",        desc: "Asil simsiyah tavuk." },
                  { id: "spawn_animal_chicken_blonde_green",  label: "🐔 Sarı-Yeşil Tavuk",  desc: "Nadir sarı-yeşil tüylü tavuk." },
                  { id: "spawn_animal_chicken_blonde",       label: "🐔 Sarı Tavuk",        desc: "Sevimli sarışın tavuk." },
                  { id: "spawn_animal_chicken_brown_black",  label: "🐔 Kahve-Siyah Tavuk",  desc: "Koyu renk kahveli tavuk." },
                  { id: "spawn_animal_chicken_brown_white",  label: "🐔 Kahverengi Tavuk",  desc: "Alacalı kahverengi tavuk." },
                  { id: "spawn_animal_chicken_evil",         label: "😈 Hain Tavuk",         desc: "Kırmızı gözlü tehlikeli tavuk." },
                  { id: "spawn_animal_chicken_full",         label: "🐔 Kızıl Tavuk",        desc: "Kızıl kahverengi dolgun tavuk." },
                  { id: "spawn_animal_chicken_green",        label: "🐔 Yeşil Tavuk",        desc: "Egzotik yeşil tüylü tavuk." },
                  { id: "spawn_animal_chicken_pink",         label: "🐔 Pembe Tavuk",        desc: "Pamuk şeker pembesi tavuk." },
                  { id: "spawn_animal_chicken_red",          label: "🐔 Kırmızı Tavuk",      desc: "Vahşi parlak kırmızı tavuk." },
                  { id: "spawn_animal_chicken_universe",     label: "🌌 Evrensel Tavuk",     desc: "Kozmik renkli gizemli tavuk." },
                  { id: "spawn_animal_chicken_white",        label: "🐔 Beyaz Tavuk",        desc: "Kar beyazı yumuşak tavuk." },
                  { id: "spawn_animal_cow_black",            label: "🐄 Siyah İnek",         desc: "Siyah renkli inek." },
                  { id: "spawn_animal_cow_blonde",           label: "🐄 Sarı İnek",          desc: "Sarı tüylü sevimli inek." },
                  { id: "spawn_animal_cow_brown",            label: "🐄 Kahverengi İnek",    desc: "Klasik kahverengi inek." },
                  { id: "spawn_animal_cow_pink",             label: "🐄 Pembe İnek",         desc: "Tatlı pembe renkli inek." },
                  { id: "spawn_animal_sheep_white",            label: "🐑 Beyaz Koyun",         desc: "Yumuşacık beyaz yünlü koyun." },
                  { id: "spawn_animal_sheep_spotted",          label: "🐑 Kıvırcık Koyun",       desc: "Tatlı kıvırcık yünlü koyun." },
                  { id: "spawn_animal_pig_baby_mud",           label: "🐖 Çamurlu Yavru Domuz",  desc: "Çamurlu sevimli yavru domuz." },
                  { id: "spawn_animal_pig_baby",               label: "🐖 Yavru Domuz",          desc: "Temiz pembe yavru domuz." },
                  { id: "spawn_animal_pig_mud",                label: "🐖 Çamurlu Domuz",       desc: "Büyük çamurlu domuz." },
                  { id: "spawn_animal_pig_pink",               label: "🐖 Pembe Domuz",          desc: "Klasik pembe büyük domuz." }
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPaletteAsset(item.id)}
                    style={{
                      background: selectedPaletteAsset === item.id ? "rgba(155, 89, 182, 0.25)" : "#2f3542",
                      border: selectedPaletteAsset === item.id ? "2px solid #9b59b6" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      padding: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "white" }}>{item.label}</div>
                    <div style={{ fontSize: "8px", color: "#a4b0be", marginTop: "2px" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Object Settings */}
          {activeEditorTool === "select" && (
            <div>
              {selectedObject && selectedObject.assetId && selectedObject.assetId.startsWith("spawn_animal_") ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#00d2d3", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "6px" }}>
                    SEÇİLİ HAYVAN AYARLARI
                  </div>
                  
                  <div style={{ fontSize: "10px", color: "#ced6e0" }}>
                    <div>ID: <span style={{ fontFamily: "monospace" }}>{selectedObject.id}</span></div>
                    <div style={{ marginTop: "2px" }}>
                      Tür: {(() => {
                        const aid = selectedObject.assetId;
                        if (aid === "spawn_animal_chicken_black_white") return "Siyah-Beyaz Tavuk";
                        if (aid === "spawn_animal_chicken_black") return "Siyah Tavuk";
                        if (aid === "spawn_animal_chicken_blonde_green") return "Sarı-Yeşil Tavuk";
                        if (aid === "spawn_animal_chicken_blonde") return "Sarı Tavuk";
                        if (aid === "spawn_animal_chicken_brown_black") return "Kahve-Siyah Tavuk";
                        if (aid === "spawn_animal_chicken_brown_white") return "Kahverengi Tavuk";
                        if (aid === "spawn_animal_chicken_evil") return "Hain Tavuk";
                        if (aid === "spawn_animal_chicken_full") return "Kızıl Tavuk";
                        if (aid === "spawn_animal_chicken_green") return "Yeşil Tavuk";
                        if (aid === "spawn_animal_chicken_pink") return "Pembe Tavuk";
                        if (aid === "spawn_animal_chicken_red") return "Kırmızı Tavuk";
                        if (aid === "spawn_animal_chicken_universe") return "Evrensel Tavuk";
                        if (aid === "spawn_animal_chicken_white") return "Beyaz Tavuk";
                        if (aid === "spawn_animal_cow_black") return "Siyah İnek";
                        if (aid === "spawn_animal_cow_blonde") return "Sarı İnek";
                        if (aid === "spawn_animal_cow_brown") return "Kahverengi İnek";
                        if (aid === "spawn_animal_cow_pink") return "Pembe İnek";
                        if (aid === "spawn_animal_sheep_white") return "Beyaz Koyun";
                        if (aid === "spawn_animal_sheep_spotted") return "Kıvırcık Koyun";
                        if (aid === "spawn_animal_pig_baby_mud") return "Çamurlu Yavru Domuz";
                        if (aid === "spawn_animal_pig_baby") return "Yavru Domuz";
                        if (aid === "spawn_animal_pig_mud") return "Çamurlu Domuz";
                        if (aid === "spawn_animal_pig_pink") return "Pembe Domuz";
                        return aid.replace("spawn_animal_", "");
                      })()}
                    </div>
                  </div>

                  {/* Size/Scale Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                      <span>📏 Hayvan Boyutu:</span>
                      <span style={{ fontWeight: "bold", color: "#9b59b6" }}>{Number(selectedObject.scaleX || 1.0).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="4.0"
                      step="0.1"
                      value={selectedObject.scaleX || 1.0}
                      onChange={(e) => {
                        if (room) {
                          const scaleVal = parseFloat(e.target.value);
                          room.send("update_object", { id: selectedObject.id, scaleX: scaleVal, scaleY: scaleVal });
                          setSelectedObject((prev: any) => prev ? { ...prev, scaleX: scaleVal, scaleY: scaleVal } : null);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  {/* Roam Speed Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ced6e0" }}>
                      <span>⚡ Dolaşma Hızı (Speed):</span>
                      <span style={{ fontWeight: "bold", color: "#9b59b6" }}>{selectedObject.patrolSpeed !== undefined ? selectedObject.patrolSpeed : 45} px/s</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="5"
                      value={selectedObject.patrolSpeed !== undefined ? selectedObject.patrolSpeed : 45}
                      onChange={(e) => {
                        if (room) {
                          const speedVal = parseInt(e.target.value, 10);
                          room.send("update_object", { id: selectedObject.id, patrolSpeed: speedVal });
                          setSelectedObject((prev: any) => prev ? { ...prev, patrolSpeed: speedVal } : null);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  {/* Roam/Patrol Path Section */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#9b59b6" }}>🛣️ Hayvan Devriye Yolu:</span>
                    
                    {pathDrawingTargetId === selectedObject.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ fontSize: "9px", color: "#ff9f43", background: "rgba(255, 159, 67, 0.15)", padding: "4px 6px", border: "1px solid #ff9f43", borderRadius: "4px" }}>
                          ℹ️ Yol Çizim Modu Aktif. Haritada sırayla hayvanın yürüyeceği noktalara tıklayın.
                        </div>
                        <div style={{ fontSize: "9px", color: "#a4b0be" }}>
                          Eklenen Nokta Sayısı: {tempPathPoints.length}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => {
                              if (room) {
                                const pathStr = JSON.stringify(tempPathPoints);
                                room.send("update_object", { id: selectedObject.id, patrolPath: pathStr });
                                setSelectedObject((prev: any) => prev ? { ...prev, patrolPath: pathStr } : null);
                              }
                              setPathDrawingTargetId(null);
                              setTempPathPoints([]);
                            }}
                            className="editor-btn-small"
                            style={{ flex: 1, background: "#218c74", color: "white", borderColor: "#1dd1a1" }}
                          >
                            💾 Yolu Kaydet
                          </button>
                          <button
                            onClick={() => {
                              setPathDrawingTargetId(null);
                              setTempPathPoints([]);
                            }}
                            className="editor-btn-small"
                            style={{ flex: 1, background: "#b33939", color: "white", borderColor: "#ff5252" }}
                          >
                            ❌ İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ fontSize: "9px", color: "#ced6e0" }}>
                          Yol Noktaları: {(() => {
                            try {
                              if (selectedObject.patrolPath) {
                                return `${JSON.parse(selectedObject.patrolPath).length} nokta`;
                              }
                            } catch(e) {}
                            return "Tanımlanmamış";
                          })()}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => {
                              setPathDrawingTargetId(selectedObject.id);
                              let existingPoints = [];
                              try {
                                if (selectedObject.patrolPath) {
                                  existingPoints = JSON.parse(selectedObject.patrolPath);
                                }
                              } catch (e) {}
                              setTempPathPoints(existingPoints);
                            }}
                            className="editor-btn-small"
                            style={{ flex: 1 }}
                          >
                            🛣️ Yolu Çiz/Düzenle
                          </button>
                          {selectedObject.patrolPath && (
                            <button
                              onClick={() => {
                                if (room) {
                                  room.send("update_object", { id: selectedObject.id, patrolPath: "" });
                                  setSelectedObject((prev: any) => prev ? { ...prev, patrolPath: "" } : null);
                                }
                              }}
                              className="editor-btn-small"
                              style={{ flex: 1, color: "#ff5252" }}
                            >
                              🗑️ Yolu Sil
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Copy as Template Button */}
                  <button
                    onClick={() => {
                      setCopiedTileTemplate({
                        assetId: selectedObject.assetId,
                        isSolid: Boolean(selectedObject.isSolid),
                        isWater: Boolean(selectedObject.isWater),
                        isClimbable: Boolean(selectedObject.isClimbable),
                        depthLayer: selectedObject.depthLayer || "same",
                        tileX: selectedObject.tileX !== undefined ? selectedObject.tileX : -1,
                        tileY: selectedObject.tileY !== undefined ? selectedObject.tileY : -1,
                        tileW: selectedObject.tileW !== undefined ? selectedObject.tileW : 0,
                        tileH: selectedObject.tileH !== undefined ? selectedObject.tileH : 0,
                        frameRate: selectedObject.frameRate !== undefined ? selectedObject.frameRate : 6,
                        solidWidth: selectedObject.solidWidth || 0,
                        solidHeight: selectedObject.solidHeight || 0,
                        solidOffsetX: selectedObject.solidOffsetX || 0,
                        solidOffsetY: selectedObject.solidOffsetY || 0,
                      });
                      setActiveEditorTool("fill_region");
                    }}
                    className="editor-btn-small"
                    style={{ background: "rgba(249,202,36,0.15)", color: "#f9ca24", borderColor: "#f9ca24", marginTop: "8px", width: "100%" }}
                  >
                    📋 Karo Şablonu Olarak Kopyala → Alan Doldur
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (room) {
                        setUndoStack((prev: any[]) => [...prev, { type: "delete", id: selectedObject.id, data: { ...selectedObject } }]);
                        room.send("delete_object", { id: selectedObject.id });
                        setSelectedObject(null);
                      }
                    }}
                    className="editor-btn-small"
                    style={{ background: "#b33939", color: "white", borderColor: "#ff5252", marginTop: "10px" }}
                  >
                    🗑️ Hayvanı Haritadan Sil
                  </button>

                </div>
              ) : (
                <div style={{ fontSize: "10px", color: "#a4b0be", textAlign: "center", padding: "20px 0" }}>
                  💡 Haritadan düzenlemek istediğiniz bir hayvan spawner'ına tıklayarak seçin.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Terrain Editor Panel (🏔️) ── */}
      <TerrainEditorPanel
        room={room}
        isOpen={isTerrainEditorOpen}
        onClose={() => setIsTerrainEditorOpen(false)}
        activeEditorTool={activeEditorTool}
        setActiveEditorTool={setActiveEditorTool}
        selectedPaletteAsset={selectedPaletteAsset}
        setSelectedPaletteAsset={setSelectedPaletteAsset}
      />
    </div>
  );
}
