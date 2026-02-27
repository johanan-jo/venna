// Target Practice — Shoot moving targets, 30 seconds (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const DURATION = 30;

        let scores = Array(nP).fill(0);
        let targets = [];
        let elapsed = 0, lastTs = null, animId = null, over = false;
        let flashHits = []; // { x, y, pts, t, color }

        const TARGET_TYPES = [
            { r: 35, pts: 1, color: '#ef4444', dur: 3 },
            { r: 22, pts: 3, color: '#f59e0b', dur: 2 },
            { r: 13, pts: 5, color: '#22c55e', dur: 1.5 },
        ];

        function spawnTarget() {
            const t = TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)];
            return { ...t, x: t.r + Math.random() * (W - t.r * 2), y: t.r + 80 + Math.random() * (H - t.r * 2 - 100), age: 0, id: Math.random() };
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            const timeLeft = Math.max(0, DURATION - elapsed);
            ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  —  Click targets!`, W / 2, 6);

            // Scores
            players.slice(0, nP).forEach((p, i) => {
                ctx.fillStyle = COLORS[i]; ctx.font = 'bold 13px Inter';
                ctx.textAlign = i % 2 === 0 ? 'left' : 'right';
                ctx.fillText(`${p.name}: ${scores[i]}pt${scores[i] !== 1 ? 's' : ''}`, i % 2 === 0 ? 10 : W - 10, 30 + Math.floor(i / 2) * 18);
            });

            // Targets
            targets.forEach(t => {
                const fade = 1 - t.age / t.dur;
                ctx.globalAlpha = fade;
                // Outer ring
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
                ctx.fillStyle = t.color + '33'; ctx.fill();
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.65, 0, Math.PI * 2);
                ctx.fillStyle = t.color; ctx.fill();
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#fff'; ctx.fill();
                // Countdown ring
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.age / t.dur));
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#000'; ctx.font = `bold ${t.r * 0.4}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(t.pts, t.x, t.y);
            });
            ctx.globalAlpha = 1;

            // Hit flashes
            flashHits = flashHits.filter(f => f.t < 0.6);
            flashHits.forEach(f => {
                f.t += 0.016;
                ctx.globalAlpha = 1 - f.t / 0.6;
                ctx.fillStyle = f.color; ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`+${f.pts}`, f.x, f.y - f.t * 40);
            });
            ctx.globalAlpha = 1;
        }

        function loop(ts) {
            if (over) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.1);
            lastTs = ts;
            elapsed += dt;

            // Age targets
            targets = targets.filter(t => { t.age += dt; return t.age < t.dur; });
            // Spawn
            if (Math.random() < dt * 2.5 && targets.length < 8) targets.push(spawnTarget());

            if (elapsed >= DURATION) endGame();
            else { draw(); animId = requestAnimationFrame(loop); }
        }

        function endGame() {
            if (over) return; over = true;
            cancelAnimationFrame(animId);
            draw();
            const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
            setTimeout(() => window.vennaEndGame(results), 500);
        }

        function handleClick(e) {
            if (over) return;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (canvas.height / rect.height);
            for (let ti = targets.length - 1; ti >= 0; ti--) {
                const t = targets[ti];
                if (Math.hypot(mx - t.x, my - t.y) <= t.r) {
                    scores[myIdx] += t.pts;
                    flashHits.push({ x: t.x, y: t.y, pts: t.pts, color: COLORS[myIdx], t: 0 });
                    targets.splice(ti, 1);
                    socket.emit('game-action', { roomCode, action: { type: 'hit', pi: myIdx, tid: t.id, pts: t.pts, x: t.x, y: t.y } });
                    break;
                }
            }
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'hit') {
                scores[action.pi] += action.pts;
                targets = targets.filter(t => t.id !== action.tid);
                flashHits.push({ x: action.x, y: action.y, pts: action.pts, color: COLORS[action.pi], t: 0 });
            }
        });

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['target-practice'] = { init };
})();
