// Chess — 2 players, full rules (simplified: no en passant, basic pawn promotion to queen)
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const PIECES = {
        wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
        bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
    };
    const INIT = [
        'bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR',
        'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP',
        null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
        'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR',
    ];

    function color(p) { return p ? p[0] : null; }
    function type(p) { return p ? p[1] : null; }

    function moves(board, idx, turn) {
        const p = board[idx]; if (!p || color(p) !== turn) return [];
        const r = Math.floor(idx / 8), c = idx % 8, t = type(p), col = color(p);
        const res = [];
        function add(nr, nc) { if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) { const ni = nr * 8 + nc; if (!board[ni] || color(board[ni]) !== col) res.push(ni); } }
        function slide(dr, dc) { let nr = r + dr, nc = c + dc; while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) { const ni = nr * 8 + nc; if (board[ni]) { if (color(board[ni]) !== col) res.push(ni); break; } res.push(ni); nr += dr; nc += dc; } }
        if (t === 'P') {
            const dir = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1;
            if (!board[(r + dir) * 8 + c]) { res.push((r + dir) * 8 + c); if (r === start && !board[(r + 2 * dir) * 8 + c]) res.push((r + 2 * dir) * 8 + c); }
            [-1, 1].forEach(dc => { if (c + dc >= 0 && c + dc < 8 && board[(r + dir) * 8 + c + dc] && color(board[(r + dir) * 8 + c + dc]) !== col) res.push((r + dir) * 8 + c + dc); });
        } else if (t === 'N') { [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => add(r + dr, c + dc)); }
        else if (t === 'B') { [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
        else if (t === 'R') { [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
        else if (t === 'Q') { [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
        else if (t === 'K') { [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => add(r + dr, c + dc)); }
        return res;
    }

    function inCheck(board, col) {
        const ki = board.findIndex(p => p === col + 'K');
        const opp = col === 'w' ? 'b' : 'w';
        return board.some((p, i) => p && color(p) === opp && moves(board, i, opp).includes(ki));
    }

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const CELL = Math.min(W, H) / 9;
        const OX = (W - CELL * 8) / 2, OY = (H - CELL * 8) / 2;

        const ids = players.map(p => p.id);
        const myColor = ids.indexOf(myPlayerId) === 0 ? 'w' : 'b';
        let board = [...INIT];
        let turn = 'w';
        let selected = null;
        let validMoves = [];
        let over = false;

        function sq(i) { return { x: OX + (i % 8) * CELL, y: OY + Math.floor(i / 8) * CELL }; }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 64; i++) {
                const { x, y } = sq(i);
                const light = (Math.floor(i / 8) + i % 8) % 2 === 0;
                ctx.fillStyle = validMoves.includes(i) ? '#059669' : selected === i ? '#7c3aed' : light ? '#f0d9b5' : '#b58863';
                ctx.fillRect(x, y, CELL, CELL);
                if (board[i]) {
                    ctx.font = `${CELL * 0.72}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = color(board[i]) === 'w' ? '#fff' : '#111';
                    ctx.fillText(PIECES[board[i]], x + CELL / 2, y + CELL / 2 + 2);
                }
            }
            // Coordinates
            ctx.font = '10px Inter'; ctx.fillStyle = '#555';
            'abcdefgh'.split('').forEach((l, i) => { ctx.textAlign = 'center'; ctx.fillText(l, OX + i * CELL + CELL / 2, OY + 8 * CELL + 10); });
            for (let i = 0; i < 8; i++) { ctx.textAlign = 'right'; ctx.fillText(8 - i, OX - 4, OY + i * CELL + CELL / 2 + 4); }
            // Status
            ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const isMyTurn = turn === myColor;
            ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
            ctx.fillText(isMyTurn ? 'Your turn ' : over ? 'Game Over' : players.find(p => p.id !== myPlayerId)?.name + "'s turn", W / 2, 4);
        }

        function applyMove({ from, to }) {
            const p = board[from]; board[to] = p; board[from] = null;
            if (type(p) === 'P' && (Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7)) board[to] = color(p) + 'Q';
            turn = turn === 'w' ? 'b' : 'w';
            selected = null; validMoves = [];
            draw();
            // Check for checkmate
            const opp = turn;
            const hasMove = board.some((_, i) => color(board[i]) === opp && moves(board, i, opp).length > 0);
            if (!hasMove && !over) {
                over = true;
                const loser = opp; const winner = loser === 'w' ? 'b' : 'w';
                const wId = ids[['w', 'b'].indexOf(winner)];
                const results = players.map(p => ({ playerId: p.id, score: p.id === wId ? 1 : 0 }));
                setTimeout(() => window.vennaEndGame(results), 800);
            }
        }

        function handleClick(e) {
            if (over || turn !== myColor) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left - OX, my = e.clientY - rect.top - OY;
            if (mx < 0 || my < 0 || mx > CELL * 8 || my > CELL * 8) return;
            const c = Math.floor(mx / CELL), r = Math.floor(my / CELL), idx = r * 8 + c;
            if (selected !== null && validMoves.includes(idx)) {
                const action = { type: 'move', from: selected, to: idx };
                applyMove(action);
                socket.emit('game-action', { roomCode, action });
            } else if (board[idx] && color(board[idx]) === myColor) {
                selected = idx;
                validMoves = moves(board, idx, myColor).filter(to => { const b2 = [...board]; b2[to] = b2[idx]; b2[idx] = null; return !inCheck(b2, myColor); });
                draw();
            } else { selected = null; validMoves = []; draw(); }
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'move') applyMove(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['chess'] = { init };
})();
