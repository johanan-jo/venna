// Snakes — Multiplayer Snake (2-4 players)
// Edge Case: head-on collision → both snakes die (checked THIS frame before resolution)
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    const GRID = 20, TICK = 120;

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const COLS = Math.floor(W / GRID), ROWS = Math.floor(H / GRID);
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);

        const STARTS = [
            { x: 3, y: 3, dx: 1, dy: 0 },
            { x: COLS - 4, y: ROWS - 4, dx: -1, dy: 0 },
            { x: COLS - 4, y: 3, dx: -1, dy: 0 },
            { x: 3, y: ROWS - 4, dx: 1, dy: 0 },
        ];

        let snakes = Array(nP).fill(null).map((_, i) => ({
            body: [{ x: STARTS[i].x, y: STARTS[i].y }],
            dx: STARTS[i].dx, dy: STARTS[i].dy,
            alive: true, score: 0,
        }));
        let food = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
        let over = false, ticker = null;

        function spawnFood() {
            food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Grid dots
            ctx.fillStyle = '#1a1f3a';
            for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
                ctx.fillRect(x * GRID + GRID / 2 - 1, y * GRID + GRID / 2 - 1, 2, 2);
            }
            // Food
            ctx.font = `${GRID - 2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('⭐', food.x * GRID + GRID / 2, food.y * GRID + GRID / 2);
            // Snakes
            snakes.forEach((sn, i) => {
                sn.body.forEach((seg, si) => {
                    ctx.fillStyle = sn.alive ? COLORS[i] : COLORS[i] + '44';
                    const margin = si === 0 ? 1 : 2;
                    ctx.beginPath();
                    ctx.roundRect(seg.x * GRID + margin, seg.y * GRID + margin, GRID - margin * 2, GRID - margin * 2, si === 0 ? 4 : 2);
                    ctx.fill();
                    if (si === 0 && sn.alive) {
                        ctx.fillStyle = '#fff'; ctx.font = `${GRID * 0.5}px sans-serif`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText('●', seg.x * GRID + GRID * (sn.dx === 0 ? 0.5 : sn.dx > 0 ? 0.65 : 0.35),
                            seg.y * GRID + GRID * (sn.dy === 0 ? 0.5 : sn.dy > 0 ? 0.65 : 0.35));
                    }
                });
            });
            // Scores
            ctx.font = 'bold 13px Inter'; ctx.textBaseline = 'top';
            players.slice(0, nP).forEach((p, i) => {
                ctx.fillStyle = COLORS[i];
                ctx.textAlign = i < 2 ? 'left' : 'right';
                const x = i % 2 === 0 ? 6 : W - 6;
                const y = i < 2 ? 4 : H - 18;
                ctx.fillText(`${p.name}: ${snakes[i].score}${snakes[i].alive ? '' : ' 💀'}`, x, y);
            });
            if (over) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Game Over!', W / 2, H / 2);
            }
        }

        function step() {
            if (over) return;

            // ── Compute all next heads FIRST, before resolving deaths
            const nextHeads = snakes.map(sn => {
                if (!sn.alive) return null;
                return { x: sn.body[0].x + sn.dx, y: sn.body[0].y + sn.dy };
            });

            // ── Head-on collision detection: if two alive snakes move to the same cell,
            //    mark BOTH for death before any body updates happen
            const collideSet = new Set();
            for (let i = 0; i < nP; i++) {
                if (!nextHeads[i] || !snakes[i].alive) continue;
                for (let j = i + 1; j < nP; j++) {
                    if (!nextHeads[j] || !snakes[j].alive) continue;
                    if (nextHeads[i].x === nextHeads[j].x && nextHeads[i].y === nextHeads[j].y) {
                        // Head-on: both die
                        collideSet.add(i);
                        collideSet.add(j);
                    }
                }
            }
            // Also mark head-to-body collisions (checked AFTER head-on, not before)
            snakes.forEach((sn, i) => {
                if (!sn.alive || !nextHeads[i] || collideSet.has(i)) return;
                const head = nextHeads[i];
                // Wall
                if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
                    collideSet.add(i); return;
                }
                // Head into any body segment (including own body, excluding own neck)
                for (let j = 0; j < nP; j++) {
                    const start = (j === i) ? 1 : 0; // skip own head
                    const bodyToCheck = snakes[j].body.slice(start);
                    if (bodyToCheck.some(seg => seg.x === head.x && seg.y === head.y)) {
                        collideSet.add(i); break;
                    }
                }
            });

            // Apply deaths
            collideSet.forEach(i => { snakes[i].alive = false; });

            // Move surviving snakes
            snakes.forEach((sn, i) => {
                if (!sn.alive || collideSet.has(i)) return;
                const head = nextHeads[i];
                sn.body.unshift(head);
                if (head.x === food.x && head.y === food.y) { sn.score++; spawnFood(); }
                else sn.body.pop();
            });

            const aliveCount = snakes.filter(s => s.alive).length;
            if (aliveCount <= (nP > 1 ? 1 : 0) && !over) {
                over = true;
                clearInterval(ticker);
                const results = players.map((p, i) => ({ playerId: p.id, score: snakes[i].score }));
                setTimeout(() => window.vennaEndGame(results), 1500);
            }
            draw();
        }

        function handleKey(e) {
            if (over) return;
            const sn = snakes[myIdx]; if (!sn || !sn.alive) return;
            const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
            const d = dirs[e.key];
            if (!d) return;
            if (d[0] === -sn.dx && d[1] === -sn.dy) return; // can't reverse
            sn.dx = d[0]; sn.dy = d[1];
            socket.emit('game-action', { roomCode, action: { type: 'dir', dx: d[0], dy: d[1], pi: myIdx } });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'dir') {
                const sn = snakes[action.pi];
                if (sn) { sn.dx = action.dx; sn.dy = action.dy; }
            }
        });

        ticker = setInterval(step, TICK);
        document.addEventListener('keydown', handleKey);
        draw();
        return () => { clearInterval(ticker); document.removeEventListener('keydown', handleKey); socket.off('game-action'); };
    }

    G['snakes'] = { init };
})();
