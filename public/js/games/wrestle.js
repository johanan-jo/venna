// Wrestle & Frogs Fight — Tap rapidly to push opponent out of ring (2 players)
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

            const RING_R = Math.min(W, H) * 0.38;
            const CX = W / 2, CY = H / 2;
            const TAP_FORCE = 8;
            const FRICTION = 0.88;
            const COOLDOWN = 80; // ms between effective taps (diminishing returns)

            let positions = [
                { x: CX - RING_R * 0.4, y: CY, vx: 0, vy: 0 },
                { x: CX + RING_R * 0.4, y: CY, vx: 0, vy: 0 },
            ];
            let scores = [0, 0];
            let round = 0, ROUNDS = 5;
            let lastTap = [0, 0];
            let pushCooldown = [0, 0]; // diminishing returns counter
            let over = false, animId = null;
            let flashMsg = '';

            function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
            function distFromCenter(p) { return Math.hypot(p.x - CX, p.y - CY); }

            function resetRound() {
                positions = [
                    { x: CX - RING_R * 0.4, y: CY, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
                    { x: CX + RING_R * 0.4, y: CY, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
                ];
            }

            function draw() {
                ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

                // Ring
                ctx.beginPath(); ctx.arc(CX, CY, RING_R, 0, Math.PI * 2);
                ctx.fillStyle = isfrogs ? '#1a3a1e' : '#1a1414'; ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
                // Inner circle
                ctx.beginPath(); ctx.arc(CX, CY, 8, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 1; ctx.stroke();

                // Players
                positions.forEach((p, i) => {
                    const r = 26;
                    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[i]; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.font = `${isfrogs ? 28 : 20}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(isfrogs ? '🐸' : (i === 0 ? '🤼' : '🤼'), p.x, p.y);
                });

                // Scores
                ctx.font = 'bold 16px Inter'; ctx.textBaseline = 'top';
                ctx.fillStyle = COLORS[0]; ctx.textAlign = 'left'; ctx.fillText(`${players[0].name}: ${scores[0]}`, 10, 10);
                ctx.fillStyle = COLORS[1]; ctx.textAlign = 'right'; ctx.fillText(`${players[1].name}: ${scores[1]}`, W - 10, 10);
                ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.fillText(`Round ${round + 1}/${ROUNDS}`, W / 2, 10);

                // Instruction
                const isMyTurn = true;
                ctx.font = '13px Inter'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`Spam SPACE or click to push opponent out!`, W / 2, H - 8);

                // Flash message (round result)
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
                if (timeSince < COOLDOWN) { pushCooldown[pi] = Math.min(pushCooldown[pi] + 1, 5); }
                else { pushCooldown[pi] = Math.max(0, pushCooldown[pi] - 1); }

                // Compute push direction toward opponent
                const me = positions[pi], them = positions[1 - pi];
                const dx = them.x - me.x, dy = them.y - me.y;
                const d = Math.max(1, Math.hypot(dx, dy));
                const force = TAP_FORCE * Math.max(0.3, 1 - pushCooldown[pi] * 0.15);
                them.vx += (dx / d) * force;
                them.vy += (dy / d) * force;
                // Slight self-recoil
                me.vx -= (dx / d) * force * 0.1;
                me.vy -= (dy / d) * force * 0.1;
            }

            function simulate() {
                positions.forEach((p, i) => {
                    p.x += p.vx; p.y += p.vy;
                    p.vx *= FRICTION; p.vy *= FRICTION;
                    // Check out of ring
                    if (distFromCenter(p) > RING_R - 26) {
                        if (!over) { roundWin(1 - i); }
                    }
                });
                // Collision
                const d = dist(positions[0], positions[1]);
                if (d < 52) {
                    const dx = positions[1].x - positions[0].x, dy = positions[1].y - positions[0].y;
                    const nd = Math.max(1, Math.hypot(dx, dy));
                    const overlap = (52 - d) / 2;
                    positions[0].x -= dx / nd * overlap; positions[0].y -= dy / nd * overlap;
                    positions[1].x += dx / nd * overlap; positions[1].y += dy / nd * overlap;
                }
            }

            let roundTimeout = null;
            function roundWin(pi) {
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

            function loop() {
                if (!over) { simulate(); draw(); }
                animId = requestAnimationFrame(loop);
            }

            function onKey(e) {
                if (e.code === 'Space') { e.preventDefault(); tap(myIdx); socket.emit('game-action', { roomCode, action: { type: 'tap', pi: myIdx } }); }
            }

            canvas.addEventListener('click', () => {
                tap(myIdx);
                socket.emit('game-action', { roomCode, action: { type: 'tap', pi: myIdx } });
            });
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
