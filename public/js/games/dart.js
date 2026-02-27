// Dart — 3 darts per round, 5 rounds, aim for bullseye (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const ROUNDS = 5, DARTS_PER_ROUND = 3;

        const panelW = W / nP;
        const cx = (i) => i * panelW + panelW / 2;
        const cy = H / 2 + 20;
        const R = Math.min(panelW * 0.38, 90);

        let scores = Array(nP).fill(0);
        let round = 0, dart = 0;
        // powerH: horizontal power (oscillating), powerV: vertical power (click once to lock H, again to lock V)
        let states = Array(nP).fill(null).map(() => ({ phase: 'h', hPow: 0, vPow: 0, hDir: 1, vDir: 1, locked: false, darts: [], dartsLeft: DARTS_PER_ROUND }));
        let animId = null;

        function drawBoard(i) {
            const BCX = cx(i), BCY = cy;
            // Board rings
            const rings = [
                { r: R, c: '#4b2e0a' },
                { r: R * 0.95, c: '#000' },
                { r: R * 0.85, c: '#c41e3a' },
                { r: R * 0.80, c: '#228b22' },
                { r: R * 0.65, c: '#c41e3a' },
                { r: R * 0.60, c: '#228b22' },
                { r: R * 0.40, c: '#c41e3a' },
                { r: R * 0.35, c: '#228b22' },
                { r: R * 0.12, c: '#228b22' },
                { r: R * 0.07, c: '#c41e3a' },
            ];
            rings.forEach(r => { ctx.beginPath(); ctx.arc(BCX, BCY, r.r, 0, Math.PI * 2); ctx.fillStyle = r.c; ctx.fill(); });
            // Numbers
            const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
            ctx.font = `bold ${R * 0.12}px Inter`;
            nums.forEach((n, i) => {
                const angle = (i / 20) * Math.PI * 2 - Math.PI / 2;
                const tx = BCX + Math.cos(angle) * R * 0.91;
                const ty = BCY + Math.sin(angle) * R * 0.91;
                ctx.fillStyle = '#ddd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(n, tx, ty);
            });
            // Crosshair lines
            ctx.strokeStyle = '#33333366'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(BCX - R, BCY); ctx.lineTo(BCX + R, BCY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(BCX, BCY - R); ctx.lineTo(BCX, BCY + R); ctx.stroke();
        }

        function drawPowerBars(i) {
            const s = states[i]; const isMe = i === myIdx;
            const barX = cx(i) - 10, barY = cy + R + 12;
            if (!s.locked || s.phase === 'v') {
                // H bar
                ctx.fillStyle = '#1f2937'; ctx.fillRect(cx(i) - R, barY, R * 2, 12);
                const hFill = (s.hPow + 1) / 2;
                ctx.fillStyle = `hsl(${120 - hFill * 120}, 90%, 50%)`;
                ctx.fillRect(cx(i) - R, barY, R * 2 * hFill, 12);
                ctx.fillStyle = '#fff'; ctx.fillRect(cx(i) - R + R * 2 * hFill - 1, barY - 2, 2, 16);
            }
            if (s.phase === 'v' || s.locked) {
                ctx.fillStyle = '#1f2937'; ctx.fillRect(cx(i) - R, barY + 16, R * 2, 12);
                const vFill = (s.vPow + 1) / 2;
                ctx.fillStyle = `hsl(${120 - vFill * 120}, 90%, 50%)`;
                ctx.fillRect(cx(i) - R, barY + 16, R * 2 * vFill, 12);
                ctx.fillStyle = '#fff'; ctx.fillRect(cx(i) - R + R * 2 * vFill - 1, barY + 14, 2, 16);
            }
            // Label
            ctx.fillStyle = COLORS[i]; ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(s.phase === 'h' ? 'Set aim →  click!' : s.locked ? '' : 'Set power ↕  click!', cx(i), barY + 32);
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(`Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}  ·  Dart ${Math.min(dart + 1, DARTS_PER_ROUND)}/${DARTS_PER_ROUND}`, W / 2, 6);

            for (let i = 0; i < nP; i++) {
                drawBoard(i);
                const s = states[i];
                // Player name + score
                ctx.fillStyle = COLORS[i]; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`${players[i].name}${i === myIdx ? ' (you)' : ''}  —  ${scores[i]}pt`, cx(i), cy - R - 8);
                // Previous darts
                s.darts.slice(-3 * ROUNDS).forEach(d => {
                    const dx = cx(i) + d.nx * R, dy = cy + d.ny * R;
                    ctx.fillStyle = COLORS[i]; ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI * 2); ctx.fill();
                });
                // Current crosshair (before locked)
                if (!s.locked && s.phase !== 'h') {
                    const sx = cx(i) + s.hPow * R * 0.9, sy1 = cy - R * 0.8, sy2 = cy + R * 0.8;
                    ctx.strokeStyle = COLORS[i] + 'cc'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(sx, sy1); ctx.lineTo(sx, sy2); ctx.stroke();
                }
                if (i === myIdx && !s.locked) drawPowerBars(i);
            }
        }

        function scoreForPos(nx, ny) {
            const d = Math.hypot(nx, ny);
            if (d <= 0.07) return 50; // bullseye
            if (d <= 0.12) return 25;
            if (d <= 0.35) return 15;
            if (d <= 0.60) return 10;
            if (d <= 0.80) return 5;
            if (d <= 0.95) return 2;
            return 0;
        }

        function handleClick() {
            const s = states[myIdx];
            if (s.locked) return;
            if (s.phase === 'h') { s.phase = 'v'; return; }
            // Throw dart
            s.locked = true;
            const nx = s.hPow * 0.9 + (Math.random() - 0.5) * 0.04;
            const ny = -(s.vPow) * 0.85 + (Math.random() - 0.5) * 0.04;
            const pts = scoreForPos(nx, ny);
            scores[myIdx] += pts;
            s.darts.push({ nx, ny, pts });
            socket.emit('game-action', { roomCode, action: { type: 'dart', pi: myIdx, nx, ny, pts } });
            setTimeout(nextDart, 900);
        }

        function nextDart() {
            dart++;
            if (dart >= DARTS_PER_ROUND) {
                dart = 0; round++;
                if (round >= ROUNDS) {
                    const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                    window.vennaEndGame(results); return;
                }
            }
            states = states.map(s => ({ ...s, phase: 'h', hPow: 0, vPow: 0, hDir: 1, vDir: 1, locked: false }));
        }

        function animate() {
            const s = states[myIdx];
            if (!s.locked) {
                if (s.phase === 'h') { s.hPow += 0.025 * s.hDir; if (Math.abs(s.hPow) >= 1) s.hDir *= -1; }
                else { s.vPow += 0.03 * s.vDir; if (Math.abs(s.vPow) >= 1) s.vDir *= -1; }
            }
            draw();
            animId = requestAnimationFrame(animate);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'dart') {
                const s = states[action.pi];
                s.locked = true; s.darts.push({ nx: action.nx, ny: action.ny, pts: action.pts });
                scores[action.pi] += action.pts;
            }
        });

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(animate);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['dart'] = { init };
})();
