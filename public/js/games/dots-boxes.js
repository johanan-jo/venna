// Dots and Boxes — 2-4 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const N = 5; // NxN grid of dots → (N-1)x(N-1) boxes
        const PAD = 50, CELL = Math.min(W - PAD * 2, H - PAD * 2) / (N - 1);
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        const ids = players.map(p => p.id);
        let turnIdx = 0;
        let scores = {};
        players.forEach(p => scores[p.id] = 0);
        let hLines = Array(N - 1).fill(null).map(() => Array(N).fill(null));   // horizontal segment owner
        let vLines = Array(N).fill(null).map(() => Array(N - 1).fill(null));   // vertical segment owner
        let boxes = Array(N - 1).fill(null).map(() => Array(N - 1).fill(null));  // box owner
        let over = false;

        function dotX(c) { return PAD + c * CELL; }
        function dotY(r) { return PAD + r * CELL; }

        function completeBoxes(pId) {
            let completed = 0;
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
                if (!boxes[r][c] && hLines[r][c] && hLines[r][c + 1] && vLines[r][c] && vLines[r + 1][c]) {
                    boxes[r][c] = pId; scores[pId] = (scores[pId] || 0) + 1; completed++;
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
            // Lines
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) {
                const owner = hLines[r][c];
                ctx.strokeStyle = owner ? COLORS[ids.indexOf(owner)] : '#2a2a4a';
                ctx.lineWidth = owner ? 4 : 2;
                ctx.beginPath(); ctx.moveTo(dotX(c), dotY(r)); ctx.lineTo(dotX(c), dotY(r + 1)); ctx.stroke();
            }
            for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) {
                const owner = vLines[r][c];
                ctx.strokeStyle = owner ? COLORS[ids.indexOf(owner)] : '#2a2a4a';
                ctx.lineWidth = owner ? 4 : 2;
                ctx.beginPath(); ctx.moveTo(dotX(c), dotY(r)); ctx.lineTo(dotX(c + 1), dotY(r)); ctx.stroke();
            }
            // Dots
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                ctx.fillStyle = '#e8eaf6'; ctx.beginPath(); ctx.arc(dotX(c), dotY(r), 5, 0, Math.PI * 2); ctx.fill();
            }
            // Scores
            ctx.font = '14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            players.forEach((p, i) => {
                ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 8, 8 + i * 20);
            });
            // Turn
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            ctx.textAlign = 'center'; ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
            ctx.fillText(isMyTurn ? 'Your turn!' : players[turnIdx % players.length]?.name + "'s turn", W / 2, H - 22);
        }

        function getEdge(mx, my) {
            const THRESH = 12;
            for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) {
                const x = dotX(c), y1 = dotY(r), y2 = dotY(r + 1);
                if (Math.abs(mx - x) < THRESH && my > y1 && my < y2) return { type: 'v', r, c };
            }
            for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) {
                const y = dotY(r), x1 = dotX(c), x2 = dotX(c + 1);
                if (Math.abs(my - y) < THRESH && mx > x1 && mx < x2) return { type: 'h', r, c };
            }
            return null;
        }

        function applyMove({ type, r, c, pId }) {
            if (type === 'v') { if (vLines[r][c]) return false; vLines[r][c] = pId; }
            else { if (hLines[r][c]) return false; hLines[r][c] = pId; }
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
            const edge = getEdge(e.clientX - rect.left, e.clientY - rect.top);
            if (!edge) return;
            const action = { ...edge, pId: myPlayerId };
            if (applyMove(action)) socket.emit('game-action', { roomCode, action });
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'v' || action.type === 'h') applyMove(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['dots-boxes'] = { init };
})();
