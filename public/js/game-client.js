// game-client.js — Connects to server, manages game lifecycle, chat, overlays
(function () {
    const params = new URLSearchParams(location.search);
    const gameSlug = params.get('game') || 'tic-tac-toe';
    const roomCode = params.get('room') || '';
    const myName = params.get('name') || 'Player';
    const gameData = window.getGame(gameSlug);

    // Update sidebar header
    if (gameData) {
        document.getElementById('sidebarGameIcon').textContent = gameData.icon;
        document.getElementById('sidebarGameName').textContent = gameData.name;
        document.title = `${gameData.name} — Venna`;
    }

    const socket = io();
    let myPlayerId = null;
    let currentRoom = null;
    let isHost = false;
    let gameCleanup = null;

    const canvas = document.getElementById('gameCanvas');
    const overlayLoading = document.getElementById('overlayLoading');
    const overlayCountdown = document.getElementById('overlayCountdown');
    const overlayEnd = document.getElementById('overlayEnd');

    function setStatus(msg) {
        document.getElementById('gameStatus').textContent = msg;
    }

    function toast(msg, type = 'info') {
        let c = document.getElementById('toastContainer');
        if (!c) { c = document.createElement('div'); c.className = 'toast-container'; c.id = 'toastContainer'; document.body.appendChild(c); }
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    function renderPlayerScores(players) {
        const container = document.getElementById('playerScores');
        if (!container || !players) return;
        container.innerHTML = players.map((p, i) => `
      <div class="player-score-item">
        <div class="player-avatar" style="width:28px;height:28px;font-size:12px">${p.name.charAt(0).toUpperCase()}</div>
        <span style="font-size:13px">${p.name}${p.id === myPlayerId ? ' <span style="color:var(--text-muted);font-size:11px">(you)</span>' : ''}</span>
        <span class="score">${p.score || 0}</span>
      </div>`).join('');
    }

    // Connect and rejoin room (new socket ID after page navigation)
    socket.on('connect', () => {
        myPlayerId = socket.id;
        setStatus('Joining room…');
        socket.emit('rejoin-room', { roomCode, playerName: myName }, ({ success, room, error }) => {
            if (!success || !room) {
                setStatus('Room not found. Redirecting…');
                setTimeout(() => location.href = '/', 2000);
                return;
            }
            currentRoom = room;
            // Find my updated player entry (server updated our socket ID)
            const me = room.players.find(p => p.name === myName);
            if (me) myPlayerId = me.id;
            isHost = room.hostId === myPlayerId;
            renderPlayerScores(room.players);
            setStatus(isHost ? 'You are the host' : 'Waiting for game…');

            // If game is already in progress, start it directly
            if (room.status === 'in-progress') {
                startGameCountdown();
            }
        });
    });

    socket.on('game-started', ({ room }) => {
        currentRoom = room;
        isHost = room.hostId === myPlayerId;
        renderPlayerScores(room.players);
        startGameCountdown();
    });

    socket.on('room-update', ({ room }) => {
        currentRoom = room;
        renderPlayerScores(room.players);
    });

    socket.on('player-left', ({ playerId }) => {
        toast('A player left the game', 'error');
        if (currentRoom) {
            currentRoom.players = currentRoom.players.filter(p => p.id !== playerId);
            renderPlayerScores(currentRoom.players);
        }
    });

    socket.on('game-end', ({ results, room }) => {
        if (room) { currentRoom = room; renderPlayerScores(room.players); }
        showGameEnd(results);
    });

    socket.on('play-again', ({ room }) => {
        currentRoom = room;
        isHost = room.hostId === myPlayerId;
        overlayEnd.style.display = 'none';
        if (gameCleanup) { gameCleanup(); gameCleanup = null; }
        startGameCountdown();
    });

    socket.on('chat-message', ({ playerName, message, time }) => {
        addChatMessage(playerName, message, time);
    });

    function startGameCountdown() {
        overlayLoading.style.display = 'none';
        overlayCountdown.style.display = 'flex';
        setStatus('Game starting…');
        let count = 3;
        const numEl = document.getElementById('countdownNum');
        numEl.textContent = count;
        const iv = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(iv);
                overlayCountdown.style.display = 'none';
                launchGame();
            } else {
                numEl.textContent = count;
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = 'pop .4s ease-out';
            }
        }, 1000);
    }

    function launchGame() {
        const gameModule = window.VennaGames && window.VennaGames[gameSlug];
        if (!gameModule) {
            setStatus(`Game "${gameSlug}" not implemented yet`);
            return;
        }
        // Size canvas to fill container
        const area = document.getElementById('canvasArea');
        const w = Math.min(area.clientWidth - 16, 800);
        const h = Math.min(area.clientHeight - 16, 600);
        canvas.width = w;
        canvas.height = h;

        setStatus(isHost ? 'You are HOST' : 'Guest — play!');

        try {
            gameCleanup = gameModule.init({
                canvas,
                socket,
                roomCode,
                myPlayerId,
                players: currentRoom.players,
                isHost,
                gameSlug,
            });
        } catch (e) {
            console.error('Game init error:', e);
            setStatus('Error starting game');
        }
    }

    function showGameEnd(results) {
        if (gameCleanup) { gameCleanup(); gameCleanup = null; }
        overlayEnd.style.display = 'flex';
        const sorted = (results || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sorted[0];
        const isWinner = winner && winner.playerId === myPlayerId;
        document.getElementById('endEmoji').textContent = isWinner ? '🏆' : '👏';
        document.getElementById('endTitle').textContent = isWinner ? 'You Win!' : 'Game Over!';
        const winName = (currentRoom && currentRoom.players.find(p => p.id === winner?.playerId)?.name) || 'Unknown';
        document.getElementById('endSubtitle').textContent = isWinner ? 'Well played!' : `${winName} wins!`;
        const medals = ['🥇', '🥈', '🥉'];
        document.getElementById('resultsList').innerHTML = sorted.map((r, i) => {
            const pName = (currentRoom && currentRoom.players.find(p => p.id === r.playerId)?.name) || r.playerId;
            return `<li class="result-item">
        <span class="result-rank">${medals[i] || `#${i + 1}`}</span>
        <span>${pName}</span>
        ${i === 0 ? '<span class="winner-badge">WINNER</span>' : ''}
        <span class="result-score">${r.score || 0}</span>
      </li>`;
        }).join('');
        document.getElementById('playAgainBtn').style.display = isHost ? '' : 'none';
    }

    window.requestPlayAgain = function () {
        if (!isHost) return;
        socket.emit('play-again', { roomCode });
    };

    // Chat
    function addChatMessage(sender, message, time) {
        const msgs = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<div><span class="sender">${sender}</span><span class="time">${time}</span></div><div class="text">${escapeHtml(message)}</div>`;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.sendChat = function () {
        const input = document.getElementById('chatInput');
        const msg = input.value.trim();
        if (!msg) return;
        socket.emit('chat-message', { roomCode, message: msg, playerName: myName });
        addChatMessage(myName, msg, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        input.value = '';
    };

    document.getElementById('chatInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') window.sendChat();
    });

    // Expose for games to use
    window.vennaEndGame = function (results) {
        socket.emit('game-end', { roomCode, results });
        showGameEnd(results);
    };
})();
