// Dots and Boxes — 2-4 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const N = 5; // NxN grid of dots → (N-1)x(N-1) boxes
        const PAD = 50;
        const CELL = Math.min(W - PAD * 2, H - PAD * 2 - 40) / (N - 1);
        const OFFSET_Y = 40; // extra top offset for score display
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        const ids = players.map(p => p.id);
        let turnIdx = 0;
        let scores = {};
        players.forEach(p => scores[p.id] = 0);

        // hLines[r][c] = owner of horizontal edge between dot(r,c) and dot(r,c+1)  [N rows × (N-1) cols]
        // vLines[r][c] = owner of vertical edge between dot(r,c) and dot(r+1,c)    [(N-1) rows × N cols]
        let hLines = Array(N).fill(null).map(() => Array(N - 1).fill(null));
        let vLines = Array(N - 1).fill(null).map(() => Array(N).fill(null));
        let boxes = Array(N - 1).fill(null).map(() => Array(N - 1).fill(null));
        let over = false;

        function dotX(c) { return PAD + c * CELL; }
        function dotY(r) { return PAD + OFFSET_Y + r * CELL; }

        // A box (r,c) is complete when all 4 edges are owned:
        //   top:    hLines[r][c]      bottom: hLines[r+1][c]
        //   left:   vLines[r][c]      right:  vLines[r][c+1]
        function completeBoxes(pId) {
            let completed = 0;
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
                if (!boxes[r][c] &&
                    hLines[r][c] && hLines[r + 1][c] &&
                    vLines[r][c] && vLines[r][c + 1]) {
                    boxes[r][c] = pId;
                    scores[pId] = (scores[pId] || 0) + 1;
                    completed++;
                }
            }
            return completed;
        }

        function totalBoxes() { return boxes.flat().filter(Boolean).length; }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            // Boxes
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
                if (boxes[r][c]) {
                    const pi = ids.indexOf(boxes[r][c]);
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = COLORS[pi] || '#888';
                    ctx.fillRect(dotX(c) + 2, dotY(r) + 2, CELL - 4, CELL - 4);
                    ctx.globalAlpha = 1;
                }
            }

            // Horizontal lines: hLines[r][c] connects dot(r,c)→dot(r,c+1)
            for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) {
                const owner = hLines[r][c];
                ctx.strokeStyle = owner ? COLORS[ids.indexOf(owner)] : '#2a2a4a';
                ctx.lineWidth = owner ? 4 : 2;
                ctx.beginPath();
                ctx.moveTo(dotX(c), dotY(r));
                ctx.lineTo(dotX(c + 1), dotY(r));
                ctx.stroke();
            }

            // Vertical lines: vLines[r][c] connects dot(r,c)→dot(r+1,c)
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) {
                const owner = vLines[r][c];
                ctx.strokeStyle = owner ? COLORS[ids.indexOf(owner)] : '#2a2a4a';
                ctx.lineWidth = owner ? 4 : 2;
                ctx.beginPath();
                ctx.moveTo(dotX(c), dotY(r));
                ctx.lineTo(dotX(c), dotY(r + 1));
                ctx.stroke();
            }

            // Dots
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                ctx.fillStyle = '#e8eaf6';
                ctx.beginPath(); ctx.arc(dotX(c), dotY(r), 5, 0, Math.PI * 2); ctx.fill();
            }

            // Scores
            ctx.font = '14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            players.forEach((p, i) => {
                ctx.fillStyle = COLORS[i];
                ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 8, 8 + i * 20);
            });

            // Turn indicator
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
            ctx.fillText(isMyTurn ? 'Your turn!' : `${players[turnIdx % players.length]?.name}'s turn`, W / 2, H - 8);
        }

        // Returns { type: 'h'|'v', r, c } for the edge nearest to (mx,my), or null
        function getEdge(mx, my) {
            const THRESH = 14;
            // Horizontal edges: hLines[r][c] between dot(r,c) and dot(r,c+1)
            for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) {
                const y = dotY(r), x1 = dotX(c), x2 = dotX(c + 1);
                if (Math.abs(my - y) < THRESH && mx > x1 && mx < x2)
                    return { type: 'h', r, c };
            }
            // Vertical edges: vLines[r][c] between dot(r,c) and dot(r+1,c)
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) {
                const x = dotX(c), y1 = dotY(r), y2 = dotY(r + 1);
                if (Math.abs(mx - x) < THRESH && my > y1 && my < y2)
                    return { type: 'v', r, c };
            }
            return null;
        }

        function applyMove({ type, r, c, pId }) {
            if (type === 'h') {
                if (hLines[r][c]) return false;
                hLines[r][c] = pId;
            } else {
                if (vLines[r][c]) return false;
                vLines[r][c] = pId;
            }
            const got = completeBoxes(pId);
            if (!got) turnIdx++;
            draw();
            if (totalBoxes() === (N - 1) * (N - 1) && !over) {
                over = true;
                const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                setTimeout(() => window.vennaEndGame(results), 800);
            }
            return true;
        }

        function handleClick(e) {
            if (over) return;
            if (ids[turnIdx % ids.length] !== myPlayerId) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            const edge = getEdge(mx, my);
            if (!edge) return;
            const action = { ...edge, pId: myPlayerId };
            if (applyMove(action)) socket.emit('game-action', { roomCode, action });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'h' || action.type === 'v') applyMove(action);
        });

        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['dots-boxes'] = { init };
})();
