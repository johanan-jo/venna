// Spike Attack — Shoot spikes, dodge opponents, last one standing wins (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const PLAYER_R = 20, SPIKE_R = 5, SPEED = 200, SPIKE_SPEED = 350;
        const FIRE_COOLDOWN = 0.4;

        const STARTS = [{ x: 80, y: 80 }, { x: W - 80, y: H - 80 }, { x: W - 80, y: 80 }, { x: 80, y: H - 80 }];

        let playerStates = Array(nP).fill(null).map((_, i) => ({
            x: STARTS[i].x, y: STARTS[i].y, vx: 0, vy: 0, hp: 3, alive: true, fireCd: 0
        }));
        let spikes = [];
        let keys = {}, over = false, animId = null, lastTs = null;
        let syncTimer = 0;

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Arena
            ctx.strokeStyle = '#1e1e3a'; ctx.lineWidth = 2;
            for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

            // Spikes
            spikes.forEach(s => {
                ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx));
                ctx.fillStyle = COLORS[s.owner];
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
                ctx.restore();
            });

            // Players
            playerStates.forEach((p, i) => {
                if (!p.alive) return;
                // Shadow
                ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_R, PLAYER_R, 6, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#00000055'; ctx.fill();
                // Body
                ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
                ctx.fillStyle = COLORS[i]; ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(players[i].name.slice(0, 2).toUpperCase(), p.x, p.y);
                // HP
                const hpBarW = 34;
                ctx.fillStyle = '#1f2937'; ctx.fillRect(p.x - hpBarW / 2, p.y - PLAYER_R - 10, hpBarW, 6);
                ctx.fillStyle = '#22c55e'; ctx.fillRect(p.x - hpBarW / 2, p.y - PLAYER_R - 10, hpBarW * (p.hp / 3), 6);
            });

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 24);
            ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#7986a8'; ctx.fillText('WASD move  ·  Arrow keys shoot  ·  Last player standing wins!', W / 2, 12);
        }

        function loop(ts) {
            if (over) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.08);
            lastTs = ts;

            const me = playerStates[myIdx];
            if (me.alive) {
                // WASD move
                let dx = 0, dy = 0;
                if (keys['w']) dy -= 1; if (keys['s']) dy += 1;
                if (keys['a']) dx -= 1; if (keys['d']) dx += 1;
                if (dx && dy) { dx *= 0.707; dy *= 0.707; }
                me.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, me.x + dx * SPEED * dt));
                me.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, me.y + dy * SPEED * dt));

                // Arrow keys shoot
                me.fireCd -= dt;
                let sx = 0, sy = 0;
                if (keys['ArrowUp']) sy = -1; if (keys['ArrowDown']) sy = 1;
                if (keys['ArrowLeft']) sx = -1; if (keys['ArrowRight']) sx = 1;
                if ((sx || sy) && me.fireCd <= 0) {
                    const len = Math.hypot(sx, sy) || 1;
                    const spike = { x: me.x, y: me.y, vx: sx / len * SPIKE_SPEED, vy: sy / len * SPIKE_SPEED, owner: myIdx, id: Math.random() };
                    spikes.push(spike);
                    me.fireCd = FIRE_COOLDOWN;
                    socket.emit('game-action', { roomCode, action: { type: 'fire', vx: spike.vx, vy: spike.vy, fromX: me.x, fromY: me.y, owner: myIdx, id: spike.id } });
                }

                syncTimer += dt;
                if (syncTimer > 0.05 && (dx || dy)) {
                    syncTimer = 0;
                    socket.emit('game-action', { roomCode, action: { type: 'pos', pi: myIdx, x: me.x, y: me.y } });
                }
            }

            // Move spikes
            spikes = spikes.filter(s => {
                s.x += s.vx * dt; s.y += s.vy * dt;
                if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) return false;
                // Hit players
                for (let i = 0; i < nP; i++) {
                    const p = playerStates[i];
                    if (!p.alive || i === s.owner) continue;
                    if (Math.hypot(s.x - p.x, s.y - p.y) < PLAYER_R + SPIKE_R) {
                        p.hp--;
                        if (p.hp <= 0) { p.alive = false; checkEnd(); }
                        return false;
                    }
                }
                return true;
            });

            draw(); animId = requestAnimationFrame(loop);
        }

        function checkEnd() {
            const alive = playerStates.filter(p => p.alive);
            if (alive.length <= 1 && !over) {
                over = true; cancelAnimationFrame(animId);
                const winIdx = playerStates.findIndex(p => p.alive);
                const results = players.map((p, i) => ({ playerId: p.id, score: i === winIdx ? 1 : 0 }));
                draw(); setTimeout(() => window.vennaEndGame(results), 1000);
            }
        }

        function onKey(e, v) {
            keys[e.key] = v;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'pos') { playerStates[action.pi].x = action.x; playerStates[action.pi].y = action.y; }
            if (action.type === 'fire') spikes.push({ x: action.fromX, y: action.fromY, vx: action.vx, vy: action.vy, owner: action.owner, id: action.id });
        });

        document.addEventListener('keydown', e => onKey(e, true));
        document.addEventListener('keyup', e => onKey(e, false));
        animId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animId);
            document.removeEventListener('keydown', e => onKey(e, true));
            document.removeEventListener('keyup', e => onKey(e, false));
            socket.off('game-action');
        };
    }

    G['spike-attack'] = { init };
})();
