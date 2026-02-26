// lobby.js — Room creation, joining, and waiting room management
(function () {
    const params = new URLSearchParams(location.search);
    const gameSlug = params.get('game') || 'tic-tac-toe';
    const gameData = window.getGame(gameSlug);

    // Populate game banner
    if (gameData) {
        document.getElementById('gameIcon').textContent = gameData.icon;
        document.getElementById('gameName').textContent = gameData.name;
        document.getElementById('gameDesc').textContent = gameData.desc;
        document.title = `${gameData.name} — Venna`;
    }

    const socket = io();
    let currentRoom = null;
    let myName = '';
    let activeTab = 'create';

    // Toast helper
    function toast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    // Tab switching
    window.switchTab = function (tab) {
        activeTab = tab;
        document.getElementById('tabCreate').classList.toggle('active', tab === 'create');
        document.getElementById('tabJoin').classList.toggle('active', tab === 'join');
        document.getElementById('panelCreate').style.display = tab === 'create' ? '' : 'none';
        document.getElementById('panelJoin').style.display = tab === 'join' ? '' : 'none';
    };

    function getName() {
        const n = document.getElementById('playerName').value.trim();
        if (!n) { toast('Please enter your name', 'error'); return null; }
        return n;
    }

    // Create room
    window.createRoom = function () {
        const name = getName();
        if (!name) return;
        myName = name;
        socket.emit('create-room', {
            gameId: gameSlug,
            gameName: gameData ? gameData.name : gameSlug,
            playerName: name,
        }, (res) => {
            if (!res.success) return toast(res.error, 'error');
            currentRoom = res.room;
            showWaiting(res.roomCode, res.room, true);
        });
    };

    // Join room
    window.joinRoom = function () {
        const name = getName();
        if (!name) return;
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (code.length < 4) return toast('Enter the room code', 'error');
        myName = name;
        socket.emit('join-room', { roomCode: code, playerName: name }, (res) => {
            if (!res.success) return toast(res.error, 'error');
            currentRoom = res.room;
            showWaiting(code, res.room, false);
        });
    };

    function showWaiting(code, room, isHost) {
        document.getElementById('stepName').style.display = 'none';
        document.getElementById('stepWaiting').style.display = '';
        document.getElementById('displayCode').textContent = code;
        document.getElementById('displayCode').parentElement.style.cursor = 'pointer';
        document.getElementById('displayCode').parentElement.onclick = () => {
            navigator.clipboard.writeText(code).then(() => toast('Code copied! 📋', 'success'));
        };
        document.getElementById('hostActions').style.display = isHost ? '' : 'none';
        document.getElementById('guestWait').style.display = isHost ? 'none' : '';
        renderPlayers(room.players);
    }

    function renderPlayers(players) {
        const list = document.getElementById('playerList');
        document.getElementById('playerCount').textContent = players.length;
        list.innerHTML = players.map(p => `
      <li>
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <span>${p.name}</span>
        ${p.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
      </li>`).join('');
        // Update start button
        const startBtn = document.getElementById('startBtn');
        const startHint = document.getElementById('startHint');
        if (startBtn) {
            const minP = gameData ? parseInt(gameData.players.split('-')[0]) : 2;
            const canStart = players.length >= minP;
            startBtn.disabled = !canStart;
            startHint.textContent = canStart ? 'Everyone ready? Let\'s go!' : `Need at least ${minP} players`;
        }
    }

    window.startGame = function () {
        if (!currentRoom) return;
        socket.emit('start-game', { roomCode: currentRoom.code });
    };

    // Socket events
    socket.on('room-update', ({ room }) => {
        currentRoom = room;
        renderPlayers(room.players);
    });

    socket.on('game-started', ({ room }) => {
        const code = room.code;
        location.href = `/game.html?game=${gameSlug}&room=${code}&name=${encodeURIComponent(myName)}`;
    });

    // Enter key shortcuts
    document.getElementById('playerName').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (activeTab === 'create') window.createRoom();
            else window.joinRoom();
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const codeInput = document.getElementById('roomCodeInput');
            if (document.activeElement === codeInput) window.joinRoom();
        }
    });
})();
