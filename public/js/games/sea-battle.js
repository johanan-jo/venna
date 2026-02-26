// Sea Battle (Battleship) — 2 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const SHIPS = [5, 4, 3, 3, 2];
    const SZ = 10;

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const cell = Math.min(W / 2 - 20, H - 80) / (SZ + 1);
        const P1X = 10, P2X = W / 2 + 10, GY = 60;

        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);

        let phase = 'placing'; // placing | waiting | battle | over
        let myBoard = Array(SZ).fill(null).map(() => Array(SZ).fill(0)); // 0=empty,1=ship,2=hit,3=miss
        let oppBoard = Array(SZ).fill(null).map(() => Array(SZ).fill(0));
        let myShots = Array(SZ * SZ).fill(false);
        let placing = { ship: 0, horizontal: true, pos: null };
        let myTurn = myIdx === 0;
        let over = false;

        function canPlace(board, row, col, len, horiz) {
            for (let i = 0; i < len; i++) {
                const r = horiz ? row : row + i, c = horiz ? col + i : col;
                if (r < 0 || r >= SZ || c < 0 || c >= SZ || board[r][c]) return false;
            }
            return true;
        }

        function doPlace(board, row, col, len, horiz) {
            for (let i = 0; i < len; i++) { const r = horiz ? row : row + i, c = horiz ? col + i : col; board[r][c] = 1; }
        }

        function sunk(board) { return board.every(r => r.every(c => c !== 1)); }

        function draw() {
            ctx.fillStyle = '#080b14'; ctx.fillRect(0, 0, W, H);
            ctx.font = '13px Inter'; ctx.textAlign = 'center';

            // Draw both grids
            drawGrid(myBoard, P1X, GY, true, 'MY FLEET');
            drawGrid(oppBoard, P2X, GY, false, 'ENEMY FLEET');

            // UI messages
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.font = '14px Inter';
            if (phase === 'placing') {
                const ship = SHIPS[placing.ship];
                ctx.fillStyle = '#10b981';
                ctx.fillText(`Place ship (${ship} cells) — R to rotate | ${SHIPS.length - placing.ship} left`, W / 2, 10);
            } else if (phase === 'waiting') {
                ctx.fillStyle = '#f59e0b'; ctx.fillText('Waiting for opponent to place ships…', W / 2, 10);
            } else if (phase === 'battle') {
                ctx.fillStyle = myTurn ? '#10b981' : '#ef4444';
                ctx.fillText(myTurn ? 'YOUR TURN — click enemy grid to fire!' : 'Enemy is aiming…', W / 2, 10);
            }
        }

        function drawGrid(board, ox, oy, showShips, label) {
            ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#7986a8';
            ctx.fillText(label, ox + cell * (SZ + 1) / 2, oy - 18);
            for (let r = 0; r <= SZ; r++) for (let c = 0; c <= SZ; c++) {
                const x = ox + (c) * cell, y = oy + (r) * cell;
                if (r > 0 && c > 0) {
                    const val = board[r - 1][c - 1];
                    ctx.fillStyle = val === 1 && showShips ? '#3b82f6' : val === 2 ? '#ef4444' : val === 3 ? '#6366f1' : '#141428';
                    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                    ctx.strokeStyle = '#1e1e3a'; ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
                    if (val === 2) { ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', x + cell / 2, y + cell / 2); }
                    if (val === 3) { ctx.fillStyle = '#818cf8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('·', x + cell / 2, y + cell / 2 + 1); }
                } else if (r === 0 && c > 0) {
                    ctx.fillStyle = '#7986a8'; ctx.font = '10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(String.fromCharCode(64 + c), x + cell / 2, y + cell / 2);
                } else if (c === 0 && r > 0) {
                    ctx.fillStyle = '#7986a8'; ctx.font = '10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(r, x + cell / 2, y + cell / 2);
                }
            }
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;

            if (phase === 'placing') {
                const c = Math.floor((mx - P1X) / cell) - 0, r = Math.floor((my - GY) / cell) - 0;
                if (r >= 1 && r <= SZ && c >= 1 && c <= SZ) {
                    const row = r - 1, col = c - 1, ship = SHIPS[placing.ship];
                    if (canPlace(myBoard, row, col, ship, placing.horizontal)) {
                        doPlace(myBoard, row, col, ship, placing.horizontal);
                        placing.ship++;
                        if (placing.ship >= SHIPS.length) {
                            phase = 'waiting';
                            socket.emit('game-action', { roomCode, action: { type: 'ready', board: myBoard } });
                        }
                        draw();
                    }
                }
            } else if (phase === 'battle' && myTurn) {
                // Click right grid
                const c = Math.floor((mx - P2X) / cell), r = Math.floor((my - GY) / cell);
                if (r >= 1 && r <= SZ && c >= 1 && c <= SZ) {
                    const row = r - 1, col = c - 1, idx = row * SZ + col;
                    if (!myShots[idx]) {
                        myShots[idx] = true;
                        socket.emit('game-action', { roomCode, action: { type: 'fire', row, col } });
                        myTurn = false;
                        draw();
                    }
                }
            }
        }

        function handleKey(e) {
            if (e.key === 'r' || e.key === 'R') { placing.horizontal = !placing.horizontal; draw(); }
        }

        let opponentReady = false, iReady = false;

        socket.on('game-action', ({ playerId, action }) => {
            if (action.type === 'ready') {
                opponentReady = true;
                if (iReady || phase === 'battle') startBattle();
            }
            if (action.type === 'fire') {
                const { row, col } = action;
                const hit = myBoard[row][col] === 1;
                myBoard[row][col] = hit ? 2 : 3;
                const result = { row, col, hit, sunk: sunk(myBoard) };
                socket.emit('game-action', { roomCode, action: { type: 'fire-result', ...result } });
                myTurn = true;
                draw();
                if (result.sunk && !over) endGame(false);
            }
            if (action.type === 'fire-result') {
                const { row, col, hit, sunk: s } = action;
                oppBoard[row][col] = hit ? 2 : 3;
                draw();
                if (s && !over) endGame(true);
            }
        });

        function startBattle() {
            phase = 'battle';
            iReady = true;
            draw();
        }

        function endGame(iWon) {
            over = true; phase = 'over';
            const results = players.map(p => ({ playerId: p.id, score: p.id === myPlayerId ? (iWon ? 1 : 0) : (iWon ? 0 : 1) }));
            setTimeout(() => window.vennaEndGame(results), 1000);
        }

        // My ready when all ships placed
        setTimeout(() => { iReady = (phase === 'waiting'); if (iReady && opponentReady) startBattle(); }, 100);

        canvas.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKey);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); document.removeEventListener('keydown', handleKey); socket.off('game-action'); };
    }

    G['sea-battle'] = { init };
})();
