import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { Client, type Room } from "colyseus.js";
import { GameScene, WORLD_WIDTH, WORLD_HEIGHT } from "./scenes/GameScene";
import type { CharacterSelectData } from "../ui/CharacterSelect";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLYSEUS_ENDPOINT = "ws://localhost:2567";
const ROOM_TYPE = "game_room";

// Suppress unused import warning — these are exported for consumers
export { WORLD_WIDTH, WORLD_HEIGHT };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

export interface GameMeta {
  sessionId:   string;
  playerColor: string;
  playerName:  string;
  roomId:      string;
  playerCount: number;
  equippedHat: string;
  equippedTool: string;
  action:      string;
  helmet:      string;
  chestplate:  string;
  leggings:    string;
  boots:       string;
  mount:       string;
}

interface PhaserGameProps {
  onStatusChange?:  (status: ConnectionStatus) => void;
  onMetaChange?:    (meta: GameMeta | null) => void;
  onRoomJoin?:      (room: Room) => void;
  characterData?:   CharacterSelectData | null;
}

// ---------------------------------------------------------------------------
// PhaserGame Component
// ---------------------------------------------------------------------------

/**
 * Mounts the Phaser canvas once and keeps it alive for the entire session.
 * Never unmounts/remounts — doing so would cause double Colyseus joins and
 * the "Cannot read properties of null (reading 'add')" Phaser crash.
 *
 * Architecture:
 *  1. Create Colyseus room
 *  2. Inject room into Phaser registry BEFORE booting the game
 *  3. Boot Phaser — GameScene.create() reads the room from registry
 *  4. Report status/meta changes upward via callbacks
 */
export function PhaserGame({ onStatusChange, onMetaChange, onRoomJoin, characterData }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const roomRef      = useRef<Room | null>(null);
  // Keep latest callback refs so the async bootstrap closure always calls
  // the current version without needing them as useEffect dependencies
  const onStatusRef = useRef(onStatusChange);
  const onMetaRef   = useRef(onMetaChange);
  const onRoomRef   = useRef(onRoomJoin);

  // Always keep refs current
  onStatusRef.current = onStatusChange;
  onMetaRef.current   = onMetaChange;
  onRoomRef.current   = onRoomJoin;

  // Always keep refs current
  onStatusRef.current = onStatusChange;
  onMetaRef.current   = onMetaChange;

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return; // already booted

    let cancelled = false;

    async function bootstrap(): Promise<void> {
      onStatusRef.current?.("connecting");

      // ------------------------------------------------------------------
      // 1. Join Colyseus room
      // ------------------------------------------------------------------
      const client = new Client(COLYSEUS_ENDPOINT);
      let room: Room;

      try {
        room = await client.joinOrCreate(ROOM_TYPE, {
          username:     characterData?.username     ?? "Player",
          gender:       characterData?.gender       ?? "male",
          skinTone:     characterData?.skinTone     ?? 1,
          eyeColor:     characterData?.eyeColor     ?? "Black",
          clothesColor: characterData?.clothesColor ?? "Blue",
          hairStyle:    characterData?.hairStyle    ?? "Standart",
          hairColor:    characterData?.hairColor    ?? "Black",
        });
      } catch (err) {
        console.error("[PhaserGame] Failed to join room:", err);
        if (!cancelled) onStatusRef.current?.("error");
        return;
      }

      if (cancelled) { room.leave(); return; }

       roomRef.current = room;
      onStatusRef.current?.("connected");
      onRoomRef.current?.(room);

      console.log(`[PhaserGame] Joined room: ${room.roomId} | session: ${room.sessionId}`);

      // ------------------------------------------------------------------
      // 2. Listen for state changes to populate HUD metadata
      // ------------------------------------------------------------------
      room.onStateChange.once(() => {
        const p = room.state.players.get(room.sessionId);
        if (p) {
          onMetaRef.current?.({
            sessionId:   room.sessionId,
            playerColor: p.color   as string,
            playerName:  p.name    as string,
            roomId:      room.roomId,
            playerCount: (room.state.players as Map<string, unknown>).size,
            equippedHat: (p.hat as string) || "",
            equippedTool: (p.equippedTool as string) || "none",
            action: (p.action as string) || "none",
            helmet: (p.helmet as string) || "none",
            chestplate: (p.chestplate as string) || "none",
            leggings: (p.leggings as string) || "none",
            boots: (p.boots as string) || "none",
            mount: (p.mount as string) || "none",
          });
        }
      });

      // Keep player count up to date
      room.onStateChange(() => {
        const count = (room.state.players as Map<string, unknown>).size;
        const p = room.state.players.get(room.sessionId);
        if (p) {
          onMetaRef.current?.({
            sessionId:   room.sessionId,
            playerColor: p.color   as string,
            playerName:  p.name    as string,
            roomId:      room.roomId,
            playerCount: count,
            equippedHat: (p.hat as string) || "",
            equippedTool: (p.equippedTool as string) || "none",
            action: (p.action as string) || "none",
            helmet: (p.helmet as string) || "none",
            chestplate: (p.chestplate as string) || "none",
            leggings: (p.leggings as string) || "none",
            boots: (p.boots as string) || "none",
            mount: (p.mount as string) || "none",
          });
        }
      });

      room.onLeave(() => {
        if (!cancelled) onStatusRef.current?.("disconnected");
      });

      // ------------------------------------------------------------------
      // 3. Inject room into registry BEFORE Phaser boots
      //    (Phaser boot is async — registry values are available in create())
      // ------------------------------------------------------------------
      const tempRegistry = new Map<string, unknown>();
      tempRegistry.set("room",      room);
      tempRegistry.set("sessionId", room.sessionId);

      // ------------------------------------------------------------------
      // 4. Boot Phaser
      // ------------------------------------------------------------------
      const config: Phaser.Types.Core.GameConfig = {
        type:            Phaser.AUTO,
        parent:          containerRef.current!,
        width:           "100%",
        height:          "100%",
        backgroundColor: "#0d2918",
        scale: {
          mode:      Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width:     "100%",
          height:    "100%",
        },
        physics: {
          default: "arcade",
          arcade:  { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene:  [GameScene],
        banner: false,
        render: {
          antialias:   false,
          pixelArt:    true,
          roundPixels: true,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      // Set registry values immediately after creation —
      // Phaser.Game.boot() is sync but scene.create() runs on next tick,
      // so these values are guaranteed to be available in GameScene.create()
      game.registry.set("room",      room);
      game.registry.set("sessionId", room.sessionId);

      // Copy any pre-boot registry values
      tempRegistry.forEach((v, k) => game.registry.set(k, v));
    }

    bootstrap();

    // Cleanup: leave room + destroy Phaser on component unmount
    return () => {
      cancelled = true;
      try { roomRef.current?.leave(); } catch { /* ignore */ }
      roomRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — bootstrap runs exactly once

  return (
    <div
      ref={containerRef}
      id="phaser-container"
      style={{
        position: "absolute",
        inset:    0,
        width:    "100%",
        height:   "100%",
        outline:  "none",
      }}
      tabIndex={0}
    />
  );
}
