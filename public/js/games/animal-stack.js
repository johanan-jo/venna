// Animal Stack, Broken Tiles, Unfair Fishing — last 3 specialty games
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    // === ANIMAL STACK ===
    G['animal-stack'] = {
        init: function ({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const ANIMALS = ['🐘', '🦒', '🐻', '🐺', '🦁', '🐯', '🐸', '🐧', '🐔', '🐮'];
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            let stack = [], nextAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
            let scores = {};
            players.forEach(p => scores[p.id] = 0);
            let wobble = 0, stackHeight = 0, over = false, animId, lastTime = 0;
            let currentX = W / 2, falling = false, fallY = -60, fallSpeed = 4;
            let turnIdx = 0;

            function draw() {
                ctx.fillStyle = '#0d1a2a'; ctx.fillRect(0, 0, W, H);
                // Platform
                ctx.fillStyle = '#8B4513'; ctx.fillRect(W / 2 - 80, H - 30, 160, 30);
                ctx.fillStyle = '#a0522d'; ctx.fillRect(W / 2 - 80, H - 30, 160, 10);
                // Stack
                stack.forEach((item, i) => {
                    const sw = 1 + wobble * 0.05 * (stack.length - i);
                    ctx.save(); ctx.translate(item.x, item.y); ctx.scale(sw, 1 / sw);
                    ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.animal, 0, 0);
                    ctx.restore();
                });
                // Falling animal
                if (!over) {
                    ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(nextAnimal, currentX, fallY < 0 ? (falling ? fallY : -60) : fallY);
                    // Aim guide line
                    if (!falling) { ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(currentX, -20); ctx.lineTo(currentX, H - 40); ctx.stroke(); ctx.setLineDash([]); }
                }
                // HUD
                ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(`🐘 Stack Height: ${stack.length}`, W / 2, 10);
                players.forEach((p, i) => { ctx.font = '12px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 8, 35 + i * 18); });
                const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
                ctx.textAlign = 'center'; ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8'; ctx.font = '13px Inter';
                ctx.fillText(isMyTurn ? 'Click to drop the animal!' : players[turnIdx % players.length]?.name + "'s turn", W / 2, H - 22);
            }

            canvas.addEventListener('mousemove', e => { if (!falling && ids[turnIdx % ids.length] === myPlayerId) { const rect = canvas.getBoundingClientRect(); currentX = e.clientX - rect.left; draw(); } });

            function dropAnimal() {
                if (over || falling || ids[turnIdx % ids.length] !== myPlayerId) return;
                falling = true; fallY = 0;
                const action = { type: 'drop', x: currentX, animal: nextAnimal, playerId: myPlayerId };
                socket.emit('game-action', { roomCode, action });
            }

            function applyDrop({ x, animal, playerId }) {
                falling = true; fallY = 0; currentX = x;
                const iv = setInterval(() => {
                    fallY += fallSpeed;
                    const targetY = stack.length > 0 ? stack[stack.length - 1].y - 44 : H - 70;
                    if (fallY >= targetY) {
                        clearInterval(iv);
                        const spread = Math.random() * 20 - 10;
                        const topX = stack.length > 0 ? stack[stack.length - 1].x : W / 2;
                        if (Math.abs(x - topX) > 60 && stack.length > 0) { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); setTimeout(() => window.vennaEndGame(results), 1000); return; }
                        stack.push({ x: x + spread, y: targetY, animal });
                        scores[playerId] = (scores[playerId] || 0) + stack.length;
                        wobble = 5;
                        falling = false; nextAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]; turnIdx++;
                        draw();
                    }
                    wobble = Math.max(0, wobble - 0.1); draw();
                }, 16);
            }

            socket.on('game-action', ({ action }) => { if (action.type === 'drop') applyDrop(action); });
            canvas.addEventListener('click', dropAnimal);
            draw();
            return () => { canvas.removeEventListener('click', dropAnimal); socket.off('game-action'); };
        }
    };

    // === BROKEN TILES ===
    G['broken-tiles'] = {
        init: function ({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            const ROWS = 6, COLS = 8;
            const CW = (W - 40) / COLS, CH = (H - 80) / ROWS;
            let tiles = Array(ROWS * COLS).fill(null).map((_, i) => ({ id: i, broken: Math.random() < 0.2, owner: null, clicked: false }));
            let scores = {};
            players.forEach(p => scores[p.id] = 0);
            let turnIdx = 0, over = false, totalClicked = 0;

            function draw() {
                ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
                tiles.forEach((tile, i) => {
                    const c = i % COLS, r = Math.floor(i / COLS); const x = 20 + c * CW, y = 60 + r * CH;
                    if (tile.clicked) { const pi = ids.indexOf(tile.owner); ctx.fillStyle = tile.broken ? '#1a0000' : '#001a0a'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CW - 4, CH - 4, 6); ctx.fill(); ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tile.broken ? '💥' : '✅', x + CW / 2, y + CH / 2); if (!tile.broken && tile.owner) { ctx.font = '10px Inter'; ctx.fillStyle = COLORS[pi >= 0 ? pi : 0]; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(players[pi >= 0 ? pi : 0]?.name || '', x + CW / 2, y + CH - 2); } }
                    else { ctx.fillStyle = '#1e1e3a'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CW - 4, CH - 4, 6); ctx.fill(); ctx.strokeStyle = '#3a3a5a'; ctx.lineWidth = 1; ctx.stroke(); ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🟦', x + CW / 2, y + CH / 2); }
                });
                const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
                ctx.font = '14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
                ctx.fillText(isMyTurn ? 'Your turn — click a tile!' : players[turnIdx % players.length]?.name + "'s turn", W / 2, 10);
                players.forEach((p, i) => { ctx.font = '13px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 34 + i * 18); });
            }

            function applyClick({ tileId, playerId }) {
                const tile = tiles[tileId]; if (!tile || tile.clicked) return;
                tile.clicked = true; tile.owner = playerId;
                if (!tile.broken) scores[playerId] = (scores[playerId] || 0) + 10;
                else scores[playerId] = Math.max(0, (scores[playerId] || 0) - 5);
                totalClicked++; turnIdx++;
                if (totalClicked >= ROWS * COLS && !over) { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); setTimeout(() => window.vennaEndGame(results), 800); }
                draw();
            }

            canvas.addEventListener('click', e => {
                if (over || ids[turnIdx % ids.length] !== myPlayerId) return;
                const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                const c = Math.floor((mx - 20) / CW), r = Math.floor((my - 60) / CH);
                if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
                const i = r * COLS + c; if (tiles[i].clicked) return;
                const action = { type: 'click', tileId: i, playerId: myPlayerId };
                applyClick(action); socket.emit('game-action', { roomCode, action });
            });
            socket.on('game-action', ({ action }) => { if (action.type === 'click') applyClick(action); });
            draw();
            return () => { socket.off('game-action'); };
        }
    };

    // === UNFAIR FISHING ===
    G['unfair-fishing'] = {
        init: function ({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            const GAME_DUR = 40;
            let timeLeft = GAME_DUR, over = false, animId, lastTime = 0;
            let scores = {};
            players.forEach(p => scores[p.id] = 0);
            let fish = [], lines = {};
            players.forEach((p, i) => lines[p.id] = { y: H * 0.45, reeling: false });
            let events = ['Big catch!', 'Shark steals!', 'Fishing busted!', 'Giant catch!', 'Nothing...'];

            function spawnFish() { fish.push({ x: Math.random() * W, y: H * 0.55 + Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 2, vy: 0, r: 10, val: Math.ceil(Math.random() * 10), icon: ['🐟', '🐠', '🦑', '🦐', '🐙'][Math.floor(Math.random() * 5)] }); }
            for (let i = 0; i < 8; i++) spawnFish();

            function update(dt) {
                fish.forEach(f => { f.x += f.vx * (dt / 16); if (f.x < 0 || f.x > W) f.vx *= -1; });
                // Reel in lines
                Object.entries(lines).forEach(([pid, line]) => { if (line.reeling) line.y = Math.min(H - 40, line.y + 2 * (dt / 16)); else line.y = H * 0.45; });
                // My line catch
                const myLine = lines[myPlayerId];
                if (myLine?.reeling) {
                    const lx = (ids.indexOf(myPlayerId) + 1) / (nP + 1) * W;
                    fish.forEach((f, i) => { if (Math.hypot(f.x - lx, f.y - myLine.y) < f.r + 12) { scores[myPlayerId] = (scores[myPlayerId] || 0) + f.val; fish.splice(i, 1); spawnFish(); socket.emit('game-action', { roomCode, action: { type: 'catch', playerId: myPlayerId, val: f.val } }); } });
                }
                if (fish.length < 6) spawnFish();
                timeLeft -= dt / 1000;
                if (timeLeft <= 0 && !over) endGame();
            }

            function draw() {
                // Sky
                ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, W, H * 0.45);
                // Water
                ctx.fillStyle = '#0077b6'; ctx.fillRect(0, H * 0.45, W, H * 0.55);
                ctx.fillStyle = 'rgba(135,206,235,0.1)';
                for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(W * 0.1 + i * W * 0.2, (Date.now() / 1000 + i) * 30 % 20 + H * 0.47, 40, 0, Math.PI); ctx.fill(); }
                // Fish
                fish.forEach(f => { ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.icon, f.x, f.y); });
                // Lines
                players.slice(0, nP).forEach((p, i) => {
                    const lx = (i + 1) / (nP + 1) * W; const line = lines[p.id] || { y: H * 0.45 };
                    ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(lx, H * 0.45); ctx.lineTo(lx, line.y || H * 0.45); ctx.stroke();
                    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎣', lx, H * 0.45 - 10);
                    if (line.reeling) { ctx.font = '12px serif'; ctx.fillText('🪝', lx, line.y || H * 0.45); }
                    ctx.font = '11px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, lx, H * 0.45 - 28);
                });
                ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(`🎣 Unfair Fishing! ⏱ ${Math.ceil(Math.max(0, timeLeft))}s`, W / 2, 8);
                ctx.font = '11px Inter'; ctx.fillStyle = '#555'; ctx.fillText('Hold to reel in — release to reset!', W / 2, 32);
            }

            function startReel() { if (over) return; lines[myPlayerId].reeling = true; socket.emit('game-action', { roomCode, action: { type: 'reel', playerId: myPlayerId, reeling: true } }); }
            function stopReel() { lines[myPlayerId].reeling = false; lines[myPlayerId].y = H * 0.45; socket.emit('game-action', { roomCode, action: { type: 'reel', playerId: myPlayerId, reeling: false } }); }

            function endGame() { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); cancelAnimationFrame(animId); window.vennaEndGame(results); }
            socket.on('game-action', ({ action }) => { if (action.type === 'reel') lines[action.playerId] = { ...(lines[action.playerId] || {}), reeling: action.reeling }; if (action.type === 'catch') scores[action.playerId] = (scores[action.playerId] || 0) + action.val; });
            canvas.addEventListener('mousedown', startReel); canvas.addEventListener('mouseup', stopReel);
            document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); startReel(); } });
            document.addEventListener('keyup', e => { if (e.code === 'Space') stopReel(); });
            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousedown', startReel); canvas.removeEventListener('mouseup', stopReel); socket.off('game-action'); };
        }
    };
})();
