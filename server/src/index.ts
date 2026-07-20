import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom";

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------
const app = express();

// Allow all origins in development.
// In production, replace with your actual client domain.
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Colyseus Server
// ---------------------------------------------------------------------------

/**
 * We attach Colyseus to a raw Node HTTP server (not Express directly).
 * This lets Colyseus handle WebSocket upgrades on the same port as HTTP.
 */
const httpServer = createServer(app);

const gameServer = new Server({
  server: httpServer,
});

// Register our game room. The string "game_room" is the room TYPE that clients
// use when calling client.joinOrCreate("game_room").
gameServer.define("game_room", GameRoom);

// ---------------------------------------------------------------------------
// Colyseus Monitor (Admin Dashboard)
// ---------------------------------------------------------------------------

// The monitor UI is available at http://localhost:2567/colyseus
// It lets you inspect active rooms, connected clients, and state in real time.
app.use("/colyseus", monitor());

import path from "path";

// ---------------------------------------------------------------------------
// Static Client Serving (Production & Live Deployment)
// ---------------------------------------------------------------------------
const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve frontend SPA fallback
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/colyseus") || req.path.startsWith("/health")) return next();
  const indexPath = path.join(clientDistPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// ---------------------------------------------------------------------------
// Start Listening
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 2567);

gameServer.listen(PORT).then(() => {
  console.log(`\n🎮 MMORPG Game Server running!`);
  console.log(`   WebSocket + HTTP → http://localhost:${PORT}`);
  console.log(`   Admin Monitor    → http://localhost:${PORT}/colyseus`);
  console.log(`   Health Check     → http://localhost:${PORT}/health\n`);
});
