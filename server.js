// server.js (ESM)
import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files (index.html, src, public, etc.)
const PUBLIC_DIR = __dirname;
app.use(express.static(PUBLIC_DIR));

// --- in-memory game state ---
const players = {}; // id -> { id, name, color, x, z, points, missStreak, wins, ready }

function getOpponentId(id) {
  return Object.keys(players).find(pid => pid !== id) || null;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // player joins with name + color
  socket.on('join', ({ name, color }) => {
    if (Object.keys(players).length >= 2) {
      socket.emit('sessionFull');
      return;
    }

    const teamColor = color === 'red' ? 'red' : 'blue';

    players[socket.id] = {
      id: socket.id,
      name: name || `Player-${socket.id.slice(0, 4)}`,
      color: teamColor,
      x: 0,
      z: 0,
      points: 0,
      missStreak: 0,
      wins: 0,
      ready: false,
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  // movement along keeper line
  socket.on('playerMove', ({ x, z }) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = x;
    p.z = z;
    socket.broadcast.emit('playerMoved', { id: socket.id, x, z });
  });

  // result of a shot: 'goal', 'miss', 'save'
  socket.on('shotResult', ({ result }) => {
    const p = players[socket.id];
    if (!p) return;

    if (result === 'goal') {
      // 10 pts per goal in this 1v1 mode
      p.points += 10;
      p.missStreak = 0;
    } else {
      p.missStreak += 1;
    }

    // send updated scoreboard to everyone
    io.emit('scoreUpdate', { players });

    // check win/lose conditions
    let winnerId = null;
    let loserId = null;
    let reason = null;

    if (p.points >= 50) {
      winnerId = socket.id;
      loserId = getOpponentId(socket.id);
      reason = 'points'; // first to 50
    } else if (p.missStreak >= 3) {
      loserId = socket.id;
      winnerId = getOpponentId(socket.id);
      reason = 'misses'; // first to miss 3 in a row
    }

    if (winnerId && loserId) {
      if (players[winnerId]) {
        players[winnerId].wins += 1;
      }

      // reset match-specific stats, keep wins
      Object.values(players).forEach((pl) => {
        pl.points = 0;
        pl.missStreak = 0;
        pl.ready = false;
      });

      io.emit('matchOver', {
        winnerId,
        loserId,
        reason,
        players,
      });
    }
  });

  // ready / rematch system
  socket.on('playerReady', ({ ready }) => {
    const p = players[socket.id];
    if (!p) return;
    p.ready = !!ready;

    const totalPlayers = Object.keys(players).length;
    const readyCount = Object.values(players).filter(pl => pl.ready).length;

    io.emit('readyStatus', { readyCount, totalPlayers });

    // start a new match if both of the 2 players are ready
    if (totalPlayers === 2 && readyCount === 2) {
      Object.values(players).forEach((pl) => {
        pl.points = 0;
        pl.missStreak = 0;
        pl.ready = false;
      });

      io.emit('newMatchStart', { players });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    io.emit('sessionOver');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});