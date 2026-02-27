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

    function pseudoMoves(board, idx, turn) {
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
        if (ki === -1) return false;
        const opp = col === 'w' ? 'b' : 'w';
        return board.some((p, i) => p && color(p) === opp && pseudoMoves(board, i, opp).includes(ki));
    }

    // Legal moves: pseudo-legal moves that don't leave own king in check
    function legalMoves(board, idx, turn) {
        return pseudoMoves(board, idx, turn).filter(to => {
            const b2 = [...board]; b2[to] = b2[idx]; b2[idx] = null;
            return !inCheck(b2, turn);
        });
    }

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const CELL = Math.min(W, H) / 9.5;
        const OX = (W - CELL * 8) / 2, OY = (H - CELL * 8) / 2;

        const ids = players.map(p => p.id);
        // Player 0 = white (host), Player 1 = black (guest)
        const myColor = ids.indexOf(myPlayerId) === 0 ? 'w' : 'b';
        const flipped = myColor === 'b'; // Black sees board from their side

        let board = [...INIT];
        let turn = 'w';
        let selected = null;
        let validMoves = [];
        let over = false;

        // Convert logical board index to displayed row/col (flipped for black)
        function displayRC(logicalIdx) {
            const lr = Math.floor(logicalIdx / 8), lc = logicalIdx % 8;
            return flipped ? { r: 7 - lr, c: 7 - lc } : { r: lr, c: lc };
        }

        function sq(logicalIdx) {
            const { r, c } = displayRC(logicalIdx);
            return { x: OX + c * CELL, y: OY + r * CELL };
        }

        function clickToLogical(mx, my) {
            const dc = Math.floor((mx - OX) / CELL), dr = Math.floor((my - OY) / CELL);
            if (dc < 0 || dc >= 8 || dr < 0 || dr >= 8) return -1;
            const lr = flipped ? 7 - dr : dr, lc = flipped ? 7 - dc : dc;
            return lr * 8 + lc;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            // Find checked king
            const checkedKingIdx = inCheck(board, turn) ? board.findIndex(p => p === turn + 'K') : -1;

            for (let li = 0; li < 64; li++) {
                const { x, y } = sq(li);
                const lr = Math.floor(li / 8), lc = li % 8;
                const light = (lr + lc) % 2 === 0;

                let fillCol;
                if (li === checkedKingIdx) {
                    fillCol = '#dc2626'; // red highlight for checked king
                } else if (validMoves.includes(li)) {
                    fillCol = '#059669';
                } else if (selected === li) {
                    fillCol = '#7c3aed';
                } else {
                    fillCol = light ? '#f0d9b5' : '#b58863';
                }
                ctx.fillStyle = fillCol;
                ctx.fillRect(x, y, CELL, CELL);

                if (board[li]) {
                    const pieceColor = color(board[li]);
                    const isLight = light && selected !== li && !validMoves.includes(li) && li !== checkedKingIdx;

                    // Draw piece shadow/outline for contrast
                    ctx.font = `bold ${CELL * 0.78}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // Stroke for visibility
                    ctx.strokeStyle = pieceColor === 'w' ? '#222' : '#ddd';
                    ctx.lineWidth = 3;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(PIECES[board[li]], x + CELL / 2, y + CELL / 2 + 2);

                    // Fill
                    ctx.fillStyle = pieceColor === 'w' ? '#ffffff' : '#1a1a1a';
                    ctx.fillText(PIECES[board[li]], x + CELL / 2, y + CELL / 2 + 2);
                }
            }

            // Coordinate labels
            ctx.font = '10px Inter'; ctx.fillStyle = '#888';
            const files = flipped ? 'hgfedcba' : 'abcdefgh';
            files.split('').forEach((l, i) => {
                ctx.textAlign = 'center';
                ctx.fillText(l, OX + i * CELL + CELL / 2, OY + 8 * CELL + 12);
            });
            for (let i = 0; i < 8; i++) {
                const rankNum = flipped ? i + 1 : 8 - i;
                ctx.textAlign = 'right';
                ctx.fillText(rankNum, OX - 4, OY + i * CELL + CELL / 2 + 4);
            }

            // Status
            ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const isMyTurn = turn === myColor;
            let statusText;
            if (over) {
                statusText = 'Game Over';
            } else if (checkedKingIdx !== -1) {
                statusText = isMyTurn ? '⚠ You are in CHECK!' : `⚠ ${players.find(p => p.id !== myPlayerId)?.name} is in check`;
            } else {
                statusText = isMyTurn ? 'Your turn' : (players.find(p => p.id !== myPlayerId)?.name + "'s turn");
            }
            ctx.fillStyle = over ? '#ef4444' : (checkedKingIdx !== -1 ? '#f59e0b' : (isMyTurn ? '#10b981' : '#7986a8'));
            ctx.fillText(statusText, W / 2, 4);

            // Color indicator
            ctx.font = '12px Inter';
            ctx.fillStyle = '#7986a8';
            ctx.fillText(`You are ${myColor === 'w' ? 'White ♔' : 'Black ♚'}`, W / 2, H - 16);
        }

        function applyMove({ from, to }) {
            const p = board[from]; board[to] = p; board[from] = null;
            // Pawn promotion
            if (type(p) === 'P' && (Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7)) board[to] = color(p) + 'Q';
            turn = turn === 'w' ? 'b' : 'w';
            selected = null; validMoves = [];
            draw();

            // Check for checkmate or stalemate
            const nextTurn = turn;
            const hasLegalMove = board.some((_, i) => color(board[i]) === nextTurn && legalMoves(board, i, nextTurn).length > 0);
            if (!hasLegalMove && !over) {
                over = true;
                const isCheckmate = inCheck(board, nextTurn);
                if (isCheckmate) {
                    // The player who just moved wins
                    const winner = nextTurn === 'w' ? 'b' : 'w';
                    const wId = ids[['w', 'b'].indexOf(winner)];
                    const results = players.map(p => ({ playerId: p.id, score: p.id === wId ? 1 : 0 }));
                    draw(); // redraw to show final state
                    setTimeout(() => window.vennaEndGame(results), 1200);
                } else {
                    // Stalemate — draw
                    const results = players.map(p => ({ playerId: p.id, score: 0 }));
                    draw();
                    setTimeout(() => window.vennaEndGame(results), 1200);
                }
            }
        }

        function handleClick(e) {
            if (over || turn !== myColor) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX - OX;
            const my = (e.clientY - rect.top) * scaleY - OY;
            if (mx < 0 || my < 0 || mx > CELL * 8 || my > CELL * 8) return;

            const idx = clickToLogical(mx + OX, my + OY);
            if (idx < 0) return;

            if (selected !== null && validMoves.includes(idx)) {
                const action = { type: 'move', from: selected, to: idx };
                applyMove(action);
                socket.emit('game-action', { roomCode, action });
            } else if (board[idx] && color(board[idx]) === myColor) {
                selected = idx;
                validMoves = legalMoves(board, idx, myColor);
                draw();
            } else {
                selected = null; validMoves = []; draw();
            }
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'move') applyMove(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['chess'] = { init };
})();
