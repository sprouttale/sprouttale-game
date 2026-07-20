import React, { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";

interface MinimapProps {
  room: Room<any> | null;
  sessionId: string;
  worldWidth?: number;
  worldHeight?: number;
  playerCount?: number;
}

export const Minimap: React.FC<MinimapProps> = ({
  room,
  sessionId,
  worldWidth = 25000,
  worldHeight = 25000,
  playerCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<"world" | "radar">("world");
  const [minimized, setMinimized] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ x: number; y: number }>({ x: worldWidth / 2, y: worldHeight / 2 });

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Clear background
      ctx.fillStyle = "#0a1912";
      ctx.fillRect(0, 0, w, h);

      // Draw faint tactical grid
      ctx.strokeStyle = "rgba(46, 213, 115, 0.08)";
      ctx.lineWidth = 1;
      const gridStep = w / 8;
      for (let x = 0; x <= w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Check if room and room.state exist
      if (!room || !room.state) {
        ctx.fillStyle = "#a4b0be";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bağlanıyor...", w / 2, h / 2);
        animId = requestAnimationFrame(render);
        return;
      }

      // Get current player position
      let myX = worldWidth / 2;
      let myY = worldHeight / 2;
      const myPlayer = room.state.players?.get ? room.state.players.get(sessionId) : null;
      if (myPlayer) {
        myX = myPlayer.x;
        myY = myPlayer.y;
        setMyCoords({ x: Math.round(myX), y: Math.round(myY) });
      }

      // Determine view range depending on mode
      // mode == 'world': entire 50000x50000
      // mode == 'radar': 4000x4000 centered on player
      let viewMinX = 0;
      let viewMinY = 0;
      let viewWidth = worldWidth;
      let viewHeight = worldHeight;

      if (mode === "radar") {
        const radarSize = 4000;
        viewMinX = myX - radarSize / 2;
        viewMinY = myY - radarSize / 2;
        viewWidth = radarSize;
        viewHeight = radarSize;
      }

      const worldToMini = (wx: number, wy: number) => {
        const mx = ((wx - viewMinX) / viewWidth) * w;
        const my = ((wy - viewMinY) / viewHeight) * h;
        return { x: mx, y: my };
      };

      // ── 1. DRAW PLACED MAP OBJECTS ──────────────────────────────────────────
      if (room.state.mapObjects) {
        room.state.mapObjects.forEach((obj: any) => {
          if (!obj) return;
          const pos = worldToMini(obj.x, obj.y);

          // Skip drawing if outside radar view
          if (pos.x < -10 || pos.x > w + 10 || pos.y < -10 || pos.y > h + 10) return;

          const assetId = (obj.assetId || "").toLowerCase();
          let color = "#54a0ff"; // Default cyan
          let size = Math.max(2, Math.min(6, (32 / viewWidth) * w * (obj.scaleX || 1)));

          if (obj.isWater || assetId.includes("water") || assetId.includes("sea") || assetId.includes("wf_") || assetId.includes("well") || assetId.includes("fountain")) {
            color = "#00d2d3"; // Water Blue
          } else if (assetId.includes("tree") || assetId.includes("wood") || assetId.includes("plant") || assetId.includes("bush")) {
            color = "#10ac84"; // Emerald Green
            size = Math.max(3, size);
          } else if (assetId.includes("house") || assetId.includes("barn") || assetId.includes("temple") || assetId.includes("building") || assetId.includes("decor")) {
            color = "#ff6b6b"; // House Red/Orange
            size = Math.max(4, size);
          } else if (assetId.includes("fence") || assetId.includes("bridge") || assetId.includes("road") || assetId.includes("insaat")) {
            color = "#c8d6e5"; // Stone / Wood grey
          } else if (assetId.includes("soil") || assetId.includes("crop")) {
            color = "#ff9f43"; // Golden soil/crop
          }

          ctx.fillStyle = color;
          if (mode === "radar") {
            ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
          } else {
            ctx.fillRect(pos.x - 1, pos.y - 1, 2, 2);
          }
        });
      }

      // ── 2. DRAW CAMERA VIEWPORT BOX ─────────────────────────────────────────
      const cam = (window as any).gameCamera;
      if (cam) {
        const camMin = worldToMini(cam.x, cam.y);
        const camMax = worldToMini(cam.x + cam.width, cam.y + cam.height);
        const boxW = camMax.x - camMin.x;
        const boxH = camMax.y - camMin.y;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(camMin.x, camMin.y, boxW, boxH);
        ctx.fillStyle = "rgba(0, 210, 211, 0.08)";
        ctx.fillRect(camMin.x, camMin.y, boxW, boxH);
      }

      // ── 3. DRAW ONLINE PLAYERS ──────────────────────────────────────────────
      if (room.state.players) {
        const now = Date.now();
        const pulse = (Math.sin(now / 200) + 1) / 2; // 0..1 smooth pulse

        room.state.players.forEach((p: any, key: string) => {
          if (!p) return;
          const pos = worldToMini(p.x, p.y);
          const isMe = key === sessionId;

          if (pos.x < -15 || pos.x > w + 15 || pos.y < -15 || pos.y > h + 15) return;

          if (isMe) {
            // Local Player: Bright Pulsing Lime Star
            ctx.fillStyle = "#00ff88";
            ctx.shadowColor = "#00ff88";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4 + pulse * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Mini directional halo ring
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // Other Online Players: Bright Pulsing Colored Dots
            const playerColor = p.color || "#ff4757";
            ctx.fillStyle = playerColor;
            ctx.shadowColor = playerColor;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Player name label on radar mode or hover
            if (mode === "radar") {
              ctx.fillStyle = "#ffffff";
              ctx.font = "8px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(p.name || "Oyuncu", pos.x, pos.y - 6);
            }
          }
        });
      }

      // Outer border outline
      ctx.strokeStyle = "rgba(0, 210, 211, 0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [room, sessionId, worldWidth, worldHeight, mode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let targetX = (clickX / canvas.width) * worldWidth;
    let targetY = (clickY / canvas.height) * worldHeight;

    if (mode === "radar" && room && room.state) {
      const myPlayer = room.state.players?.get ? room.state.players.get(sessionId) : null;
      if (myPlayer) {
        const radarSize = 4000;
        const viewMinX = myPlayer.x - radarSize / 2;
        const viewMinY = myPlayer.y - radarSize / 2;
        targetX = viewMinX + (clickX / canvas.width) * radarSize;
        targetY = viewMinY + (clickY / canvas.height) * radarSize;
      }
    }

    // Dispatch camera navigation event to Phaser
    window.dispatchEvent(
      new CustomEvent("minimap_navigate", {
        detail: { x: Math.round(targetX), y: Math.round(targetY) },
      })
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !room || !room.state || !room.state.players) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let wx = (clickX / canvas.width) * worldWidth;
    let wy = (clickY / canvas.height) * worldHeight;

    if (mode === "radar") {
      const myPlayer = room.state.players.get ? room.state.players.get(sessionId) : null;
      if (myPlayer) {
        const radarSize = 4000;
        wx = (myPlayer.x - radarSize / 2) + (clickX / canvas.width) * radarSize;
        wy = (myPlayer.y - radarSize / 2) + (clickY / canvas.height) * radarSize;
      }
    }

    // Check if mouse is near any player
    let foundPlayer: string | null = null;
    room.state.players.forEach((p: any) => {
      if (!p) return;
      const dx = p.x - wx;
      const dy = p.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) < (mode === "radar" ? 300 : 2500)) {
        foundPlayer = `👤 ${p.name || "Oyuncu"} (${Math.round(p.x)}, ${Math.round(p.y)})`;
      }
    });

    setHoverInfo(foundPlayer);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 9990,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "4px",
        userSelect: "none",
      }}
    >
      {/* Header bar */}
      <div
        className="glass"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: minimized ? "110px" : "200px",
          padding: "4px 8px",
          borderRadius: "6px 6px 0 0",
          fontFamily: "'Press Start 2P', sans-serif",
          fontSize: "8px",
          color: "#00d2d3",
          border: "1px solid rgba(0, 210, 211, 0.3)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          transition: "width 0.2s ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          🗺️ HARİTA
          {playerCount !== undefined && (
            <span style={{ fontSize: "6.5px", color: "#2ed573", marginLeft: "2px" }}>
              ● {playerCount}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {!minimized && (
            <button
              onClick={() => setMode(mode === "world" ? "radar" : "world")}
              title={mode === "world" ? "Yakın Radar Görünümüne Geç" : "Tüm Dünya Görünümüne Geç"}
              style={{
                background: "rgba(0, 210, 211, 0.2)",
                border: "1px solid #00d2d3",
                color: "white",
                borderRadius: "3px",
                fontSize: "7px",
                padding: "2px 4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {mode === "world" ? "🌐 DÜNYA" : "📡 RADAR"}
            </button>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "white",
              borderRadius: "3px",
              fontSize: "8px",
              padding: "1px 4px",
              cursor: "pointer",
            }}
          >
            {minimized ? "➕" : "➖"}
          </button>
        </div>
      </div>

      {/* Main Minimap Body */}
      {!minimized && (
        <div
          className="glass"
          style={{
            position: "relative",
            width: "200px",
            height: "200px",
            borderRadius: "0 0 6px 6px",
            overflow: "hidden",
            border: "1px solid rgba(0, 210, 211, 0.3)",
            borderTop: "none",
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
          }}
        >
          <canvas
            ref={canvasRef}
            width={200}
            height={200}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              cursor: "crosshair",
            }}
          />

          {/* Coordinates Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "4px",
              background: "rgba(0,0,0,0.65)",
              color: "#2ed573",
              fontFamily: "'Press Start 2P', sans-serif",
              fontSize: "6px",
              padding: "2px 4px",
              borderRadius: "3px",
              border: "1px solid rgba(46, 213, 115, 0.3)",
              pointerEvents: "none",
            }}
          >
            X:{myCoords.x} Y:{myCoords.y}
          </div>

          {/* Hover Info Tooltip */}
          {hoverInfo && (
            <div
              style={{
                position: "absolute",
                top: "4px",
                left: "4px",
                background: "rgba(0,0,0,0.85)",
                color: "#feca57",
                fontFamily: "sans-serif",
                fontSize: "9px",
                fontWeight: "bold",
                padding: "2px 6px",
                borderRadius: "3px",
                border: "1px solid #feca57",
                pointerEvents: "none",
              }}
            >
              {hoverInfo}
            </div>
          )}

          {/* Legend indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              right: "4px",
              display: "flex",
              gap: "4px",
              background: "rgba(0,0,0,0.65)",
              padding: "2px 4px",
              borderRadius: "3px",
              fontSize: "6px",
              fontFamily: "'Press Start 2P', sans-serif",
              color: "#a4b0be",
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "#00ff88" }}>🟢 Sen</span>
            <span style={{ color: "#ff4757" }}>🔴 Diğer</span>
          </div>
        </div>
      )}
    </div>
  );
};
