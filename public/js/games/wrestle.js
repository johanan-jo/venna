// Wrestle & Frogs Fight — Tap rapidly to push opponent out of ring
// Edge Cases: Stamina Decay (push power decreases over time), arena shrink (Battle Royale circle),
//             Boundary static friction (no popping through walls)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function makeGame(slug) {
        const isfrogs = slug === 'frogs-fight';

        function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const myIdx = ids.indexOf(myPlayerId);
            const COLORS = ['#ef4444', '#3b82f6'];

            const INITIAL_RING_R = Math.min(W, H) * 0.38;
            let ringR = INITIAL_RING_R;
            const CX = W / 2, CY = H / 2;
            const BASE_FORCE = 8;
            const FRICTION = 0.88;
            const COOLDOWN_MS = 80;

            let positions = [
                { x: CX - ringR * 0.4, y: CY, vx: 0, vy: 0 },
                { x: CX + ringR * 0.4, y: CY, vx: 0, vy: 0 },
            ];
            let scores = [0, 0];
            let round = 0; const ROUNDS = 5;
            let lastTap = [0, 0];
            // ── Stamina: track consecutive fast taps to reduce power
            let stamina = [1.0, 1.0]; // 1.0 = full, decreases with spam
            let matchTimer = 0; // elapsed time in round (seconds)
            let ROUND_SHRINK_START = 8; // seconds before arena starts shrinking
            let over = false, animId = null, lastTs = null;
            let flashMsg = '';

            function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
            function distFromCenter(p) { return Math.hypot(p.x - CX, p.y - CY); }

            function resetRound() {
                positions = [
                    { x: CX - ringR * 0.4, y: CY, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
                    { x: CX + ringR * 0.4, y: CY, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
                ];
                ringR = INITIAL_RING_R;
                matchTimer = 0;
                stamina = [1.0, 1.0];
            }

            function draw() {
                ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
                // Shrink danger ring indicator
                if (matchTimer > ROUND_SHRINK_START * 0.7) {
                    ctx.beginPath(); ctx.arc(CX, CY, INITIAL_RING_R, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ef444433'; ctx.lineWidth = 3; ctx.stroke();
                }
                // Main ring
                ctx.beginPath(); ctx.arc(CX, CY, ringR, 0, Math.PI * 2);
                ctx.fillStyle = isfrogs ? '#1a3a1e' : '#1a1414'; ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
                ctx.beginPath(); ctx.arc(CX, CY, 8, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 1; ctx.stroke();

                // Players
                positions.forEach((p, i) => {
                    const r = 26;
                    // Static friction visual: if at boundary, show edge indicator
                    const d = distFromCenter(p);
                    const atEdge = d > ringR - r - 5;
                    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[i]; ctx.fill();
                    ctx.strokeStyle = atEdge ? '#facc15' : '#fff'; ctx.lineWidth = atEdge ? 3 : 2; ctx.stroke();
                    ctx.font = `${isfrogs ? 28 : 20}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(isfrogs ? '🐸' : '🤼', p.x, p.y);
                    // Stamina bar
                    const sw = 40;
                    ctx.fillStyle = '#1f2937'; ctx.fillRect(p.x - sw / 2, p.y - r - 14, sw, 5);
                    ctx.fillStyle = `hsl(${stamina[i] * 120}, 90%, 50%)`;
                    ctx.fillRect(p.x - sw / 2, p.y - r - 14, sw * stamina[i], 5);
                });

                // Scores
                ctx.font = 'bold 16px Inter'; ctx.textBaseline = 'top';
                ctx.fillStyle = COLORS[0]; ctx.textAlign = 'left'; ctx.fillText(`${players[0].name}: ${scores[0]}`, 10, 10);
                ctx.fillStyle = COLORS[1]; ctx.textAlign = 'right'; ctx.fillText(`${players[1].name}: ${scores[1]}`, W - 10, 10);
                ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.fillText(`Round ${round + 1}/${ROUNDS}`, W / 2, 10);

                ctx.font = '13px Inter'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`Spam SPACE or click to push! Stamina decays with rapid taps.`, W / 2, H - 8);

                if (flashMsg) {
                    ctx.font = 'bold 28px Inter'; ctx.fillStyle = '#facc15';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(flashMsg, CX, CY);
                }
            }

            function tap(pi) {
                const now = Date.now();
                const timeSince = now - lastTap[pi];
                lastTap[pi] = now;

                // ── Stamina decay: rapid taps (< cooldown) eat stamina
                if (timeSince < COOLDOWN_MS) {
                    stamina[pi] = Math.max(0.15, stamina[pi] - 0.08);
                } else {
                    // Slow taps partially restore stamina
                    stamina[pi] = Math.min(1.0, stamina[pi] + 0.04);
                }

                const force = BASE_FORCE * stamina[pi];
                const me = positions[pi], them = positions[1 - pi];
                const dx = them.x - me.x, dy = them.y - me.y;
                const d = Math.max(1, Math.hypot(dx, dy));
                them.vx += (dx / d) * force;
                them.vy += (dy / d) * force;
                // Slight self-recoil
                me.vx -= (dx / d) * force * 0.1;
                me.vy -= (dy / d) * force * 0.1;
            }

            function simulate(dt) {
                positions.forEach((p, i) => {
                    p.x += p.vx; p.y += p.vy;
                    p.vx *= FRICTION; p.vy *= FRICTION;

                    // ── Static friction / boundary clamping: prevent tunneling
                    //    If outside ring, push back with proportional damping (no "pop")
                    const PSIZE = 26;
                    const d = distFromCenter(p);
                    const limit = ringR - PSIZE;
                    if (d > limit) {
                        // Project back to ring edge
                        const nx = (p.x - CX) / d, ny = (p.y - CY) / d;
                        p.x = CX + nx * limit;
                        p.y = CY + ny * limit;
                        // ── Static friction: kill outward velocity component
                        const outwardV = p.vx * nx + p.vy * ny;
                        if (outwardV > 0) {
                            p.vx -= outwardV * nx;
                            p.vy -= outwardV * ny;
                        }
                        // Check if they were pushed OUTSIDE the original ring (to ring has shrunk)
                        if (distFromCenter(p) > INITIAL_RING_R - PSIZE) {
                            if (!over) roundWin(1 - i);
                        }
                    }
                });

                // Collision between players
                const d = dist(positions[0], positions[1]);
                if (d < 52) {
                    const dx = positions[1].x - positions[0].x, dy = positions[1].y - positions[0].y;
                    const nd = Math.max(1, Math.hypot(dx, dy));
                    const overlap = (52 - d) / 2;
                    positions[0].x -= dx / nd * overlap; positions[0].y -= dy / nd * overlap;
                    positions[1].x += dx / nd * overlap; positions[1].y += dy / nd * overlap;
                }

                // ── Stamina natural regeneration over time
                stamina.forEach((_, i) => { stamina[i] = Math.min(1.0, stamina[i] + 0.002 * dt); });

                // ── Arena shrink (Battle Royale circle): after ROUND_SHRINK_START seconds
                matchTimer += dt;
                if (matchTimer > ROUND_SHRINK_START) {
                    ringR = Math.max(INITIAL_RING_R * 0.4, ringR - 15 * dt);
                }
            }

            let roundTimeout = null;
            function roundWin(pi) {
                if (over) return;
                scores[pi]++;
                flashMsg = `${players[pi].name} wins round ${round + 1}! 🎉`;
                round++;
                if (round >= ROUNDS || scores[pi] >= Math.ceil(ROUNDS / 2) + 1) {
                    over = true;
                    const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                    setTimeout(() => window.vennaEndGame(results), 1500);
                } else {
                    roundTimeout = setTimeout(() => { flashMsg = ''; resetRound(); }, 1500);
                }
            }

            function loop(ts) {
                if (!lastTs) lastTs = ts;
                const dt = Math.min((ts - lastTs) / 1000, 0.1);
                lastTs = ts;
                if (!over) { simulate(dt); draw(); }
                animId = requestAnimationFrame(loop);
            }

            function onKey(e) {
                if (e.code === 'Space') { e.preventDefault(); tap(myIdx); socket.emit('game-action', { roomCode, action: { type: 'tap', pi: myIdx } }); }
            }

            canvas.addEventListener('click', () => { tap(myIdx); socket.emit('game-action', { roomCode, action: { type: 'tap', pi: myIdx } }); });
            document.addEventListener('keydown', onKey);
            socket.on('game-action', ({ action }) => { if (action.type === 'tap') tap(action.pi); });

            animId = requestAnimationFrame(loop);
            return () => {
                cancelAnimationFrame(animId); clearTimeout(roundTimeout);
                document.removeEventListener('keydown', onKey);
                socket.off('game-action');
            };
        }
        return { init };
    }

    G['wrestle'] = makeGame('wrestle');
    G['frogs-fight'] = makeGame('frogs-fight');
})();
