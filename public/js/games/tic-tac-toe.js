// Tic Tac Toe — 2 players, 3x3 grid
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const CELL = Math.min(W, H) / 4;
        const OX = (W - CELL * 3) / 2, OY = (H - CELL * 3) / 2;

        // Assign symbols
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const symbols = ['X', 'O'];
        const mySymbol = symbols[myIdx] || symbols[0];

        let board = Array(9).fill(null);
        let turn = 0; // index into ids
        let over = false;

        function cell(idx) { return { x: OX + (idx % 3) * CELL, y: OY + Math.floor(idx / 3) * CELL }; }
        function winner(b) {
            const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            for (const [a, b2, c] of lines) if (b[a] && b[a] === b[b2] && b[a] === b[c]) return { sym: b[a], line: [a, b2, c] };
            if (b.every(Boolean)) return { sym: 'draw' };
            return null;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0d0f1a';
            ctx.fillRect(0, 0, W, H);

            // Grid
            ctx.strokeStyle = '#3a3a5a';
            ctx.lineWidth = 3;
            for (let r = 1; r < 3; r++) {
                ctx.beginPath(); ctx.moveTo(OX, OY + r * CELL); ctx.lineTo(OX + 3 * CELL, OY + r * CELL); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(OX + r * CELL, OY); ctx.lineTo(OX + r * CELL, OY + 3 * CELL); ctx.stroke();
            }

            // Symbols
            board.forEach((sym, i) => {
                if (!sym) return;
                const { x, y } = cell(i);
                const cx = x + CELL / 2, cy = y + CELL / 2;
                ctx.font = `bold ${CELL * 0.6}px Outfit`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = sym === 'X' ? '#7c3aed' : '#ec4899';
                ctx.fillText(sym, cx, cy);
            });

            // Status text
            const w = winner(board);
            ctx.font = '18px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            if (w) {
                ctx.fillStyle = '#f59e0b';
                ctx.fillText(w.sym === 'draw' ? "It's a Draw!" : `${w.sym} Wins!`, W / 2, 20);
            } else {
                const turnSym = symbols[turn % 2];
                const isMyTurn = ids[turn % 2] === myPlayerId;
                ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
                ctx.fillText(isMyTurn ? `Your turn (${mySymbol})` : `Opponent's turn (${turnSym})`, W / 2, 20);
            }
        }

        function handleClick(e) {
            if (over) return;
            if (ids[turn % 2] !== myPlayerId) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            for (let i = 0; i < 9; i++) {
                const { x, y } = cell(i);
                if (mx >= x && mx <= x + CELL && my >= y && my <= y + CELL && !board[i]) {
                    const action = { type: 'move', idx: i, sym: mySymbol };
                    applyMove(action);
                    socket.emit('game-action', { roomCode, action });
                    break;
                }
            }
        }

        function applyMove({ idx, sym }) {
            board[idx] = sym;
            turn++;
            draw();
            const w = winner(board);
            if (w && !over) {
                over = true;
                setTimeout(() => {
                    const pid = w.sym === 'draw' ? null : ids[symbols.indexOf(w.sym)];
                    const results = players.map(p => ({ playerId: p.id, score: p.id === pid ? 1 : 0 }));
                    window.vennaEndGame(results);
                }, 1200);
            }
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'move') applyMove(action); });

        canvas.addEventListener('click', handleClick);
        draw();

        return function cleanup() {
            canvas.removeEventListener('click', handleClick);
            socket.off('game-action');
        };
    }

    G['tic-tac-toe'] = { init };
})();
