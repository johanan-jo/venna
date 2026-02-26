// Battle Arena — Frogs Fight, Wrestle, King of Yard, Spike Attack, Last Sashimi
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'frogs-fight': { bg: '#0a2a0a', icon: '🐸', label: 'Fight!' },
        'wrestle': { bg: '#1a0a00', icon: '🤼', label: 'Wrestle!' },
        'king-yard': { bg: '#1a1a00', icon: '👑', label: 'King of the Yard!' },
        'spike-attack': { bg: '#100010', icon: '⚡', label: 'Dodge and Strike!' },
        'last-sashimi': { bg: '#000a1a', icon: '🍣', label: 'Grab the Sashimi!' },
        'wrestle-2': { bg: '#1a0808', icon: '🤼', label: 'Wrestle!' },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['frogs-fight'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
            const myIdx = ids.indexOf(myPlayerId);
            const GAME_DUR = 45;
            let timeLeft = GAME_DUR, over = false, animId, lastTime = 0;
            let keys = {};

            // Arena boundary (circle arena)
            const arenaX = W / 2, arenaY = H / 2, arenaR = Math.min(W, H) * 0.38;

            // Last Sashimi: a central item to grab
            let item = slug === 'last-sashimi' ? { x: W / 2, y: H / 2, r: 20, owner: null } : null;

            // Entities
            let entities = players.slice(0, nP).map((p, i) => {
                const ang = (i / nP) * Math.PI * 2;
                return { id: p.id, x: arenaX + Math.cos(ang) * arenaR * 0.6, y: arenaY + Math.sin(ang) * arenaR * 0.6, vx: 0, vy: 0, r: 20, hp: 100, attack: 0, score: 0, color: COLORS[i] };
            });

            let sharedEntities = {};
            entities.forEach(e => sharedEntities[e.id] = { x: e.x, y: e.y, hp: e.hp, score: e.score });

            function getMe() { return entities.find(e => e.id === myPlayerId); }

            function update(dt) {
                const me = getMe(); if (!me) return;
                const spd = 200 * (dt / 1000);
                if (keys['ArrowLeft'] || keys['a']) me.vx -= spd * 0.4;
                if (keys['ArrowRight'] || keys['d']) me.vx += spd * 0.4;
                if (keys['ArrowUp'] || keys['w']) me.vy -= spd * 0.4;
                if (keys['ArrowDown'] || keys['s']) me.vy += spd * 0.4;
                me.vx *= 0.82; me.vy *= 0.82;
                me.x += me.vx * (dt / 16); me.y += me.vy * (dt / 16);
                // Arena boundary
                const d = Math.hypot(me.x - arenaX, me.y - arenaY);
                if (d > arenaR - me.r) { const ang = Math.atan2(me.y - arenaY, me.x - arenaX); me.x = (arenaX + Math.cos(ang) * (arenaR - me.r)); me.y = (arenaY + Math.sin(ang) * (arenaR - me.r)); if (slug === 'king-yard') { me.hp -= 2; } me.vx *= -0.5; me.vy *= -0.5; }
                // Attack
                if (me.attack > 0) {
                    me.attack -= dt;
                    entities.forEach(other => { if (other.id === me.id) return; const od = Math.hypot(me.x - other.x, me.y - other.y); if (od < me.r + other.r + 10) { const ang = Math.atan2(other.y - me.y, other.x - me.x); other.vx = Math.cos(ang) * 6; other.vy = Math.sin(ang) * 6; other.hp = Math.max(0, other.hp - 8); if (other.hp <= 0) { other.hp = 100; me.score++; } } });
                }
                // Grab sashimi
                if (item && Math.hypot(me.x - item.x, me.y - item.y) < me.r + item.r) { me.score += 5; item.x = arenaX + (Math.random() - 0.5) * arenaR; item.y = arenaY + (Math.random() - 0.5) * arenaR; socket.emit('game-action', { roomCode, action: { type: 'grab', x: item.x, y: item.y, playerId: myPlayerId } }); }
                const action = { type: 'pos', id: me.id, x: me.x, y: me.y, vx: me.vx, vy: me.vy, hp: me.hp, score: me.score };
                socket.emit('game-action', { roomCode, action });
                sharedEntities[me.id] = { x: me.x, y: me.y, hp: me.hp, score: me.score };
                timeLeft -= dt / 1000;
                if (timeLeft <= 0 && !over) endGame();
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Arena floor
                ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.beginPath(); ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.stroke();
                // Sashimi
                if (item) { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.icon, item.x, item.y); }
                // Entities
                entities.forEach((e, i) => {
                    const data = sharedEntities[e.id] || e;
                    ctx.fillStyle = e.color + 'bb'; ctx.beginPath(); ctx.arc(data.x, data.y, e.r, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(slug === 'last-sashimi' ? '🧑' : cfg.icon, data.x, data.y);
                    // HP bar
                    ctx.fillStyle = '#333'; ctx.fillRect(data.x - 24, data.y - 32, 48, 6);
                    ctx.fillStyle = (data.hp || 100) > 50 ? '#10b981' : '#ef4444'; ctx.fillRect(data.x - 24, data.y - 32, 48 * (data.hp || 100) / 100, 6);
                    ctx.font = '10px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    ctx.fillText(`${players[i]?.name || ''} ${data.score || 0}pts`, data.x, data.y - 34);
                });
                // HUD
                ctx.font = 'bold 16px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
                ctx.fillText(`⏱ ${Math.ceil(Math.max(0, timeLeft))}s  ${cfg.label}`, W / 2, 8);
                ctx.font = '11px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText('WASD/Arrows to move  •  Space to attack', W / 2, 32);
            }

            function endGame() {
                over = true;
                const results = players.map(p => { const e = entities.find(e => e.id === p.id); const d = sharedEntities[p.id]; return { playerId: p.id, score: (d?.score || e?.score || 0) }; });
                cancelAnimationFrame(animId);
                window.vennaEndGame(results);
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'pos') sharedEntities[action.id] = { x: action.x, y: action.y, hp: action.hp, score: action.score };
                if (action.type === 'grab' && item) { item.x = action.x; item.y = action.y; const e = entities.find(e => e.id === action.playerId); if (e) e.score = (e.score || 0) + 5; }
            });

            const kd = e => { keys[e.key] = true; if (e.code === 'Space') { e.preventDefault(); const me = getMe(); if (me) me.attack = 300; } };
            const ku = e => keys[e.key] = false;
            document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);

            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); socket.off('game-action'); };
        };
    }

    ['frogs-fight', 'wrestle', 'king-yard', 'spike-attack', 'last-sashimi'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
