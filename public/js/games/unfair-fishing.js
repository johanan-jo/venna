// Unfair Fishing — Competitive fishing with surprise twists (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const FISH = ['🐟', '🐠', '🐡', '🦈', '🐙', '🦑', '🦞', '🦀'];
        const DURATION = 40;

        let scores = Array(nP).fill(0);
        let lines = Array(nP).fill(null).map((_, i) => ({ x: 80 + (i * (W - 100) / nP), depth: 0, state: 'idle', fishOn: false, nibble: false, nibbleT: 0, reel: 0 }));
        let fishEntities = [];
        let elapsed = 0, lastTs = null, animId = null, over = false;
        const WATER_Y = H * 0.32;

        function spawnFish() {
            return { x: 40 + Math.random() * (W - 80), y: WATER_Y + 60 + Math.random() * (H - WATER_Y - 120), vx: (Math.random() - 0.5) * 80, vy: 0, emoji: FISH[Math.floor(Math.random() * FISH.length)], id: Math.random() };
        }

        function draw() {
            // Sky
            const skyGrad = ctx.createLinearGradient(0, 0, 0, WATER_Y);
            skyGrad.addColorStop(0, '#0ea5e9'); skyGrad.addColorStop(1, '#7dd3fc');
            ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, WATER_Y);
            // Water
            const waterGrad = ctx.createLinearGradient(0, WATER_Y, 0, H);
            waterGrad.addColorStop(0, '#0369a1'); waterGrad.addColorStop(1, '#082f49');
            ctx.fillStyle = waterGrad; ctx.fillRect(0, WATER_Y, W, H - WATER_Y);
            // Waves
            ctx.beginPath(); ctx.moveTo(0, WATER_Y);
            for (let x = 0; x < W; x += 20) ctx.quadraticCurveTo(x + 10, WATER_Y - 5 + Math.sin(Date.now() / 500 + x * 0.05) * 4, x + 20, WATER_Y);
            ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
            ctx.fillStyle = '#0284c7'; ctx.fill();

            // Fish entities
            fishEntities.forEach(f => {
                ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(f.emoji, f.x, f.y);
            });

            // Fishing lines and rods
            lines.forEach((ln, i) => {
                const rodX = 50 + i * ((W - 80) / Math.max(nP - 1, 1));
                const rodY = 30;
                // Rod
                ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(rodX - 15, rodY + 20); ctx.lineTo(rodX + 15, rodY); ctx.stroke();
                // Line
                const hookY = WATER_Y + ln.depth * (H - WATER_Y - 60);
                ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(rodX + 15, rodY); ctx.lineTo(rodX, hookY); ctx.stroke();
                // Hook/bobber
                ctx.beginPath(); ctx.arc(rodX, hookY, 6, 0, Math.PI * 2);
                ctx.fillStyle = ln.fishOn ? '#facc15' : ln.nibble ? '#fb923c' : '#ef4444'; ctx.fill();
                // Player label
                ctx.fillStyle = COLORS[i]; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`${players[i].name}${i === myIdx ? ' (you)' : ''}: ${scores[i]}🐟`, rodX, rodY - 5);

                if (ln.nibble && !ln.fishOn) {
                    ctx.fillStyle = '#fb923c'; ctx.font = '12px Inter'; ctx.textBaseline = 'top';
                    ctx.fillText('nibble! → CLICK!', rodX, hookY + 10);
                }
                if (ln.fishOn) {
                    ctx.fillStyle = '#facc15'; ctx.font = 'bold 13px Inter'; ctx.textBaseline = 'top';
                    ctx.fillText('🎣 REEL IN! CLICK!', rodX, hookY + 10);
                }
            });

            // HUD
            const timeLeft = Math.max(0, DURATION - elapsed);
            ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 22);
            ctx.font = 'bold 12px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  |  Cast / reel: CLICK your rod!`, W / 2, 11);
        }

        function getRodX(i) {
            return 50 + i * ((W - 80) / Math.max(nP - 1, 1));
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
            const ln = lines[myIdx];
            const rodX = getRodX(myIdx);
            const dist = Math.abs(mx - rodX);
            if (dist > 60) return;

            if (ln.state === 'idle') {
                ln.state = 'cast'; ln.depth = 0;
                ln.fishOn = false; ln.nibble = false;
                scheduleNibble(myIdx);
                socket.emit('game-action', { roomCode, action: { type: 'cast', pi: myIdx } });
            } else if (ln.fishOn) {
                scores[myIdx]++;
                ln.state = 'idle'; ln.depth = 0; ln.fishOn = false; ln.nibble = false;
                socket.emit('game-action', { roomCode, action: { type: 'reel', pi: myIdx, caught: true } });
            } else if (ln.nibble) {
                // Too early / late — fish escapes
                ln.nibble = false; ln.state = 'idle'; ln.depth = 0;
                socket.emit('game-action', { roomCode, action: { type: 'reel', pi: myIdx, caught: false } });
            }
        }

        function scheduleNibble(pi) {
            const delay = 1500 + Math.random() * 3000;
            setTimeout(() => {
                if (over || lines[pi].state !== 'cast') return;
                lines[pi].nibble = true;
                lines[pi].depth = 0.5 + Math.random() * 0.4;
                setTimeout(() => {
                    if (lines[pi].nibble) { lines[pi].nibble = false; lines[pi].fishOn = true; }
                }, 600 + Math.random() * 400);
            }, delay);
        }

        function loop(ts) {
            if (over) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.08);
            lastTs = ts; elapsed += dt;

            fishEntities.forEach(f => { f.x += f.vx * dt; if (f.x < 0) f.vx = Math.abs(f.vx); if (f.x > W) f.vx = -Math.abs(f.vx); });
            if (Math.random() < dt * 0.5 && fishEntities.length < 12) fishEntities.push(spawnFish());

            if (elapsed >= DURATION && !over) {
                over = true; cancelAnimationFrame(animId);
                const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                setTimeout(() => window.vennaEndGame(results), 500); return;
            }
            draw(); animId = requestAnimationFrame(loop);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'cast') { lines[action.pi].state = 'cast'; lines[action.pi].depth = 0.3 + Math.random() * 0.5; }
            if (action.type === 'reel') {
                if (action.caught) scores[action.pi]++;
                lines[action.pi].state = 'idle'; lines[action.pi].depth = 0; lines[action.pi].fishOn = false; lines[action.pi].nibble = false;
            }
        });

        canvas.addEventListener('click', handleClick);
        for (let i = 0; i < nP; i++) fishEntities.push(spawnFish());
        animId = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['unfair-fishing'] = { init };
})();
