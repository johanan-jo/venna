// Explosive Festival — dodge bombs, push them onto others
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const GAME_DUR = 45;
        let timeLeft = GAME_DUR, over = false, animId, lastTime = 0, keys = {};
        let bombs = [];
        let explosions = [];
        let entities = players.slice(0, nP).map((p, i) => ({ id: p.id, x: 100 + i * (W - 200) / (nP - 1 || 1), y: H / 2, vx: 0, vy: 0, r: 18, hp: 3, color: COLORS[i] }));
        let scores = {};
        players.forEach(p => scores[p.id] = 0);
        let shared = {};
        entities.forEach(e => shared[e.id] = { x: e.x, y: e.y, hp: e.hp });
        let spawnT = 0;

        function spawnBomb() { bombs.push({ x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 + (Math.random() - 0.5) * 200, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, r: 14, timer: 4000 + Math.random() * 3000, id: Math.random().toString(36).slice(2) }); }
        spawnBomb(); spawnBomb();

        function update(dt) {
            const me = entities.find(e => e.id === myPlayerId); if (!me || !me.alive) { timeLeft -= dt / 1000; if (timeLeft <= 0 && !over) endGame(); draw(); return; }
            const spd = 180 * (dt / 1000);
            if (keys['ArrowLeft'] || keys['a']) me.vx -= spd * 0.5; if (keys['ArrowRight'] || keys['d']) me.vx += spd * 0.5;
            if (keys['ArrowUp'] || keys['w']) me.vy -= spd * 0.5; if (keys['ArrowDown'] || keys['s']) me.vy += spd * 0.5;
            me.vx *= 0.8; me.vy *= 0.8;
            me.x = Math.max(me.r, Math.min(W - me.r, me.x + me.vx * (dt / 16)));
            me.y = Math.max(me.r, Math.min(H - me.r, me.y + me.vy * (dt / 16)));
            shared[me.id] = { x: me.x, y: me.y, hp: me.hp };
            socket.emit('game-action', { roomCode, action: { type: 'pos', id: me.id, x: me.x, y: me.y } });
            // bombs
            bombs.forEach(b => {
                b.x += b.vx * (dt / 16); b.y += b.vy * (dt / 16); if (b.x < b.r || b.x > W - b.r) b.vx *= -0.9; if (b.y < b.r || b.y > H - b.r) b.vy *= -0.9; b.timer -= dt;
                // Push by player
                const d = Math.hypot(b.x - me.x, b.y - me.y);
                if (d < b.r + me.r) { const ang = Math.atan2(b.y - me.y, b.x - me.x); b.vx = Math.cos(ang) * 5; b.vy = Math.sin(ang) * 5; }
            });
            // Explosions
            const toExplode = bombs.filter(b => b.timer <= 0);
            toExplode.forEach(b => { explosions.push({ x: b.x, y: b.y, r: 0, maxR: 80, t: 600 }); entities.forEach(e => { if (Math.hypot(e.x - b.x, e.y - b.y) < 80) { e.hp = Math.max(0, e.hp - 1); if (e.hp <= 0 && e.id === myPlayerId) e.alive = false; } }); });
            bombs = bombs.filter(b => b.timer > 0);
            explosions.forEach(ex => { ex.r = Math.min(ex.maxR, ex.r + ex.maxR * (dt / 600)); ex.t -= dt; });
            explosions = explosions.filter(ex => ex.t > 0);
            spawnT += dt; if (spawnT > 3000 && bombs.length < 4) { spawnT = 0; spawnBomb(); }
            timeLeft -= dt / 1000;
            if (timeLeft <= 0 && !over) endGame();
            scores[me.id] = me.hp * 10;
        }

        function draw() {
            ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, W, H);
            // Explosions
            explosions.forEach(ex => { const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r); grad.addColorStop(0, 'rgba(255,200,0,0.8)'); grad.addColorStop(1, 'rgba(255,50,0,0)'); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2); ctx.fill(); });
            // Bombs
            bombs.forEach(b => {
                ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const pulse = b.timer < 1500 ? 1 + 0.15 * Math.sin(Date.now() / 100) : 1;
                ctx.save(); ctx.translate(b.x, b.y); ctx.scale(pulse, pulse); ctx.fillText('💣', 0, 0); ctx.restore();
                ctx.font = '10px Inter'; ctx.fillStyle = b.timer < 1500 ? '#ef4444' : '#f59e0b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${(b.timer / 1000).toFixed(1)}s`, b.x, b.y + 16);
            });
            // Players
            entities.forEach((e, i) => {
                const d = shared[e.id] || e;
                ctx.globalAlpha = e.alive === false ? 0.3 : 1;
                ctx.fillStyle = e.color + 'aa'; ctx.beginPath(); ctx.arc(d.x, d.y, e.r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧑', d.x, d.y);
                for (let h = 0; h < 3; h++) { const hx = d.x - 18 + h * 14, hy = d.y - 32; ctx.fillStyle = h < (d.hp || 0) ? '#ef4444' : '#333'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill(); }
                ctx.font = '10px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(players[i]?.name || '', d.x, d.y + e.r + 2);
                ctx.globalAlpha = 1;
            });
            ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
            ctx.fillText(`💥 Explosive Festival! ⏱ ${Math.ceil(Math.max(0, timeLeft))}s`, W / 2, 8);
            ctx.font = '11px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText('WASD to dodge  •  Push bombs onto others!', W / 2, 32);
        }

        function endGame() { over = true; const results = players.map((p, i) => ({ playerId: p.id, score: (entities[i]?.hp || 0) * 10 })); cancelAnimationFrame(animId); window.vennaEndGame(results); }
        socket.on('game-action', ({ action }) => { if (action.type === 'pos') shared[action.id] = { x: action.x, y: action.y, hp: 3 }; });
        const kd = e => keys[e.key] = true, ku = e => keys[e.key] = false;
        document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
        function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); socket.off('game-action'); };
    }

    G['explosive-festival'] = { init };
})();
