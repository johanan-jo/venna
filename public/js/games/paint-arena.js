// Paint Arena — Paint Fight and Color Wars
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const nP = Math.min(players.length, 4);
            const myIdx = ids.indexOf(myPlayerId);
            const GAME_DUR = 30;
            let timeLeft = GAME_DUR, over = false, animId, lastTime = 0;

            // Each player controls a character that moves and shoots paint
            let entities = players.slice(0, nP).map((p, i) => ({
                id: p.id, x: 80 + i * (W - 160) / (nP - 1 || 1), y: H / 2, vx: 0, vy: 0,
                color: COLORS[i], r: 16, ammo: 20,
            }));

            let blobs = []; // paint blobs on canvas
            let offCanvas = document.createElement('canvas'); offCanvas.width = W; offCanvas.height = H;
            let offCtx = offCanvas.getContext('2d');
            offCtx.fillStyle = '#1a1a2a'; offCtx.fillRect(0, 0, W, H);

            let keys = {};
            let sharedEntities = {};
            entities.forEach(e => sharedEntities[e.id] = { x: e.x, y: e.y });

            function countPixels() {
                const data = offCtx.getImageData(0, 0, W, H).data;
                const counts = {};
                players.forEach(p => counts[p.id] = 0);
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    players.slice(0, nP).forEach((p, pi) => {
                        const c = COLORS[pi];
                        const pr = parseInt(c.slice(1, 3), 16), pg = parseInt(c.slice(3, 5), 16), pb = parseInt(c.slice(5, 7), 16);
                        if (Math.abs(r - pr) < 30 && Math.abs(g - pg) < 30 && Math.abs(b - pb) < 30) counts[p.id]++;
                    });
                }
                return counts;
            }

            function update(dt) {
                const me = entities.find(e => e.id === myPlayerId); if (!me) return;
                const spd = 160 * (dt / 1000);
                if (keys['ArrowLeft'] || keys['a']) me.x -= spd;
                if (keys['ArrowRight'] || keys['d']) me.x += spd;
                if (keys['ArrowUp'] || keys['w']) me.y -= spd;
                if (keys['ArrowDown'] || keys['s']) me.y += spd;
                me.x = Math.max(me.r, Math.min(W - me.r, me.x));
                me.y = Math.max(me.r, Math.min(H - me.r, me.y));
                sharedEntities[me.id] = { x: me.x, y: me.y };
                socket.emit('game-action', { roomCode, action: { type: 'pos', id: me.id, x: me.x, y: me.y } });
                // Paint the floor where I walk
                offCtx.globalAlpha = 0.08;
                offCtx.fillStyle = me.color;
                offCtx.beginPath(); offCtx.arc(me.x, me.y, me.r, 0, Math.PI * 2); offCtx.fill();
                offCtx.globalAlpha = 1;
                blobs = blobs.filter(b => b.t > 0);
                blobs.forEach(b => { b.x += b.vx * (dt / 16); b.y += b.vy * (dt / 16); b.vx *= 0.92; b.vy *= 0.92; b.t -= dt; if (b.t % 100 < 50) { offCtx.globalAlpha = 0.5; offCtx.fillStyle = b.color; offCtx.beginPath(); offCtx.arc(b.x, b.y, 8, 0, Math.PI * 2); offCtx.fill(); offCtx.globalAlpha = 1; } });
                timeLeft -= dt / 1000;
                if (timeLeft <= 0 && !over) endGame();
            }

            function endGame() {
                over = true;
                // Count pixel ownership
                const counts = countPixels();
                const total = W * H;
                const results = players.map((p, i) => ({ playerId: p.id, score: Math.round((counts[p.id] || 0) / total * 1000) }));
                cancelAnimationFrame(animId);
                window.vennaEndGame(results);
            }

            function draw() {
                ctx.drawImage(offCanvas, 0, 0);
                // Players
                entities.forEach((e, i) => {
                    const data = sharedEntities[e.id] || e;
                    ctx.fillStyle = e.color + 'cc'; ctx.beginPath(); ctx.arc(data.x, data.y, e.r, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.font = '11px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    ctx.fillText(players[i]?.name || '', data.x, data.y - e.r - 2);
                });
                blobs.forEach(b => { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill(); });
                ctx.font = 'bold 17px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(`⏱ ${Math.ceil(Math.max(0, timeLeft))}s — Paint the arena!`, W / 2, 8);
                ctx.font = '11px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText('WASD/Arrows: move  •  Click: shoot paint', W / 2, 36);
            }

            function shoot(e) {
                if (over) return;
                const me = entities.find(e => e.id === myPlayerId); if (!me) return;
                const rect = canvas.getBoundingClientRect();
                const tx = e.clientX - rect.left, ty = e.clientY - rect.top;
                const ang = Math.atan2(ty - me.y, tx - me.x);
                const spd = 6;
                const blob = { x: me.x, y: me.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, color: me.color, t: 1500 };
                blobs.push(blob);
                socket.emit('game-action', { roomCode, action: { type: 'shoot', blob: { ...blob, owner: myPlayerId } } });
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'pos') sharedEntities[action.id] = { x: action.x, y: action.y };
                if (action.type === 'shoot') blobs.push(action.blob);
            });

            const kd = e => keys[e.key] = true, ku = e => keys[e.key] = false;
            document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
            canvas.addEventListener('click', shoot);

            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); canvas.removeEventListener('click', shoot); socket.off('game-action'); };
        };
    }

    G['paint-fight'] = { init: makeInit('paint-fight') };
    G['color-wars'] = { init: makeInit('color-wars') };
})();
