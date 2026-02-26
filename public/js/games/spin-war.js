// Spin War — spinning top battle arena
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const ARENA_R = Math.min(W, H) * 0.4;
        const GAME_DUR = 30;
        let timeLeft = GAME_DUR, over = false, animId, lastTime = 0;
        let scores = {};
        players.forEach(p => scores[p.id] = 0);

        let tops = players.slice(0, nP).map((p, i) => ({
            id: p.id, x: W / 2 + Math.cos((i / nP) * Math.PI * 2) * ARENA_R * 0.5, y: H / 2 + Math.sin((i / nP) * Math.PI * 2) * ARENA_R * 0.5,
            vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, spin: 10 + Math.random() * 5, r: 20, color: COLORS[i], alive: true,
        }));
        let shared = {};
        tops.forEach(t => shared[t.id] = { x: t.x, y: t.y, spin: t.spin, alive: true });

        function update(dt) {
            const me = tops.find(t => t.id === myPlayerId); if (!me || !me.alive) return;
            me.x += me.vx * (dt / 16); me.y += me.vy * (dt / 16);
            // Arena boundary push-out
            const d = Math.hypot(me.x - W / 2, me.y - H / 2);
            if (d > ARENA_R - me.r) { const ang = Math.atan2(me.y - H / 2, me.x - W / 2); me.x = (W / 2 + Math.cos(ang) * (ARENA_R - me.r)); me.y = (H / 2 + Math.sin(ang) * (ARENA_R - me.r)); me.vx *= -0.6; me.vy *= -0.6; me.spin -= 0.5; }
            me.vx *= 0.995; me.vy *= 0.995;
            me.spin = Math.max(0, me.spin - 0.02 * (dt / 16));
            if (me.spin < 0.5 && me.alive) { me.alive = false; socket.emit('game-action', { roomCode, action: { type: 'dead', id: me.id } }); }
            // Collide with others
            tops.forEach(other => {
                if (other.id === me.id || !other.alive) return;
                const od = Math.hypot(me.x - (shared[other.id]?.x || other.x), me.y - (shared[other.id]?.y || other.y));
                if (od < me.r + other.r) {
                    const ang = Math.atan2(me.y - (shared[other.id]?.y || other.y), me.x - (shared[other.id]?.x || other.x));
                    const diff = me.spin - ((shared[other.id]?.spin) || other.spin);
                    me.vx += Math.cos(ang + Math.PI) * diff * 0.3; me.vy += Math.sin(ang + Math.PI) * diff * 0.3;
                    me.spin = Math.max(0, me.spin - 0.5);
                    scores[myPlayerId] = (scores[myPlayerId] || 0) + (diff > 0 ? 1 : 0);
                }
            });
            shared[me.id] = { x: me.x, y: me.y, spin: me.spin, alive: me.alive };
            socket.emit('game-action', { roomCode, action: { type: 'pos', id: me.id, x: me.x, y: me.y, spin: me.spin } });
            timeLeft -= dt / 1000;
            if (timeLeft <= 0 && !over) endGame();
            if (tops.filter(t => (shared[t.id]?.alive ?? t.alive)).length <= 1 && nP > 1 && !over) endGame();
        }

        function draw() {
            ctx.fillStyle = '#0a0014'; ctx.fillRect(0, 0, W, H);
            // Arena
            const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, ARENA_R);
            grad.addColorStop(0, '#1a0030'); grad.addColorStop(1, '#0a0020');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(W / 2, H / 2, ARENA_R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(124,58,237,0.5)'; ctx.lineWidth = 4; ctx.stroke();
            // Danger rings
            [0.7, 0.85, 1.0].forEach((r, i) => { ctx.strokeStyle = `rgba(239,68,68,${0.1 + i * 0.1})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(W / 2, H / 2, ARENA_R * r, 0, Math.PI * 2); ctx.stroke(); });
            // Tops
            tops.forEach((t, i) => {
                const d = shared[t.id] || t;
                if (!d.alive && !t.alive) return;
                const spin = d.spin || t.spin;
                ctx.save(); ctx.translate(d.x || t.x, d.y || t.y); ctx.rotate(Date.now() / 100 * spin * 0.1);
                const topGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, t.r);
                topGrad.addColorStop(0, '#fff'); topGrad.addColorStop(1, t.color);
                ctx.fillStyle = topGrad; ctx.beginPath(); ctx.moveTo(0, -t.r); ctx.lineTo(t.r * 0.5, t.r); ctx.lineTo(-t.r * 0.5, t.r); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.restore();
                // Spin bar
                ctx.fillStyle = '#2a2a2a'; ctx.fillRect((d.x || t.x) - 20, (d.y || t.y) - 30, 40, 6);
                ctx.fillStyle = spin > 5 ? '#10b981' : spin > 2 ? '#f59e0b' : '#ef4444'; ctx.fillRect((d.x || t.x) - 20, (d.y || t.y) - 30, 40 * (spin / 15), 6);
                ctx.font = '10px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(players[i]?.name || '', (d.x || t.x), (d.y || t.y) + t.r + 2);
            });
            ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
            ctx.fillText(`🌀 Spin War! ⏱ ${Math.ceil(Math.max(0, timeLeft))}s`, W / 2, 8);
            ctx.font = '11px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText('Tops collide automatically — survive!', W / 2, 30);
            players.forEach((p, i) => { ctx.font = '12px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 50 + i * 18); });
        }

        // Auto-steer tops towards center slowly
        function autoSteer(dt) {
            const me = tops.find(t => t.id === myPlayerId); if (!me || !me.alive) return;
            const ang = Math.atan2(H / 2 - me.y, W / 2 - me.x);
            me.vx += Math.cos(ang) * 0.05 * (dt / 16);
            me.vy += Math.sin(ang) * 0.05 * (dt / 16);
            // Random nudge
            if (Math.random() < 0.02) { me.vx += (Math.random() - 0.5) * 1; me.vy += (Math.random() - 0.5) * 1; }
        }

        function endGame() { over = true; const results = players.map((p, i) => ({ playerId: p.id, score: (scores[p.id] || 0) + (tops[i]?.alive ? 10 : 0) })); cancelAnimationFrame(animId); window.vennaEndGame(results); }
        socket.on('game-action', ({ action }) => { if (action.type === 'pos') shared[action.id] = { x: action.x, y: action.y, spin: action.spin, alive: true }; if (action.type === 'dead') { shared[action.id] = { ...shared[action.id], alive: false }; scores[myPlayerId] = (scores[myPlayerId] || 0) + 3; } });

        function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) { update(dt); autoSteer(dt); } draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); socket.off('game-action'); };
    }

    G['spin-war'] = { init };
})();
