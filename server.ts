import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiplayerRoom, MultiplayerPlayer, Mission, Enemy, AIState } from './types.js';

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
          enemies: []
        };
      }

      const player: MultiplayerPlayer = {
        id: socket.id,
        position: [0, 1.8, 10],
        rotation: [0, 0, 0],
        health: 100,
        currentWeapon: 'PISTOL' as any,
        isFiring: false,
        name: playerName || `Agent ${socket.id.slice(0, 4)}`
      };

      rooms[roomId].players[socket.id] = player;

      // Send current state to joined player
      socket.emit('room-state', rooms[roomId]);

      // Broadcast new player to others
      socket.to(roomId).emit('player-joined', player);
      
      console.log(`Player ${playerName} joined room ${roomId}`);
    });

    socket.on('update-player', ({ roomId, player }: { roomId: string, player: Partial<MultiplayerPlayer> }) => {
      if (rooms[roomId] && rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id] = { ...rooms[roomId].players[socket.id], ...player };
        socket.to(roomId).emit('player-updated', rooms[roomId].players[socket.id]);
      }
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
