// Ball Physics — Ball Games Physics, Beach Ball, covers physics ball fun
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'ball-games': { bg: '#0a0a1a', label: 'Ball Physics Madness!', gravity: 0.2 },
        'beach-ball': { bg: '#0a1a2a', label: 'Keep the Beach Ball Up!', gravity: 0.08 },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['ball-games'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
            const myIdx = ids.indexOf(myPlayerId);
            const GAME_DUR = 40;
            let timeLeft = GAME_DUR, over = false, animId, lastTime = 0, keys = {};
            let scores = {};
            players.forEach(p => scores[p.id] = 0);

            // Player paddles/entities
            let entities = players.slice(0, nP).map((p, i) => ({ id: p.id, x: W / (nP + 1) * (i + 1), y: H - 50, vx: 0, vy: 0, r: 22, color: COLORS[i] }));
            let shared = {};
            entities.forEach(e => shared[e.id] = { x: e.x, y: e.y });

            // Balls
            let balls = [{ x: W / 2, y: H / 3, vx: (Math.random() - 0.5) * 4, vy: 2, r: 18, color: '#fff', bounces: 0 }];
            if (slug === 'ball-games') for (let i = 0; i < 3; i++) balls.push({ x: W * 0.2 + i * W * 0.2, y: H * 0.3, vx: (Math.random() - 0.5) * 5, vy: 3, r: 14, color: `hsl(${i * 120},70%,60%)`, bounces: 0 });

            function update(dt) {
                const me = entities.find(e => e.id === myPlayerId); if (!me) return;
                const spd = 220 * (dt / 1000);
                if (keys['ArrowLeft'] || keys['a']) me.x = Math.max(me.r, me.x - spd);
                if (keys['ArrowRight'] || keys['d']) me.x = Math.min(W - me.r, me.x + spd);
                if ((keys['ArrowUp'] || keys['w']) && slug !== 'beach-ball') me.y = Math.max(me.r, me.y - spd);
                if ((keys['ArrowDown'] || keys['s']) && slug !== 'beach-ball') me.y = Math.min(H - me.r, me.y + spd);
                shared[me.id] = { x: me.x, y: me.y };
                socket.emit('game-action', { roomCode, action: { type: 'pos', id: me.id, x: me.x, y: me.y } });

                balls.forEach(b => {
                    b.vy += cfg.gravity * (dt / 16); b.x += b.vx * (dt / 16); b.y += b.vy * (dt / 16);
                    if (b.x < b.r) { b.x = b.r; b.vx *= -0.85; }
                    if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.85; }
                    if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -0.88; b.vx *= 0.95; }
                    if (b.y < b.r) { b.y = b.r; b.vy *= -0.8; }
                    // Hit players
                    entities.forEach((e, i) => {
                        const de = Math.hypot(b.x - (shared[e.id]?.x || e.x), b.y - (shared[e.id]?.y || e.y));
                        if (de < b.r + e.r) {
                            const ang = Math.atan2(b.y - (shared[e.id]?.y || e.y), b.x - (shared[e.id]?.x || e.x));
                            const spd2 = Math.sqrt(b.vx ** 2 + b.vy ** 2);
                            b.vx = Math.cos(ang) * Math.max(spd2, 4); b.vy = Math.sin(ang) * Math.max(spd2, 4);
                            b.vy -= 3; // upward kick
                            scores[e.id] = (scores[e.id] || 0) + 1;
                            socket.emit('game-action', { roomCode, action: { type: 'hit', playerId: e.id } });
                            b.bounces++;
                            b.color = COLORS[i];
                        }
                    });
                });
                timeLeft -= dt / 1000;
                if (timeLeft <= 0 && !over) endGame();
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                if (slug === 'beach-ball') { // Water/sky scene
                    ctx.fillStyle = '#0077b6'; ctx.fillRect(0, H * 0.6, W, H - H * 0.6);
                    ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, W, H * 0.6);
                }
                balls.forEach(b => {
                    if (slug === 'beach-ball') { ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏖', b.x, b.y); }
                    else { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
                });
                entities.forEach((e, i) => {
                    const d = shared[e.id] || e;
                    ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧑', d.x, d.y);
                    ctx.font = '10px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${players[i]?.name}: ${scores[e.id] || 0}`, d.x, d.y + 26);
                });
                ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(`⏱ ${Math.ceil(Math.max(0, timeLeft))}s  •  ${cfg.label}`, W / 2, 8);
                ctx.font = '11px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText('WASD/Arrows to move  •  Hit balls to score!', W / 2, 32);
            }

            function endGame() { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); cancelAnimationFrame(animId); window.vennaEndGame(results); }
            socket.on('game-action', ({ action }) => { if (action.type === 'pos') shared[action.id] = { x: action.x, y: action.y }; if (action.type === 'hit') scores[action.playerId] = (scores[action.playerId] || 0) + 1; });
            const kd = e => keys[e.key] = true, ku = e => keys[e.key] = false;
            document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); socket.off('game-action'); };
        };
    }

    G['ball-games'] = { init: makeInit('ball-games') };
    G['beach-ball'] = { init: makeInit('beach-ball') };
})();
