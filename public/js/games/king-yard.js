// King of the Yard — Push opponents out of the center zone (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const ZONE_R = Math.min(W, H) * 0.28, PLAYER_R = 18, SPEED = 220, PUSH = 180;
        const CX = W / 2, CY = H / 2 + 10;
        const DURATION = 45;

        const STARTS = [
            { x: CX - ZONE_R * 0.5, y: CY - ZONE_R * 0.5 },
            { x: CX + ZONE_R * 0.5, y: CY + ZONE_R * 0.5 },
            { x: CX + ZONE_R * 0.5, y: CY - ZONE_R * 0.5 },
            { x: CX - ZONE_R * 0.5, y: CY + ZONE_R * 0.5 },
        ];

        let ps = Array(nP).fill(null).map((_, i) => ({ x: STARTS[i].x, y: STARTS[i].y, vx: 0, vy: 0 }));
        let kingTime = Array(nP).fill(0); // total time in zone per player
        let elapsed = 0, lastTs = null, animId = null, over = false;
        let keys = {}, syncT = 0;

        function inZone(p) { return Math.hypot(p.x - CX, p.y - CY) < ZONE_R; }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Platform
            ctx.beginPath(); ctx.arc(CX, CY, ZONE_R + 40, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b'; ctx.fill();
            ctx.beginPath(); ctx.arc(CX, CY, ZONE_R, 0, Math.PI * 2);
            ctx.fillStyle = '#1a3a1e'; ctx.fill();
            ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#22c55e44'; ctx.font = '13px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('KING ZONE', CX, CY - ZONE_R + 20);

            // Players
            ps.forEach((p, i) => {
                ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
                ctx.fillStyle = COLORS[i]; ctx.fill();
                ctx.strokeStyle = inZone(p) ? '#facc15' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(players[i].name.slice(0, 3).toUpperCase(), p.x, p.y);
                // King time bar
                const t = kingTime[i]; const tPct = t / DURATION;
                ctx.fillStyle = '#111'; ctx.fillRect(p.x - 20, p.y - PLAYER_R - 10, 40, 6);
                ctx.fillStyle = COLORS[i]; ctx.fillRect(p.x - 20, p.y - PLAYER_R - 10, 40 * tPct, 6);
                if (inZone(p)) { ctx.font = '16px serif'; ctx.fillText('👑', p.x + PLAYER_R, p.y - PLAYER_R); }
            });

            // HUD
            const timeLeft = Math.max(0, DURATION - elapsed);
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, 26);
            ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  |  WASD move  ·  Hold SPACE to push  |  Stay in zone to score!`, W / 2, 13);
        }

        function loop(ts) {
            if (over) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.08);
            lastTs = ts; elapsed += dt;

            const me = ps[myIdx];
            let dx = 0, dy = 0;
            if (keys['w']) dy -= 1; if (keys['s']) dy += 1;
            if (keys['a']) dx -= 1; if (keys['d']) dx += 1;
            if (dx && dy) { dx *= 0.707; dy *= 0.707; }
            me.x = Math.max(20, Math.min(W - 20, me.x + dx * SPEED * dt));
            me.y = Math.max(30, Math.min(H - 20, me.y + dy * SPEED * dt));

            // Push (space)
            if (keys[' ']) {
                ps.forEach((p, i) => {
                    if (i === myIdx) return;
                    const d = Math.hypot(me.x - p.x, me.y - p.y);
                    if (d < PLAYER_R * 3) {
                        const nx = (p.x - me.x) / d, ny = (p.y - me.y) / d;
                        p.x += nx * PUSH * dt; p.y += ny * PUSH * dt;
                    }
                });
            }

            // Sync
            syncT += dt;
            if (syncT > 0.05) {
                syncT = 0;
                socket.emit('game-action', { roomCode, action: { type: 'pos', pi: myIdx, x: me.x, y: me.y } });
            }

            // King time
            ps.forEach((p, i) => { if (inZone(p)) kingTime[i] += dt; });

            if (elapsed >= DURATION && !over) {
                over = true; cancelAnimationFrame(animId);
                const results = players.map((p, i) => ({ playerId: p.id, score: Math.round(kingTime[i]) }));
                draw(); setTimeout(() => window.vennaEndGame(results), 500); return;
            }
            draw(); animId = requestAnimationFrame(loop);
        }

        function onKey(e, v) { keys[e.key] = v; if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault(); }
        document.addEventListener('keydown', e => onKey(e, true));
        document.addEventListener('keyup', e => onKey(e, false));
        socket.on('game-action', ({ action }) => { if (action.type === 'pos') { ps[action.pi].x = action.x; ps[action.pi].y = action.y; } });
        animId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animId);
            document.removeEventListener('keydown', e => onKey(e, true));
            document.removeEventListener('keyup', e => onKey(e, false));
            socket.off('game-action');
        };
    }

    G['king-yard'] = { init };
})();
