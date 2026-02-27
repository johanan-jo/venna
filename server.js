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

    // Generic game action relay — direct socket targeting for reliability
    socket.on('game-action', ({ roomCode, action }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room) {
            // Fallback: broadcast to Socket.IO room if we can't find the room
            socket.to(code).emit('game-action', { playerId: socket.id, action });
            return;
        }
        // Send directly to each other player's tracked socket ID
        let sent = 0;
        room.players.forEach(p => {
            if (p.id === socket.id) return; // skip sender
            const target = io.sockets.sockets.get(p.id);
            if (target) {
                target.emit('game-action', { playerId: socket.id, action });
                sent++;
            } else {
                console.warn(`  [relay] socket for ${p.name}(${p.id}) not found, using room broadcast`);
                socket.to(code).emit('game-action', { playerId: socket.id, action });
            }
        });
    });

    // Host broadcasts full game state (real-time games)
    socket.on('game-state', ({ roomCode, state }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (room) {
            room.players.forEach(p => {
                if (p.id === socket.id) return;
                io.sockets.sockets.get(p.id)?.emit('game-state', { state });
            });
        } else {
            socket.to(code).emit('game-state', { state });
        }
    });

    socket.on('game-end', ({ roomCode, results }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (room) {
            room.status = 'finished';
            room.playAgainVotes = new Set(); // reset votes on new game-end
            if (results) {
                results.forEach(r => {
                    const p = room.players.find(p => p.id === r.playerId);
                    if (p) p.score = (p.score || 0) + (r.score || 0);
                });
            }
        }
        io.to(code).emit('game-end', { results, room });
    });

    // Vote-based play-again: game restarts when ALL connected players have voted
    socket.on('play-again', ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        if (!room.playAgainVotes) room.playAgainVotes = new Set();
        room.playAgainVotes.add(socket.id);
        // Broadcast current vote count so clients can show progress
        io.to(code).emit('play-again-vote', {
            votes: room.playAgainVotes.size,
            total: room.players.length,
        });
        // Start rematch when everyone has voted
        if (room.playAgainVotes.size >= room.players.length) {
            room.status = 'waiting';
            room.playAgainVotes = new Set();
            io.to(code).emit('play-again', { room });
        }
    });

    socket.on('chat-message', ({ roomCode, message, playerName }) => {
        // Use socket.to() (not io.to()) so sender doesn't receive echo
        // The sender already adds the message locally in game-client.js
        socket.to(roomCode.toUpperCase()).emit('chat-message', {
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

            if (room.status === 'waiting') {
                // Player navigating — keep them for rejoin, schedule grace cleanup
                scheduleRoomDelete(code, 20000);
                console.log(`Player ${socket.id} disconnected from waiting room ${code} — grace period started`);
            } else if (room.status === 'in-progress') {
                // Mid-game disconnect — tell remaining players and let them go home
                const leftPlayer = room.players[idx];
                room.players.splice(idx, 1);
                console.log(`Player ${socket.id} left active game in room ${code}`);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(code).emit('opponent-left', { playerName: leftPlayer?.name || 'Opponent' });
                    scheduleRoomDelete(code, 30000);
                }
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
