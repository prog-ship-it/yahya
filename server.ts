import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiplayerRoom, MultiplayerPlayer, Mission, Enemy, AIState, GameMode, Team, WeaponType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const rooms: Record<string, MultiplayerRoom> = {};

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, playerName }: { roomId: string, playerName: string }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: {},
          mission: null,
          enemies: [],
          gameMode: GameMode.COOP,
          scores: { [Team.NEON]: 0, [Team.VOID]: 0 },
          flags: []
        };
      }

      const teamCount = { [Team.NEON]: 0, [Team.VOID]: 0 };
      Object.values(rooms[roomId].players).forEach(p => {
        if (p.team !== Team.NONE) teamCount[p.team]++;
      });

      // Simple team balancing
      const assignedTeam = teamCount[Team.NEON] <= teamCount[Team.VOID] ? Team.NEON : Team.VOID;

      let uniqueName = playerName || `Agent ${socket.id.slice(0, 4)}`;
      const existingPlayers = Object.values(rooms[roomId].players);
      let count = 1;
      while (existingPlayers.find(p => p.name === uniqueName)) {
        uniqueName = `${playerName} (${count++})`;
      }

      const player: MultiplayerPlayer = {
        id: socket.id,
        position: [0, 1.8, 10],
        rotation: [0, 0, 0],
        health: 100,
        currentWeapon: WeaponType.PISTOL,
        isFiring: false,
        name: uniqueName,
        team: assignedTeam,
        kills: 0,
        deaths: 0
      };

      rooms[roomId].players[socket.id] = player;

      socket.emit('room-state', rooms[roomId]);
      socket.to(roomId).emit('player-joined', player);
      
      console.log(`Player ${playerName} joined room ${roomId} as ${assignedTeam}`);
    });

    socket.on('set-game-mode', ({ roomId, mode }: { roomId: string, mode: GameMode }) => {
      if (rooms[roomId]) {
        rooms[roomId].gameMode = mode;
        rooms[roomId].scores = { [Team.NEON]: 0, [Team.VOID]: 0 };
        
        // Reset flags for CTF
        if (mode === GameMode.CTF) {
          rooms[roomId].flags = [
            { id: 'flag-neon', team: Team.NEON, position: [-40, 0, 0], isHeld: false },
            { id: 'flag-void', team: Team.VOID, position: [40, 0, 0], isHeld: false }
          ];
        } else {
          rooms[roomId].flags = [];
        }

        io.in(roomId).emit('mode-updated', { mode, flags: rooms[roomId].flags });
      }
    });

    socket.on('update-player', ({ roomId, player }: { roomId: string, player: Partial<MultiplayerPlayer> }) => {
      if (rooms[roomId] && rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id] = { ...rooms[roomId].players[socket.id], ...player };
        socket.to(roomId).emit('player-updated', rooms[roomId].players[socket.id]);
      }
    });

    socket.on('player-hit', ({ roomId, targetId, damage, dealerId }: { roomId: string, targetId: string, damage: number, dealerId: string }) => {
      if (rooms[roomId]) {
        const target = rooms[roomId].players[targetId];
        const dealer = rooms[roomId].players[dealerId];
        
        if (target && target.health > 0) {
            // Friendly fire check
            if (rooms[roomId].gameMode === GameMode.TDM || rooms[roomId].gameMode === GameMode.CTF) {
                if (dealer && dealer.team === target.team) return;
            }

            target.health -= damage;
            if (target.health <= 0) {
                target.health = 0;
                target.deaths++;
                if (dealer) {
                    dealer.kills++;
                    
                    // Score updates
                    if (rooms[roomId].gameMode === GameMode.TDM) {
                        rooms[roomId].scores[dealer.team]++;
                    } else if (rooms[roomId].gameMode === GameMode.FFA) {
                        rooms[roomId].scores[dealerId] = (rooms[roomId].scores[dealerId] || 0) + 1;
                    }
                    
                    io.in(roomId).emit('score-updated', rooms[roomId].scores);
                }
            }
            io.in(roomId).emit('player-updated', target);
            if (dealer) io.in(roomId).emit('player-updated', dealer);
        }
      }
    });

    socket.on('flag-action', ({ roomId, flagId, playerId, action }: { roomId: string, flagId: string, playerId: string, action: 'pickup' | 'capture' | 'drop' | 'return' }) => {
      const room = rooms[roomId];
      if (!room) return;

      const flag = room.flags.find(f => f.id === flagId);
      const player = room.players[playerId];
      if (!flag || !player) return;

      if (action === 'pickup') {
        flag.isHeld = true;
        flag.heldBy = playerId;
        player.flagId = flagId;
      } else if (action === 'drop') {
        flag.isHeld = false;
        flag.heldBy = null;
        player.flagId = null;
        flag.position = player.position;
      } else if (action === 'capture') {
        // Redefine flag position to home
        flag.isHeld = false;
        flag.heldBy = null;
        player.flagId = null;
        flag.position = flag.team === Team.NEON ? [-40, 0, 0] : [40, 0, 0];
        
        room.scores[player.team] += 100;
        io.in(roomId).emit('score-updated', room.scores);
        io.in(roomId).emit('announcement', `${player.name} CAPTURED THE ${flag.team} FLAG!`);
      } else if (action === 'return') {
        flag.isHeld = false;
        flag.heldBy = null;
        flag.position = flag.team === Team.NEON ? [-40, 0, 0] : [40, 0, 0];
        io.in(roomId).emit('announcement', `${player.name} RETURNED THE ${flag.team} FLAG!`);
      }

      io.in(roomId).emit('flags-updated', room.flags);
      io.in(roomId).emit('player-updated', player);
    });

    socket.on('sync-mission', ({ roomId, mission, enemies }: { roomId: string, mission: Mission, enemies: Enemy[] }) => {
      if (rooms[roomId]) {
        rooms[roomId].mission = mission;
        rooms[roomId].enemies = enemies;
        socket.to(roomId).emit('mission-synced', { mission, enemies });
      }
    });

    socket.on('enemy-hit', ({ roomId, enemyId, damage }: { roomId: string, enemyId: string, damage: number }) => {
      if (rooms[roomId]) {
        const enemy = rooms[roomId].enemies.find(e => e.id === enemyId);
        if (enemy && enemy.isAlive) {
          enemy.health -= damage;
          if (enemy.health <= 0) {
            enemy.health = 0;
            enemy.isAlive = false;
          }
          io.in(roomId).emit('enemy-updated', enemy);
        }
      }
    });

    socket.on('fire-weapon', ({ roomId, weaponType }: { roomId: string, weaponType: string }) => {
      socket.to(roomId).emit('player-fired', { playerId: socket.id, weaponType });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const roomId in rooms) {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          io.in(roomId).emit('player-left', socket.id);
          
          // Clean up empty rooms
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
