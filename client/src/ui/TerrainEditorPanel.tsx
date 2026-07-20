import { useState, useRef, useCallback, useEffect } from "react";

export interface TerrainTileSelection {
  startCol: number; startRow: number; endCol: number; endRow: number;
}

export interface TilesetDef {
  key: string; label: string; emoji: string; file: string;
  tileW: number; tileH: number; sheetW: number; sheetH: number;
  animatedRows?: number;
  category: "water" | "terrain" | "nature" | "rock" | "misc" | "dekor3" | "insaat";
}

export const TERRAIN_TILESETS: TilesetDef[] = [
  { key:"wf_summer",    label:"Yaz Selalesi",     emoji:"🌊", file:"waterfall/Summer Waterfall.png",       tileW:16, tileH:16, sheetW:512, sheetH:128, animatedRows:2, category:"water"   },
  { key:"wf_deepforest",label:"Orman Selalesi",   emoji:"🌲", file:"waterfall/Deep Forest Waterfall.png", tileW:16, tileH:16, sheetW:512, sheetH:128, animatedRows:2, category:"water"   },
  { key:"wf_fall",      label:"Sonbahar Selalesi",emoji:"🍂", file:"waterfall/Fall Waterfall.png",         tileW:16, tileH:16, sheetW:512, sheetH:128, animatedRows:2, category:"water"   },
  { key:"wf_spring",    label:"Ilkbahar Selalesi",emoji:"🌸", file:"waterfall/Spring Waterfall.png",       tileW:16, tileH:16, sheetW:512, sheetH:128, animatedRows:2, category:"water"   },
  // === Su & Çimen ===
  { key:"grass_water_spring",      label:"İlkbahar Çim Suyu",   emoji:"🌊", file:"tileset/tileset_grass_water_spring.png",      tileW:16, tileH:16, sheetW:768, sheetH:256, category:"water"   },
  { key:"grass_water_summer",      label:"Yaz Çim Suyu",        emoji:"🌊", file:"tileset/tileset_grass_water_summer.png",      tileW:16, tileH:16, sheetW:768, sheetH:256, category:"water"   },
  { key:"grass_water_fall",        label:"Sonbahar Çim Suyu",   emoji:"🍂", file:"tileset/tileset_grass_water_fall.png",        tileW:16, tileH:16, sheetW:768, sheetH:256, category:"water"   },
  { key:"grass_water_deep_forest", label:"Derin Orman Su",      emoji:"🌲", file:"tileset/tileset_grass_water_deep_forest.png", tileW:16, tileH:16, sheetW:768, sheetH:256, category:"water"   },
  { key:"grass_water_winter",      label:"Kış Çim Suyu",        emoji:"❄️", file:"tileset/tileset_grass_water_winter.png",      tileW:16, tileH:16, sheetW:400, sheetH:384, category:"water"   },
  { key:"beach_anims",  label:"Plaj Karoları",    emoji:"🏖️", file:"tileset/tileset_beach_anims.png",     tileW:16, tileH:16, sheetW:384, sheetH:256,                  category:"water"   },
  { key:"cave_water_ground_anims", label:"Mağara Su Karoları", emoji:"🌊", file:"tileset/Cave_Water_Ground_animations_tiles.png", tileW:16, tileH:16, sheetW:384, sheetH:256, category:"water" },
  { key:"water_ground_anims",      label:"Su Karoları 2",      emoji:"🌊", file:"tileset/Water_Ground_animations_tiles.png", tileW:16, tileH:16, sheetW:384, sheetH:256, category:"water" },
  { key:"frozen_water_ground",     label:"Donmuş Su Karoları", emoji:"❄️", file:"tileset/Frozen_Water_Ground_tiles.png", tileW:16, tileH:16, sheetW:192, sheetH:128, category:"water" },
  // === Doğa & Çimen ===
  { key:"grass_summer",      label:"Yaz Çimeni",        emoji:"🌿", file:"tileset/Tileset Grass Summer.png",        tileW:16, tileH:16, sheetW:384, sheetH:640, category:"nature"  },
  { key:"grass_spring",      label:"İlkbahar Çimeni",   emoji:"🌱", file:"tileset/tileset_grass_spring.png",        tileW:16, tileH:16, sheetW:384, sheetH:640, category:"nature"  },
  { key:"grass_fall",        label:"Sonbahar Çimeni",   emoji:"🍂", file:"tileset/tileset_grass_fall.png",          tileW:16, tileH:16, sheetW:384, sheetH:640, category:"nature"  },
  { key:"grass_deep_forest", label:"Derin Orman Çimeni",emoji:"🌲", file:"tileset/tileset_grass_deep_forest.png",   tileW:16, tileH:16, sheetW:384, sheetH:640, category:"nature"  },
  { key:"grass_winter",      label:"Kış Çimeni",        emoji:"❄️", file:"tileset/tileset_grass_winter.png",        tileW:16, tileH:16, sheetW:384, sheetH:640, category:"nature"  },
  { key:"grass_winter2",     label:"Kış Çimeni 2",      emoji:"⛄", file:"tileset/tileset_grass_winter2.png",       tileW:16, tileH:16, sheetW:384, sheetH:128, category:"nature"  },
  { key:"box_dekor",         label:"Kasa Dekor",        emoji:"📦", file:"tileset/Box.png",                        tileW:16, tileH:16, sheetW:144, sheetH:320, category:"nature"  },
  { key:"tree_trunks",       label:"Kütükler",          emoji:"🪵", file:"tileset/TreeTrunks.png",                 tileW:32, tileH:16, sheetW:128, sheetH:32,  category:"nature"  },
  { key:"big_old_tree",      label:"Koca Ağaç",         emoji:"🌳", file:"tileset/BigOldTree.png",                 tileW:16, tileH:16, sheetW:128, sheetH:160, category:"nature"  },
  { key:"bushes",            label:"Çalılar",           emoji:"🌿", file:"tileset/Bushes.png",                     tileW:16, tileH:16, sheetW:144, sheetH:288, category:"nature"  },
  { key:"tilled_soil",       label:"Sürülmüş Toprak",   emoji:"🟫", file:"tileset/tileset_tilled_soil.png",        tileW:16, tileH:16, sheetW:384, sheetH:128, category:"nature"  },
  // === Zemin & Toprak ===
  { key:"grass_cliff_spring", label:"İlkbahar Uçurumu", emoji:"⛰️", file:"tileset/tileset_grass_cliff_spring.png", tileW:16, tileH:16, sheetW:320, sheetH:192, category:"terrain" },
  { key:"grass_cliff_summer", label:"Yaz Uçurumu",      emoji:"⛰️", file:"tileset/tileset_grass_cliff_summer.png", tileW:16, tileH:16, sheetW:320, sheetH:192, category:"terrain" },
  { key:"dungeon",            label:"Zindan Tileset",   emoji:"🏰", file:"tileset/tileset_dungeon.png",             tileW:16, tileH:16, sheetW:192, sheetH:192, category:"terrain" },
  { key:"extra_village",      label:"Ekstra Köy",       emoji:"🏡", file:"tileset/tileset_extra_village.png",       tileW:16, tileH:16, sheetW:144, sheetH:80,  category:"terrain" },
  { key:"house",              label:"Ev Tileset",       emoji:"🏠", file:"tileset/tileset_house.png",               tileW:16, tileH:16, sheetW:832, sheetH:384, category:"terrain" },
  { key:"path_tiles",         label:"Patika Karoları",  emoji:"🛣️", file:"tileset/Path_tiles.png",                 tileW:16, tileH:16, sheetW:384, sheetH:256, category:"terrain" },
  { key:"carpet_tiles",       label:"Halı Karoları",    emoji:"🧹", file:"tileset/carpet.png",                    tileW:16, tileH:16, sheetW:224, sheetH:192, category:"terrain" },
  { key:"grass_cliff_deep_forest", label:"Derin Orman Uçurumu", emoji:"⛰️", file:"tileset/Tileset_Grass_Cliff_Tileset_Deep_Forest.png", tileW:16, tileH:16, sheetW:320, sheetH:192, category:"terrain" },
  { key:"grass_cliff_fall",        label:"Sonbahar Uçurumu 2",  emoji:"⛰️", file:"tileset/Tileset_Grass_Cliff_Tileset_Fall.png",        tileW:16, tileH:16, sheetW:320, sheetH:192, category:"terrain" },
  { key:"grass_cliff_winter",      label:"Kış Uçurumu 2",        emoji:"❄️", file:"tileset/Tileset_Grass_Cliff_Tileset_Winter.png",      tileW:16, tileH:16, sheetW:384, sheetH:304, category:"terrain" },
  // === Dag & Kaya ===
  { key:"caves",              label:"Mağara Karoları",  emoji:"🪨", file:"tileset/Caves.png",                      tileW:16, tileH:16, sheetW:576, sheetH:720, category:"rock"    },
  { key:"rock_caves",         label:"Kaya Mağaraları",  emoji:"⛰️", file:"tileset/Rock_Caves.png",                 tileW:16, tileH:16, sheetW:576, sheetH:720, category:"rock"    },
  { key:"grass_caves",        label:"Çimli Mağara Karoları", emoji:"🌿", file:"tileset/Tileset_Grass_Caves.png",        tileW:16, tileH:16, sheetW:384, sheetH:128, category:"rock"    },
  // === Bina & Yapı ===
  { key:"barn",               label:"Ahır Tileset",     emoji:"🏚️", file:"tileset/tileset_barn.png",                tileW:16, tileH:16, sheetW:192, sheetH:240, category:"misc"    },
  { key:"bridge_beach",       label:"Köprü & Plaj",     emoji:"🌉", file:"tileset/tileset_bridge_beach.png",        tileW:16, tileH:16, sheetW:208, sheetH:144, category:"misc"    },
  { key:"temple",             label:"Tapınak Tileset",  emoji:"⛩️", file:"tileset/tileset_temple.png",              tileW:16, tileH:16, sheetW:192, sheetH:96,  category:"misc"    },
  // === Dekor 3 ===
  { key:"d3_all_props_seasons",label:"Tüm Mevsimler",    emoji:"🍂", file:"dekor3/ALL_props_seasons.png",          tileW:16, tileH:16, sheetW:352, sheetH:192, category:"dekor3"  },
  { key:"d3_beach_exterior",  label:"Plaj Dış",         emoji:"🏖️", file:"dekor3/Beach_Exterior.png",             tileW:16, tileH:16, sheetW:64,  sheetH:96,  category:"dekor3"  },
  { key:"d3_exterior_beach",  label:"Yaz Plajı",        emoji:"🌴", file:"dekor3/Exterior_Beach.png",             tileW:16, tileH:16, sheetW:384, sheetH:240, category:"dekor3"  },
  { key:"d3_fireplace",       label:"Şömineler",        emoji:"🔥", file:"dekor3/Fireplace.png",                  tileW:16, tileH:16, sheetW:256, sheetH:256, category:"dekor3"  },
  { key:"d3_fish",            label:"Balık Standı",     emoji:"🐟", file:"dekor3/Fish.png",                       tileW:16, tileH:16, sheetW:336, sheetH:48,  category:"dekor3"  },
  { key:"d3_plants",          label:"Bitkiler",         emoji:"🌿", file:"dekor3/plants.png",                     tileW:16, tileH:16, sheetW:272, sheetH:64,  category:"dekor3"  },
  { key:"d3_propswater_summer",label:"Su Süsleri",       emoji:"🪷", file:"dekor3/PropsWater_Summer.png",         tileW:16, tileH:16, sheetW:160, sheetH:128, category:"dekor3"  },
  { key:"d3_road",            label:"Yol & Patika",     emoji:"🛣️", file:"dekor3/Road.png",                       tileW:16, tileH:16, sheetW:144, sheetH:192, category:"dekor3"  },
  { key:"d3_sea_coral",       label:"Mercanlar",        emoji:"🪸", file:"dekor3/sea_coral.png",                  tileW:16, tileH:16, sheetW:176, sheetH:144, category:"dekor3"  },
  // === İnşaat ===
  { key:"insaat_bridge_beach",label:"Plaj Köprüsü",      emoji:"🌉", file:"insaat/Bridge_Beach.png",               tileW:16, tileH:16, sheetW:128, sheetH:224, category:"insaat"  },
  { key:"insaat_bridge",      label:"Köprü",             emoji:"🌉", file:"insaat/Bridge.png",                     tileW:16, tileH:16, sheetW:128, sheetH:128, category:"insaat"  },
  { key:"insaat_fence_iron",  label:"Demir Çit",         emoji:"🚧", file:"insaat/Fence_Iron.png",                 tileW:16, tileH:16, sheetW:48,  sheetH:96,  category:"insaat"  },
  { key:"insaat_fence_stone", label:"Taş Çit",           emoji:"🧱", file:"insaat/Fence_Stone.png",                tileW:16, tileH:16, sheetW:48,  sheetH:80,  category:"insaat"  },
  { key:"insaat_fence_wood",  label:"Ahşap Çit",         emoji:"🪵", file:"insaat/Fence_Wood.png",                 tileW:16, tileH:16, sheetW:96,  sheetH:160, category:"insaat"  },
  { key:"insaat_white_fence", label:"Beyaz Çit",         emoji:"🤍", file:"insaat/White_Fence.png",                tileW:16, tileH:16, sheetW:80,  sheetH:80,  category:"insaat"  },
];


const CATEGORY_LABELS: Record<string, string> = {
  water:"💧 Su & Selale", terrain:"🪨 Toprak & Zemin", nature:"🌿 Doga & Bitki", rock:"⛰️ Dag & Kaya", misc:"🔧 Diger", dekor3:"🎨 Dekor 3", insaat:"🚧 İnşaat"
};

interface Props { room: any; isOpen: boolean; onClose: () => void; }
type Tool  = "paint" | "erase" | "fill" | "picker";
type Layer = "below" | "same" | "above";

export function TerrainEditorPanel({ isOpen, onClose }: Props) {
  const [tool,             setTool]             = useState<Tool>("paint");
  const [layer,            setLayer]            = useState<Layer>("below");
  const [activeCategory,   setActiveCategory]   = useState<string>("water");
  const [activeTilesetKey, setActiveTilesetKey] = useState<string>("wf_summer");
  const [selection,        setSelection]        = useState<TerrainTileSelection | null>(null);
  const [isDragging,       setIsDragging]       = useState(false);
  const [dragStart,        setDragStart]        = useState<{ col: number; row: number } | null>(null);
  const [zoom,             setZoom]             = useState<number>(2);
  const [showGrid,         setShowGrid]         = useState(true);
  const [animated,         setAnimated]         = useState(true);
  const [snapToGrid,       setSnapToGrid]       = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize,         setGridSize]         = useState<number>(16);
  const [tileIsWater,      setTileIsWater]      = useState(false);
  const [tileIsSolid,      setTileIsSolid]      = useState(false);
  const [tileIsClimbable,  setTileIsClimbable]  = useState(false);

  const activeTileset   = TERRAIN_TILESETS.find(t => t.key === activeTilesetKey) ?? TERRAIN_TILESETS[0];
  const categories      = Array.from(new Set(TERRAIN_TILESETS.map(t => t.category)));
  const currentTileW    = gridSize;
  const currentTileH    = gridSize;

  const displayRows     = activeTileset.animatedRows !== undefined
    ? Math.floor(activeTileset.sheetH / currentTileH / 2) : Math.floor(activeTileset.sheetH / currentTileH);
  const displayCols     = Math.floor(activeTileset.sheetW / currentTileW);
  const displayedTilePx = currentTileW * zoom;
  const selW = selection ? selection.endCol - selection.startCol + 1 : 0;
  const selH = selection ? selection.endRow - selection.startRow + 1 : 0;
  const isAnimSel = !!(selection && animated && activeTileset.animatedRows !== undefined && selection.startRow < (activeTileset.animatedRows ?? 0));

  const applySelection = useCallback((sel: TerrainTileSelection | null) => {
    if (!sel) return;
    const { startCol, startRow } = sel;
    const tw = currentTileW; const th = currentTileH;
    const nativeTileW = activeTileset.tileW;
    const nativeTileH = activeTileset.tileH;
    // tileScale: how many times bigger than native tile the selected grid size is
    const tileScaleX = tw / nativeTileW;
    const tileScaleY = th / nativeTileH;
    const isAnim = animated && activeTileset.animatedRows !== undefined && startRow < (activeTileset.animatedRows ?? 0);
    let assetId: string;
    if (activeTilesetKey.startsWith("wf_")) {
      const theme = activeTilesetKey.replace("wf_", "");
      assetId = `wf_${theme}_${startCol}_${startRow}_${nativeTileW}_${nativeTileH}_${isAnim ? 1 : 0}`;
    } else { assetId = `terrain_${activeTilesetKey}_${startCol}_${startRow}_${nativeTileW}_${nativeTileH}`; }
    const existing = (window as any).editorConfig ?? {};
    const isMultiTile = sel.endCol > sel.startCol || sel.endRow > sel.startRow;
    (window as any).editorConfig = { ...existing, active:true,
      tool: tool==="erase" ? "eraser" : "brush",
      selectedAsset: assetId, selectedTile: { x:startCol*nativeTileW, y:startRow*nativeTileH, w:nativeTileW, h:nativeTileH },
      depthLayer: layer, snapSize: snapToGrid ? tw : 1, gridSnap: snapToGrid,
      tileScaleX, tileScaleY,
      // Tile behavior flags — controlled by checkboxes in terrain panel
      brushIsWater: tileIsWater,
      brushIsSolid: tileIsSolid,
      brushIsClimbable: tileIsClimbable,
      // Multi-tile brush data — GameScene loops through this grid on placement
      terrainBrush: isMultiTile ? {
        startCol: sel.startCol, startRow: sel.startRow,
        endCol:   sel.endCol,   endRow:   sel.endRow,
        tileW: nativeTileW, tileH: nativeTileH,
        tileScaleX, tileScaleY,
        tilesetKey: activeTilesetKey,
        animated,
      } : null,
    };
  }, [activeTileset, activeTilesetKey, animated, layer, snapToGrid, tool, currentTileW, currentTileH, tileIsWater, tileIsSolid, tileIsClimbable]);

  // Auto-reset animation state and grid size when switching to a non-animated tileset
  useEffect(() => {
    if (activeTileset.animatedRows === undefined) {
      setAnimated(false);
    }
    setGridSize(activeTileset.tileW);
  }, [activeTilesetKey, activeTileset]);

  useEffect(() => { if (selection) applySelection(selection); }, [tool, layer, snapToGrid, animated, tileIsWater, tileIsSolid, tileIsClimbable]);

  const getTileAt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / displayedTilePx);
    const row = Math.floor((e.clientY - rect.top) / displayedTilePx);
    if (col < 0 || col >= displayCols || row < 0 || row >= displayRows) return null;
    return { col, row };
  }, [displayedTilePx, displayCols, displayRows]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const t = getTileAt(e); if (!t) return;
    setIsDragging(true); setDragStart(t);
    const sel = { startCol:t.col, startRow:t.row, endCol:t.col, endRow:t.row };
    setSelection(sel); applySelection(sel);
  }, [getTileAt, applySelection]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return;
    const t = getTileAt(e); if (!t) return;
    const sel = { startCol:Math.min(dragStart.col,t.col), startRow:Math.min(dragStart.row,t.row),
                  endCol:Math.max(dragStart.col,t.col),   endRow:Math.max(dragStart.row,t.row) };
    setSelection(sel); applySelection(sel);
  }, [isDragging, dragStart, getTileAt, applySelection]);

  const onMouseUp = useCallback(() => { setIsDragging(false); setDragStart(null); }, []);

  if (!isOpen) return null;
  const ACC = "#00b8d9"; const ACCB = "rgba(0,184,217,0.13)"; const BDR = "rgba(0,184,217,0.3)";

  const tbtn = (id: Tool, icon: string, lbl: string, hk: string) => (
    <button key={id} onClick={() => setTool(id)} title={`${lbl} [${hk}]`} style={{
      display:"flex", flexDirection:"column", alignItems:"center", gap:"2px", padding:"7px 5px", minWidth:"52px",
      background:tool===id?ACCB:"rgba(255,255,255,0.04)", border:`1px solid ${tool===id?ACC:"rgba(255,255,255,0.1)"}`,
      borderRadius:"6px", color:tool===id?ACC:"#a4b0be", cursor:"pointer", fontSize:"17px", transition:"all .15s",
      boxShadow:tool===id?`0 0 8px ${ACC}44`:"none",
    }}><span>{icon}</span><span style={{fontSize:"7px",fontFamily:"'Outfit',sans-serif"}}>{lbl}</span><span style={{fontSize:"6px",color:"#636e72",fontFamily:"monospace"}}>[{hk}]</span></button>
  );

  const lbtn = (id: Layer, icon: string, lbl: string) => (
    <button key={id} onClick={() => setLayer(id)} style={{
      flex:1, padding:"5px 3px", fontSize:"9px",
      background:layer===id?ACCB:"rgba(255,255,255,0.04)", border:`1px solid ${layer===id?ACC:"rgba(255,255,255,0.1)"}`,
      borderRadius:"5px", color:layer===id?ACC:"#a4b0be", cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all .15s",
    }}>{icon} {lbl}</button>
  );

  return (
    <div style={{ position:"fixed", top:0, right:0, width:"390px", bottom:0, zIndex:1000,
      display:"flex", flexDirection:"column", background:"rgba(13,18,32,0.97)",
      borderLeft:`1px solid ${BDR}`, boxShadow:"-4px 0 32px rgba(0,0,0,0.75)",
      fontFamily:"'Outfit',sans-serif", color:"white", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 16px", borderBottom:`1px solid ${BDR}`, background:"rgba(0,184,217,0.07)", flexShrink:0 }}>
        <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
          <span style={{fontSize:"22px"}}>🏔️</span>
          <div>
            <div style={{fontFamily:"'Press Start 2P'", fontSize:"8px", color:ACC}}>ARAZİ EDİTÖRÜ</div>
            <div style={{fontSize:"9px", color:"#636e72", marginTop:"2px"}}>Tileset Boyama Sistemi</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,71,87,0.1)", border:"1px solid rgba(255,71,87,0.3)",
          color:"#ff4757", cursor:"pointer", borderRadius:"5px", padding:"4px 10px", fontSize:"13px"}}>✕</button>
      </div>

      {/* Tools */}
      <div style={{padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0}}>
        <div style={{fontSize:"8px", color:"#636e72", marginBottom:"6px", textTransform:"uppercase"}}>Araçlar</div>
        <div style={{display:"flex", gap:"5px"}}>{tbtn("paint","🖌️","Boya","P")}{tbtn("erase","🧹","Sil","E")}{tbtn("fill","🪣","Doldur","F")}{tbtn("picker","🔍","Seçici","D")}</div>
      </div>

      {/* Layer + Options */}
      <div style={{padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0}}>
        <div style={{display:"flex", gap:"7px", flexDirection:"column"}}>
          <div>
            <div style={{fontSize:"8px", color:"#636e72", marginBottom:"5px", textTransform:"uppercase"}}>Katman</div>
            <div style={{display:"flex", gap:"5px"}}>{lbtn("below","⬇️","Altında")}{lbtn("same","➡️","Aynı")}{lbtn("above","⬆️","Üstünde")}</div>
          </div>
          <div style={{display:"flex", gap:"14px", flexWrap:"wrap"}}>
            <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer", color:snapToGrid?ACC:"#a4b0be"}}>
              <input type="checkbox" checked={snapToGrid} onChange={e=>setSnapToGrid(e.target.checked)} />🧲 Izgara Yapıştır
            </label>
            <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer", color:showGrid?ACC:"#a4b0be"}}>
              <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} />📐 Izgara
            </label>
            {/* Only show animation toggle for tilesets that actually have animated rows (e.g. waterfalls) */}
            {activeTileset.animatedRows !== undefined && (
              <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer", color:animated?"#54a0ff":"#a4b0be"}}>
                <input type="checkbox" checked={animated} onChange={e=>setAnimated(e.target.checked)} />💧 Su Animasyonu
              </label>
            )}
          </div>

          {/* Tile Behavior Flags */}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:"7px", marginTop:"2px"}}>
            <div style={{fontSize:"8px", color:"#636e72", marginBottom:"5px", textTransform:"uppercase"}}>Karo Davranışı</div>
            <div style={{display:"flex", gap:"10px", flexWrap:"wrap"}}>
              <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer",
                color:tileIsWater?"#54a0ff":"#a4b0be", fontWeight:tileIsWater?"bold":"normal"}}
                title="Bu karonun üzerine gelince oyuncu yüzer">
                <input type="checkbox" checked={tileIsWater} onChange={e=>{setTileIsWater(e.target.checked); if(e.target.checked){setTileIsSolid(false);}}} />
                🌊 Su Alanı
              </label>
              <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer",
                color:tileIsSolid?"#ff4757":"#a4b0be", fontWeight:tileIsSolid?"bold":"normal"}}
                title="Bu karonun içinden geçilemez">
                <input type="checkbox" checked={tileIsSolid} onChange={e=>{setTileIsSolid(e.target.checked); if(e.target.checked){setTileIsWater(false);}}} />
                🧱 Engel
              </label>
              <label style={{display:"flex", alignItems:"center", gap:"4px", fontSize:"9px", cursor:"pointer",
                color:tileIsClimbable?"#2ed573":"#a4b0be", fontWeight:tileIsClimbable?"bold":"normal"}}
                title="Bu karonun üzerinde tırmanılabilir">
                <input type="checkbox" checked={tileIsClimbable} onChange={e=>setTileIsClimbable(e.target.checked)} />
                🪜 Tırmanma
              </label>
            </div>
            {tileIsWater && <div style={{fontSize:"8px", color:"#54a0ff", marginTop:"4px", fontStyle:"italic"}}>✅ Bu karo üzerinde oyuncular yüzer</div>}
            {tileIsSolid && <div style={{fontSize:"8px", color:"#ff4757", marginTop:"4px", fontStyle:"italic"}}>✅ Bu karo içinden geçilmez</div>}
            {!tileIsWater && !tileIsSolid && !tileIsClimbable && <div style={{fontSize:"8px", color:"#636e72", marginTop:"4px", fontStyle:"italic"}}>Varsayılan: geçilebilir zemin (yüzme yok)</div>}
          </div>
        </div>
      </div>

      {/* Browser */}
      <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
        {/* Category tabs */}
        <div style={{display:"flex", overflowX:"auto", flexShrink:0, borderBottom:`1px solid ${BDR}`, background:"rgba(0,0,0,0.25)"}}>
          {categories.map(cat => (
            <button key={cat} onClick={() => {
              setActiveCategory(cat);
              const first = TERRAIN_TILESETS.find(t => t.category===cat);
              if (first) { setActiveTilesetKey(first.key); setSelection(null); }
            }} style={{padding:"8px 12px", fontSize:"9px", whiteSpace:"nowrap",
              background:activeCategory===cat?ACCB:"transparent", border:"none",
              borderBottom:activeCategory===cat?`2px solid ${ACC}`:"2px solid transparent",
              color:activeCategory===cat?ACC:"#636e72", cursor:"pointer", fontFamily:"'Outfit',sans-serif"}}>
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Tileset cards */}
        <div style={{display:"flex", gap:"5px", padding:"8px 10px", flexShrink:0, overflowX:"auto",
          borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.12)"}}>
          {TERRAIN_TILESETS.filter(t => t.category===activeCategory).map(ts => (
            <button key={ts.key} onClick={() => { setActiveTilesetKey(ts.key); setSelection(null); }} style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:"3px", padding:"6px 9px", whiteSpace:"nowrap",
              background:activeTilesetKey===ts.key?ACCB:"rgba(255,255,255,0.04)",
              border:`1px solid ${activeTilesetKey===ts.key?ACC:"rgba(255,255,255,0.1)"}`,
              borderRadius:"6px", cursor:"pointer", color:activeTilesetKey===ts.key?ACC:"#a4b0be",
              fontSize:"9px", fontFamily:"'Outfit',sans-serif", transition:"all .12s",
              boxShadow:activeTilesetKey===ts.key?`0 0 8px ${ACC}30`:"none",
            }}>
              <span style={{fontSize:"16px"}}>{ts.emoji}</span><span>{ts.label}</span>
              <span style={{fontSize:"7px", color:"#636e72"}}>{ts.tileW}×{ts.tileH}px</span>
            </button>
          ))}
          {TERRAIN_TILESETS.filter(t => t.category===activeCategory).length===0 && (
            <div style={{fontSize:"9px", color:"#636e72", padding:"10px", fontStyle:"italic", lineHeight:"1.6"}}>
              Bu kategori için henüz tileset eklenmedi.<br/>Dosyaları yükle → TERRAIN_TILESETS'e ekle.
            </div>
          )}
        </div>

        {/* Zoom & Grid Size */}
        <div style={{display:"flex", alignItems:"center", gap:"7px", padding:"5px 12px",
          borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.18)", flexShrink:0, flexWrap:"wrap"}}>
          <span style={{fontSize:"9px", color:"#636e72"}}>🔍 Zoom:</span>
          {[1,2,3,4].map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{padding:"2px 7px", fontSize:"9px",
              background:zoom===z?ACCB:"rgba(255,255,255,0.04)", border:`1px solid ${zoom===z?ACC:"rgba(255,255,255,0.1)"}`,
              borderRadius:"4px", cursor:"pointer", color:zoom===z?ACC:"#a4b0be"}}>{z}×</button>
          ))}

          <span style={{marginLeft:"15px", fontSize:"9px", color:"#636e72"}}>📐 Grid:</span>
          {[16, 32, 64, 8].map(g => (
            <button key={g} onClick={() => setGridSize(g)} style={{padding:"2px 7px", fontSize:"9px",
              background:gridSize===g?ACCB:"rgba(255,255,255,0.04)", border:`1px solid ${gridSize===g?ACC:"rgba(255,255,255,0.1)"}`,
              borderRadius:"4px", cursor:"pointer", color:gridSize===g?ACC:"#a4b0be"}}>{g}×{g}px</button>
          ))}

          <span style={{marginLeft:"auto", fontSize:"9px", color:"#636e72"}}>{displayCols}×{displayRows} tile</span>
        </div>

        {/* Selection bar */}
        {selection && (
          <div style={{padding:"4px 12px", fontSize:"9px", flexShrink:0, background:"rgba(0,100,220,0.13)",
            borderBottom:"1px solid rgba(0,120,255,0.3)", display:"flex", gap:"10px", color:"#54a0ff", flexWrap:"wrap"}}>
            <span>✅ ({selection.startCol},{selection.startRow})→({selection.endCol},{selection.endRow})</span>
            <span>📐 {selW}×{selH}</span>
            {activeTileset.animatedRows !== undefined && (
              <span>{isAnimSel ? "💧 Akan Su (Animasyonlu)" : "🪨 Statik"}</span>
            )}
          </div>
        )}

        {/* PICKER */}
        <div ref={containerRef} style={{flex:1, overflow:"auto", padding:"8px", background:"rgba(0,0,0,0.35)"}}>
          <div style={{ position:"relative", width:`${displayCols*displayedTilePx}px`, height:`${displayRows*displayedTilePx}px`,
            cursor:tool==="picker"?"crosshair":"cell", userSelect:"none", flexShrink:0 }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <img src={`/assets/${activeTileset.file}`} style={{
              display:"block", width:`${activeTileset.sheetW*zoom}px`, height:`${activeTileset.sheetH*zoom}px`,
              imageRendering:"pixelated",
              clipPath:activeTileset.animatedRows!==undefined?`inset(0 0 ${activeTileset.sheetH*zoom/2}px 0)`:undefined,
              marginBottom:activeTileset.animatedRows!==undefined?`-${activeTileset.sheetH*zoom/2}px`:0,
              pointerEvents:"none",
            }} alt={activeTileset.label} draggable={false} />
            {showGrid && (
              <svg style={{position:"absolute",top:0,left:0,width:`${displayCols*displayedTilePx}px`,height:`${displayRows*displayedTilePx}px`,pointerEvents:"none"}}
                viewBox={`0 0 ${displayCols*displayedTilePx} ${displayRows*displayedTilePx}`}>
                {Array.from({length:displayCols+1},(_,i)=><line key={`v${i}`} x1={i*displayedTilePx} y1={0} x2={i*displayedTilePx} y2={displayRows*displayedTilePx} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>)}
                {Array.from({length:displayRows+1},(_,i)=><line key={`h${i}`} x1={0} y1={i*displayedTilePx} x2={displayCols*displayedTilePx} y2={i*displayedTilePx} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>)}
                {activeTileset.animatedRows!==undefined && <line x1={0} y1={activeTileset.animatedRows*displayedTilePx} x2={displayCols*displayedTilePx} y2={activeTileset.animatedRows*displayedTilePx} stroke="#54a0ff" strokeWidth="1.5" strokeDasharray="6 3"/>}
                {activeTileset.key.startsWith("wf_") && Array.from({length:displayCols/4+1},(_,i)=><line key={`s${i}`} x1={i*4*displayedTilePx} y1={0} x2={i*4*displayedTilePx} y2={displayRows*displayedTilePx} stroke="rgba(255,200,50,0.3)" strokeWidth="1"/>)}
                {selection && (<>
                  <rect x={selection.startCol*displayedTilePx} y={selection.startRow*displayedTilePx}
                    width={(selection.endCol-selection.startCol+1)*displayedTilePx} height={(selection.endRow-selection.startRow+1)*displayedTilePx}
                    fill="rgba(0,184,217,0.22)" stroke={ACC} strokeWidth="2"/>
                  <circle cx={selection.startCol*displayedTilePx} cy={selection.startRow*displayedTilePx} r="3" fill={ACC}/>
                  <circle cx={(selection.endCol+1)*displayedTilePx} cy={(selection.endRow+1)*displayedTilePx} r="3" fill={ACC}/>
                </>)}
              </svg>
            )}
          </div>
          {activeTileset.animatedRows!==undefined && (
            <div style={{marginTop:"8px", display:"flex", flexDirection:"column", gap:"3px"}}>
              <div style={{fontSize:"8px",color:"#54a0ff"}}>━━ Mavi çizgi: Üst = Animasyonlu (akan su) / Alt = Statik</div>
              <div style={{fontSize:"8px",color:"#ffd32a"}}>━━ Sarı çizgi: Şelale bölüm sınırları (4 sütun)</div>
              <div style={{fontSize:"8px",color:"#a4b0be"}}>🖱️ Sürükle = Çoklu tile seç | Tıkla = Tek tile seç</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:"8px 14px", flexShrink:0, borderTop:`1px solid ${BDR}`, background:"rgba(0,0,0,0.45)",
        display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{fontSize:"8px", color:"#636e72"}}>
          <span style={{color:ACC, fontFamily:"'Press Start 2P'", fontSize:"6px"}}>{activeTileset.emoji} {activeTileset.label}</span><br/>
          {selection?`Seçim: ${selW}×${selH} tile → Haritaya tıkla/sürükle`:"Tile seçmek için yukarıya tıkla"}
        </div>
        <div style={{fontSize:"7px", color:"#636e72", textAlign:"right"}}>[P] Boya [E] Sil<br/>[F] Doldur [T] Kapat</div>
      </div>
    </div>
  );
}
