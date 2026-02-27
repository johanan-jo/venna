// Ludo — 2-4 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const SZ = Math.min(W, H) - 40;
        const OX = (W - SZ) / 2, OY = (H - SZ) / 2;
        const CELL = SZ / 15;
        const ids = players.map(p => p.id);
        const nPlayers = Math.min(players.length, 4);

        // -1 = in base, 0-51 = on board path (player-relative), 52 = finished
        let tokens = Array(nPlayers).fill(null).map(() => [-1, -1, -1, -1]);
        let turnIdx = 0;
        let dice = null;
        let diceRolled = false;
        let over = false;
        let msg = '';

        // Home slot positions for each player's 4 tokens on the 15x15 grid
        const HOME_POS = [
            [{ r: 2, c: 2 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 4, c: 4 }],
            [{ r: 2, c: 10 }, { r: 2, c: 12 }, { r: 4, c: 10 }, { r: 4, c: 12 }],
            [{ r: 10, c: 10 }, { r: 10, c: 12 }, { r: 12, c: 10 }, { r: 12, c: 12 }],
            [{ r: 10, c: 2 }, { r: 10, c: 4 }, { r: 12, c: 2 }, { r: 12, c: 4 }],
        ];

        // 52-step outer track [row, col] — standard clockwise Ludo path on a 15x15 board.
        // Each quadrant has 13 cells. Player 0 (Red) enters at step 0.
        const LUDO_PATH = [
            // Red quadrant: down the left lane then across the bottom
            [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [14, 3], [14, 4], [14, 5], [14, 6],
            // Blue quadrant: up the right side
            [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
            // Green quadrant: across the top going left
            [7, 13], [6, 13], [5, 13], [4, 13], [3, 13], [2, 13], [1, 13], [0, 13], [0, 12], [0, 11], [0, 10], [0, 9], [0, 8],
            // Yellow quadrant: down the left and back around
            [0, 7], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [7, 1],
        ];

        // Each player enters the path at a different offset (13 steps per quadrant)
        const PLAYER_OFFSET = [0, 13, 26, 39];

        function getBoardCell(playerIdx, step) {
            const absStep = (PLAYER_OFFSET[playerIdx] + step) % 52;
            return LUDO_PATH[absStep]; // [row, col]
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            // Draw board squares
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    const x = OX + c * CELL, y = OY + r * CELL;
                    let col = '#e8e8e8';
                    if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) col = '#1a1a2e';
                    if (r >= 6 && r <= 8 && c === 0) col = '#fecaca';
                    if (r >= 6 && r <= 8 && c === 14) col = '#bfdbfe';
                    if (c >= 6 && c <= 8 && r === 0) col = '#d1fae5';
                    if (c >= 6 && c <= 8 && r === 14) col = '#fef3c7';
                    // Home stretch corridors
                    if (r === 7 && c >= 1 && c <= 5) col = '#fecaca';
                    if (r === 7 && c >= 9 && c <= 13) col = '#bfdbfe';
                    if (c === 7 && r >= 1 && r <= 5) col = '#d1fae5';
                    if (c === 7 && r >= 9 && r <= 13) col = '#fef3c7';
                    ctx.fillStyle = col; ctx.fillRect(x, y, CELL, CELL);
                    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, CELL, CELL);
                }
            }

            // Center home area
            ctx.fillStyle = '#1a1a2e'; ctx.fillRect(OX + 6 * CELL, OY + 6 * CELL, 3 * CELL, 3 * CELL);
            ctx.font = `${CELL * 1.5}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏠', OX + 7.5 * CELL, OY + 7.5 * CELL);

            // Draw home areas and base tokens
            HOME_POS.slice(0, nPlayers).forEach((homes, pi) => {
                const baseR = pi < 2 ? 0 : 9, baseC = (pi % 2 === 0) ? 0 : 9;
                ctx.fillStyle = COLORS[pi] + '44';
                ctx.fillRect(OX + baseC * CELL, OY + baseR * CELL, 6 * CELL, 6 * CELL);
                homes.forEach((pos, ti) => {
                    if (tokens[pi][ti] !== -1) return; // token not in base
                    const bx = OX + (pos.c + 0.5) * CELL, by = OY + (pos.r + 0.5) * CELL;
                    ctx.beginPath();
                    ctx.arc(bx, by, CELL * 0.42, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[pi]; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${CELL * 0.35}px Inter`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(ti + 1, bx, by);
                });
            });

            // Draw tokens currently on the board path
            const offsets = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
            for (let pi = 0; pi < nPlayers; pi++) {
                for (let ti = 0; ti < 4; ti++) {
                    const step = tokens[pi][ti];
                    if (step < 0 || step >= 52) continue;
                    const [gr, gc] = getBoardCell(pi, step);
                    const [or, oc] = offsets[ti];
                    const bx = OX + (gc + 0.5 + oc * 0.55) * CELL;
                    const by = OY + (gr + 0.5 + or * 0.55) * CELL;
                    ctx.beginPath();
                    ctx.arc(bx, by, CELL * 0.38, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[pi]; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${CELL * 0.32}px Inter`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(ti + 1, bx, by);
                }
            }

            // Status
            ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            ctx.fillStyle = COLORS[turnIdx % 4];
            ctx.fillText(msg || (isMyTurn ? 'Your turn — Roll dice' : "Opponent's turn"), W / 2, 8);

            // Roll button or dice face
            if (!diceRolled && isMyTurn && !over) {
                ctx.fillStyle = '#7c3aed';
                ctx.beginPath(); ctx.roundRect(W / 2 - 50, H - 54, 100, 46, 8); ctx.fill();
                ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#fff';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('🎲 Roll', W / 2, H - 31);
            } else if (dice !== null) {
                ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 24, H - 52, 48, 48);
                ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 24, H - 52, 48, 48);
                ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#111'; ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice], W / 2, H - 28);
            }
        }

        function applyRoll({ val }) {
            dice = val; diceRolled = true;
            msg = `Rolled ${val}!`;
            const pi = turnIdx % nPlayers;
            let moved = false;

            for (let ti = 0; ti < 4; ti++) {
                const t = tokens[pi][ti];
                if (t === -1 && val === 6) { tokens[pi][ti] = 0; moved = true; break; }
                if (t >= 0 && t + val <= 51) {
                    tokens[pi][ti] = t + val; moved = true;
                    if (tokens[pi][ti] === 51) msg = `${players[pi].name} finished a token! 🎉`;
                    break;
                }
            }

            const getsAnotherTurn = val === 6;
            setTimeout(() => {
                if (!getsAnotherTurn) turnIdx++;
                diceRolled = false; dice = null; msg = ''; draw();
            }, 900);

            if (tokens[pi].every(t => t === 51) && !over) {
                over = true;
                const results = players.map((p, i) => ({ playerId: p.id, score: i === pi ? 4 : 0 }));
                setTimeout(() => window.vennaEndGame(results), 1200);
            }
            draw();
        }

        function rollDice() {
            if (diceRolled || ids[turnIdx % ids.length] !== myPlayerId || over) return;
            const val = Math.floor(Math.random() * 6) + 1;
            const action = { type: 'roll', val };
            applyRoll(action);
            socket.emit('game-action', { roomCode, action });
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            if (!diceRolled && my > H - 60 && my < H && mx > W / 2 - 55 && mx < W / 2 + 55) rollDice();
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'roll') applyRoll(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['ludo'] = { init };
})();
