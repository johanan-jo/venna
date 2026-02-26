const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// In-memory room store
const rooms = new Map();

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Grace period timers — prevent rooms from being deleted during page navigation
const roomDeleteTimers = new Map();

function scheduleRoomDelete(code, delay = 15000) {
    if (roomDeleteTimers.has(code)) clearTimeout(roomDeleteTimers.get(code));
    roomDeleteTimers.set(code, setTimeout(() => {
        const room = rooms.get(code);
        if (room && room.players.length === 0) {
            rooms.delete(code);
            console.log(`Room ${code} cleaned up (empty)`);
        }
        roomDeleteTimers.delete(code);
    }, delay));
}

function cancelRoomDelete(code) {
    if (roomDeleteTimers.has(code)) {
        clearTimeout(roomDeleteTimers.get(code));
        roomDeleteTimers.delete(code);
    }
}


io.on('connection', (socket) => {
    console.log('+ Player connected:', socket.id);

    socket.on('create-room', ({ gameId, gameName, playerName }, cb) => {
        const code = generateCode();
        const room = {
            code,
            gameId,
            gameName,
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName, isHost: true, score: 0 }],
            status: 'waiting',
        };
        rooms.set(code, room);
        socket.join(code);
        cb({ success: true, roomCode: code, room });
        console.log(`Room ${code} created for "${gameName}"`);
    });

    socket.on('join-room', ({ roomCode, playerName }, cb) => {
        const code = roomCode.toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return cb({ success: false, error: 'Room not found' });
        if (room.status !== 'waiting') return cb({ success: false, error: 'Game already started' });
        if (room.players.length >= 8) return cb({ success: false, error: 'Room is full' });

        room.players.push({ id: socket.id, name: playerName, isHost: false, score: 0 });
        socket.join(code);
        io.to(code).emit('room-update', { room });
        cb({ success: true, room });
        console.log(`"${playerName}" joined room ${code}`);
    });

    socket.on('get-room', ({ roomCode }, cb) => {
        const room = rooms.get(roomCode.toUpperCase());
        cb(room ? { room } : { error: 'Not found' });
    });

    // Rejoin after page navigation (new socket ID, same player name)
    socket.on('rejoin-room', ({ roomCode, playerName }, cb) => {
        const code = roomCode.toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return cb({ success: false, error: 'Room not found' });

        // Cancel any pending delete
        cancelRoomDelete(code);

        const existing = room.players.find(p => p.name === playerName);
        if (existing) {
            // Check host BEFORE overwriting the id
            const wasHost = room.hostId === existing.id;
            existing.id = socket.id;
            if (wasHost) room.hostId = socket.id;
        } else {
            // New name — add as a guest
            room.players.push({ id: socket.id, name: playerName, isHost: false, score: 0 });
        }

        socket.join(code);
        io.to(code).emit('room-update', { room });
        cb({ success: true, room });
        console.log(`"${playerName}" rejoined room ${code} (socket: ${socket.id}, host: ${room.hostId === socket.id})`);
    });


    socket.on('start-game', ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id) return;
        room.status = 'in-progress';
        io.to(code).emit('game-started', { room });
        console.log(`Game started in room ${code}`);
    });

    // Generic game action relay (turn-based, input sync, etc.)
    socket.on('game-action', ({ roomCode, action }) => {
        socket.to(roomCode.toUpperCase()).emit('game-action', { playerId: socket.id, action });
    });

    // Host broadcasts full game state (real-time games)
    socket.on('game-state', ({ roomCode, state }) => {
        socket.to(roomCode.toUpperCase()).emit('game-state', { state });
    });

    socket.on('game-end', ({ roomCode, results }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (room) {
            room.status = 'finished';
            // Update scores
            if (results) {
                results.forEach(r => {
                    const p = room.players.find(p => p.id === r.playerId);
                    if (p) p.score = (p.score || 0) + (r.score || 0);
                });
            }
        }
        io.to(code).emit('game-end', { results, room });
    });

    socket.on('play-again', ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id) return;
        room.status = 'waiting';
        io.to(code).emit('play-again', { room });
    });

    socket.on('chat-message', ({ roomCode, message, playerName }) => {
        io.to(roomCode.toUpperCase()).emit('chat-message', {
            playerName,
            message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
    });

    socket.on('disconnect', () => {
        console.log('- Player disconnected:', socket.id);
        for (const [code, room] of rooms.entries()) {
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx === -1) continue;

            if (room.status === 'waiting' || room.status === 'in-progress') {
                // Player is probably just navigating between lobby and game page.
                // Keep them in room.players so rejoin-room can find them by name.
                // Schedule cleanup in case they truly left.
                scheduleRoomDelete(code, 20000);
                console.log(`Player ${socket.id} disconnected from active room ${code} — grace period started`);
            } else {
                // Game finished — safe to remove
                room.players.splice(idx, 1);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(code).emit('room-update', { room });
                    io.to(code).emit('player-left', { playerId: socket.id });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`\n🎮  Venna Games  →  http://localhost:${PORT}\n`);
});
