# 🎮 MMORPG Phase 1 — MVP

A browser-based multiplayer RPG built with Vite + React + Phaser.js on the client and Node.js + Colyseus on the server.

## Project Structure

```
mmorpg/
├── client/   → Vite + React + Phaser.js (port 5173)
└── server/   → Node.js + Colyseus (port 2567)
```

## Quick Start

### 1. Start the Server
```bash
cd server
npm install
npm run dev
```

### 2. Start the Client (in a new terminal)
```bash
cd client
npm install
npm run dev
```

### 3. Open the Game
Go to `http://localhost:5173` in **two browser tabs** to see real-time multiplayer sync.

## Controls
- **WASD** or **Arrow Keys** — Move your character
- Each player is assigned a unique color

## Architecture
- **Authoritative Server**: The server owns all game state. Clients send input, not positions.
- **Colyseus Rooms**: Players join `game_room`. State is synced via delta patches.
- **Phaser.js**: Handles all 2D canvas rendering inside a React component.
- **React**: Manages UI overlays (HUD, chat, inventory — future phases).
