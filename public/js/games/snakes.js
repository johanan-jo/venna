// Snakes — Multiplayer Snake (2-4 players)
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
            ctx.fillStyle = '#facc15'; ctx.beginPath();
            ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2); ctx.fill();
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
            snakes.forEach((sn, i) => {
                if (!sn.alive) return;
                const head = { x: sn.body[0].x + sn.dx, y: sn.body[0].y + sn.dy };
                // Wall check
                if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { sn.alive = false; return; }
                // Self/other collision
                const hit = snakes.some((s2, j) => s2.body.some(seg => seg.x === head.x && seg.y === head.y));
                if (hit) { sn.alive = false; return; }
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
            const action = { type: 'dir', dx: d[0], dy: d[1] };
            sn.dx = d[0]; sn.dy = d[1];
            socket.emit('game-action', { roomCode, action: { ...action, pi: myIdx } });
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
