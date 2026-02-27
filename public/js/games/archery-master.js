// Archery Master — 5 rounds, wind wobble, most points wins (2-4 players)
// Edge Cases: wind locked at release, Robin Hood double-hit bonus
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const ROUNDS = 5;

        const panelW = W / nP, targetR = Math.min(panelW * 0.35, 80);

        let scores = Array(nP).fill(0);
        let round = 0;
        let cursors = Array(nP).fill(null).map(() => ({ x: 0.5, y: 0.5, locked: false, result: null, arrowX: 0, arrowY: 0 }));
        let wind = { x: (Math.random() - 0.5) * 0.008, y: (Math.random() - 0.5) * 0.004 };
        let wobble = 0.002;
        let animId = null;

        function drawTarget(cx, cy, r) {
            const rings = ['#fff', '#000', '#1e90ff', '#ef4444', '#facc15'];
            rings.forEach((c, i) => {
                ctx.beginPath(); ctx.arc(cx, cy, r * (1 - i * 0.18), 0, Math.PI * 2);
                ctx.fillStyle = c; ctx.fill();
            });
            // Cross hairs
            ctx.strokeStyle = '#00000033'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
        }

        function scoreForDist(d, r) {
            if (d < r * 0.1) return 10;
            if (d < r * 0.28) return 9;
            if (d < r * 0.46) return 7;
            if (d < r * 0.64) return 5;
            if (d < r * 0.82) return 3;
            if (d < r) return 1;
            return 0;
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(`Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}  |  Wind: ${(wind.x * 100).toFixed(1)}, ${(wind.y * 100).toFixed(1)}  |  Click/Space to fire!`, W / 2, 6);

            for (let i = 0; i < nP; i++) {
                const px = i * panelW, cx = px + panelW / 2, cy = H / 2 + 20;
                ctx.fillStyle = '#0f172a'; ctx.fillRect(px, 30, panelW, H - 30);
                ctx.strokeStyle = COLORS[i] + '44'; ctx.lineWidth = 2; ctx.strokeRect(px, 30, panelW, H - 30);

                ctx.fillStyle = COLORS[i]; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(`${players[i].name}${i === myIdx ? ' (you)' : ''}  ${scores[i]}pts`, cx, 34);

                drawTarget(cx, cy, targetR);

                const cur = cursors[i];
                if (!cur.locked) {
                    const sx = cx + (cur.x - 0.5) * targetR * 2.5;
                    const sy = cy + (cur.y - 0.5) * targetR * 2.5;
                    // Crosshair
                    ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12); ctx.stroke();
                    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.strokeStyle = COLORS[i]; ctx.stroke();
                } else {
                    // Draw arrow at locked position
                    const ax = cx + (cur.arrowX - 0.5) * targetR * 2.5;
                    const ay = cy + (cur.arrowY - 0.5) * targetR * 2.5;
                    ctx.fillStyle = COLORS[i]; ctx.beginPath(); ctx.arc(ax, ay, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    if (cur.result !== null) ctx.fillText(`+${cur.result}`, ax, ay - 8);
                }
            }

            // Wind arrow
            const wx = W / 2, wy = H - 30;
            ctx.save(); ctx.translate(wx, wy); ctx.rotate(Math.atan2(wind.y, wind.x));
            ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-20, -6); ctx.lineTo(-20, 6); ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#94a3b8'; ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText('Wind', wx, wy + 8);
        }

        function animate() {
            if (cursors[myIdx].locked) { draw(); animId = requestAnimationFrame(animate); return; }
            // Move cursor with wobble + wind drift
            const cur = cursors[myIdx];
            cur.x += wind.x + (Math.random() - 0.5) * wobble;
            cur.y += wind.y + (Math.random() - 0.5) * wobble;
            cur.x = Math.max(0, Math.min(1, cur.x));
            cur.y = Math.max(0, Math.min(1, cur.y));
            draw();
            animId = requestAnimationFrame(animate);
        }

        function fire() {
            const cur = cursors[myIdx];
            if (cur.locked) return;
            cur.locked = true;
            // ── Lock wind at the moment of release (not during flight)
            const lockedWind = { ...wind };
            const ax = cur.x, ay = cur.y;
            const cx = 0.5, cy = 0.5;
            const dist = Math.hypot(ax - cx, ay - cy) * targetR * 2.5;
            let pts = scoreForDist(dist, targetR);

            // ── Robin Hood double-hit: check if another arrow already landed nearby
            const ROBIN_DIST = 8; // pixels in board space
            const prevArrows = cursors.filter((c, i) => i !== myIdx && c.locked && c.arrowX !== undefined);
            const robinHood = prevArrows.some(c => {
                const px = c.arrowX, py = c.arrowY;
                return Math.hypot((ax - px) * targetR * 2.5, (ay - py) * targetR * 2.5) < ROBIN_DIST;
            });
            if (robinHood && pts > 0) pts += 1; // Robin Hood bonus

            cur.arrowX = ax; cur.arrowY = ay; cur.result = pts; cur.robbinHood = robinHood;
            scores[myIdx] += pts;
            socket.emit('game-action', { roomCode, action: { type: 'fire', pi: myIdx, ax, ay, pts, robinHood } });
            checkRoundEnd();
        }

        function checkRoundEnd() {
            if (!cursors.every(c => c.locked)) return;
            setTimeout(() => {
                round++;
                if (round >= ROUNDS) {
                    const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                    window.vennaEndGame(results); return;
                }
                // New round: reset, increase wobble, new wind
                wind = { x: (Math.random() - 0.5) * (0.008 + round * 0.003), y: (Math.random() - 0.5) * (0.004 + round * 0.002) };
                wobble = 0.002 + round * 0.001;
                cursors = cursors.map(() => ({ x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.5 + (Math.random() - 0.5) * 0.3, locked: false, result: null, arrowX: 0, arrowY: 0 }));
            }, 1200);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'fire') {
                const cur = cursors[action.pi];
                cur.locked = true; cur.arrowX = action.ax; cur.arrowY = action.ay;
                cur.result = action.pts; cur.robinHood = action.robinHood;
                scores[action.pi] += action.pts;
                checkRoundEnd();
            }
        });

        canvas.addEventListener('click', fire);
        document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); fire(); } });
        animId = requestAnimationFrame(animate);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', fire); socket.off('game-action'); };
    }

    G['archery-master'] = { init };
})();
