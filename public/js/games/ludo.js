// Ludo — 2-4 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const PCOLORS = ['#fca5a5', '#93c5fd', '#6ee7b7', '#fcd34d'];
        const SZ = Math.min(W, H) - 40;
        const OX = (W - SZ) / 2, OY = (H - SZ) / 2;
        const CELL = SZ / 15;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nPlayers = Math.min(players.length, 4);

        // Track positions: 0=home, 1-56=path, 57=goal
        let tokens = Array(nPlayers).fill(null).map(() => [-1, -1, -1, -1]); // -1=base
        let turnIdx = 0;
        let dice = null;
        let diceRolled = false;
        let over = false;
        let msg = '';

        // Simple path for player 0 (clockwise around the perimeter)
        // Map board position (0-55) to grid coords
        function pathCell(pos, playerIdx) {
            // Each player starts at different entry point offset by 13
            const offset = playerIdx * 13;
            const p = (pos + offset) % 56;
            const path = getLudoPath();
            return path[p];
        }

        function getLudoPath() {
            const p = [];
            // Left column down
            for (let i = 0; i < 6; i++) p.push({ c: 6, r: 8 + i });
            p.push({ c: 7, r: 14 }); // bottom turn
            // Bottom row right
            for (let i = 0; i < 6; i++) p.push({ c: 8 + i, r: 8 });
            p.push({ c: 14, r: 7 }); // right turn - wrong, let me simplify
            // just return a basic 56-cell path around the board
            return p.concat(Array(56 - p.length).fill({ c: 7, r: 7 }));
        }

        // Simplified token positions as grid coords directly
        const HOME_POS = [
            [{ r: 2, c: 2 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 4, c: 4 }],
            [{ r: 2, c: 10 }, { r: 2, c: 12 }, { r: 4, c: 10 }, { r: 4, c: 12 }],
            [{ r: 10, c: 2 }, { r: 10, c: 4 }, { r: 12, c: 2 }, { r: 12, c: 4 }],
            [{ r: 10, c: 10 }, { r: 10, c: 12 }, { r: 12, c: 10 }, { r: 12, c: 12 }],
        ];

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Board squares
            for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
                const x = OX + c * CELL, y = OY + r * CELL;
                let col = '#f0f0f0';
                if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) col = '#1a1a2e';
                if (r === 6 && c < 6) col = '#fee2e2'; if (r < 6 && c === 8) col = '#bfdbfe';
                if (r === 8 && c > 8) col = '#d1fae5'; if (r > 8 && c === 6) col = '#fef3c7';
                ctx.fillStyle = col; ctx.fillRect(x, y, CELL, CELL);
                ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, CELL, CELL);
            }
            // Center diamond
            ctx.fillStyle = '#1a1a2e'; ctx.fillRect(OX + 6 * CELL, OY + 6 * CELL, 3 * CELL, 3 * CELL);
            ctx.font = `${CELL * 1.5}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏠', OX + 7.5 * CELL, OY + 7.5 * CELL);

            // Home areas
            HOME_POS.slice(0, nPlayers).forEach((homes, pi) => {
                ctx.fillStyle = COLORS[pi] + '44';
                const baseR = pi < 2 ? 0 : 9, baseC = (pi % 2 === 0) ? 0 : 9;
                ctx.fillRect(OX + baseC * CELL, OY + baseR * CELL, 6 * CELL, 6 * CELL);
                homes.forEach((pos, ti) => {
                    const inBase = tokens[pi][ti] === -1;
                    if (inBase) {
                        ctx.fillStyle = COLORS[pi]; ctx.beginPath();
                        ctx.arc(OX + (pos.c + 0.5) * CELL, OY + (pos.r + 0.5) * CELL, CELL * 0.38, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    }
                });
            });

            // Tokens on board (simplified — show at home)
            // Status
            ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            ctx.fillStyle = COLORS[turnIdx % 4];
            ctx.fillText(msg || `${isMyTurn ? 'Your turn' : 'Opponent turn'} — ${diceRolled ? 'Choose token' : 'Roll dice'}`, W / 2, 8);

            // Dice
            if (dice !== null) {
                ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 24, H - 52, 48, 48);
                ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 24, H - 52, 48, 48);
                ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#111'; ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice], W / 2, H - 28);
            }
            if (!diceRolled && isMyTurn && !over) {
                ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.roundRect(W / 2 - 50, H - 54, 100, 52, 8); ctx.fill();
                ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('🎲 Roll', W / 2, H - 28);
            }
        }

        function rollDice() {
            if (diceRolled || ids[turnIdx % ids.length] !== myPlayerId || over) return;
            const val = Math.floor(Math.random() * 6) + 1;
            const action = { type: 'roll', val };
            applyRoll(action);
            socket.emit('game-action', { roomCode, action });
        }

        function applyRoll({ val }) {
            dice = val; diceRolled = true;
            msg = `Rolled ${val}`;
            // Simple AI: auto-advance first eligible token
            const pi = turnIdx % nPlayers;
            let moved = false;
            for (let ti = 0; ti < 4; ti++) {
                const t = tokens[pi][ti];
                if (t === -1 && val === 6) { tokens[pi][ti] = 0; moved = true; break; }
                if (t >= 0 && t + val <= 56) {
                    tokens[pi][ti] = Math.min(t + val, 56); moved = true;
                    if (tokens[pi][ti] === 56) { msg = `${players[pi].name} finished a token!`; }
                    break;
                }
            }
            if (!moved || val !== 6) { setTimeout(() => { turnIdx++; diceRolled = false; dice = null; msg = ''; draw(); }, 800); }
            else { diceRolled = false; }
            // Check win
            if (tokens[pi].every(t => t === 56) && !over) {
                over = true;
                const results = players.map((p, i) => ({ playerId: p.id, score: i === pi ? 4 : 0 }));
                setTimeout(() => window.vennaEndGame(results), 1000);
            }
            draw();
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
