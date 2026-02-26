// Snakes & Ladders — covers "Snakes" and "Snake and Ladders"
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const SNAKES = { 98: 78, 95: 75, 93: 73, 87: 24, 64: 60, 54: 34, 17: 7 };
    const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
    const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const PAD = 40, SQ = Math.floor((Math.min(W, H) - PAD * 2) / 10);
        const OX = (W - SQ * 10) / 2, OY = (H - SQ * 10) / 2;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        let positions = Array(nP).fill(0);
        let turnIdx = 0, dice = null, diceRolled = false, over = false, msg = '';
        let animPos = [...positions], animT = null;

        function cellXY(sq) {
            const row = Math.floor((sq - 1) / 10), col = (sq - 1) % 10;
            const r = 9 - row;
            const c = row % 2 === 0 ? col : 9 - col;
            return { x: OX + c * SQ + SQ / 2, y: OY + r * SQ + SQ / 2 };
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Grid
            for (let sq = 1; sq <= 100; sq++) {
                const { x, y } = cellXY(sq);
                ctx.fillStyle = (Math.floor((sq - 1) / 10) % 2 === 0 ? ((sq - 1) % 10 % 2 === 0) : ((sq - 1) % 10 % 2 !== 0)) ? '#1e1b4b' : '#14143a';
                ctx.fillRect(x - SQ / 2, y - SQ / 2, SQ, SQ);
                ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 0.5; ctx.strokeRect(x - SQ / 2, y - SQ / 2, SQ, SQ);
                ctx.font = `${SQ * 0.25}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillStyle = '#4a4a6a'; ctx.fillText(sq, x, y + SQ / 2 - 1);
                if (SNAKES[sq]) { ctx.font = `${SQ * 0.4}px serif`; ctx.textBaseline = 'middle'; ctx.fillText('🐍', x, y); }
                else if (LADDERS[sq]) { ctx.font = `${SQ * 0.4}px serif`; ctx.textBaseline = 'middle'; ctx.fillText('🪜', x, y); }
            }
            // Snakes (lines)
            Object.entries(SNAKES).forEach(([from, to]) => {
                const f = cellXY(+from), t = cellXY(+to);
                ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke();
                ctx.setLineDash([]);
            });
            Object.entries(LADDERS).forEach(([from, to]) => {
                const f = cellXY(+from), t = cellXY(+to);
                ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke();
                ctx.setLineDash([]);
            });
            // Tokens
            positions.forEach((pos, pi) => {
                if (pi >= nP) return;
                const sq = pos === 0 ? 0 : pos;
                const { x, y } = sq === 0 ? { x: OX - 15, y: OY + SQ * (9 - pi) + SQ / 2 } : cellXY(sq);
                ctx.fillStyle = COLORS[pi]; ctx.beginPath(); ctx.arc(x + (pi % 2) * 8, y, SQ * 0.22, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            });
            // Status
            ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            ctx.fillStyle = COLORS[turnIdx % 4];
            ctx.fillText(msg || (isMyTurn ? 'Your turn — Roll!' : 'Waiting...'), W / 2, 6);
            if (!diceRolled && isMyTurn && !over) {
                ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.roundRect(W / 2 - 50, H - 50, 100, 42, 8); ctx.fill();
                ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('🎲 Roll', W / 2, H - 29);
            }
            if (dice !== null) {
                ctx.font = '24px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
                ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice], W - 10, H - 10);
            }
        }

        function applyRoll({ val, pi }) {
            dice = val;
            let newPos = positions[pi] + val;
            if (newPos > 100) { /* skip */ }
            else {
                if (SNAKES[newPos]) { msg = `🐍 Snake! ${players[pi].name} slips to ${SNAKES[newPos]}`; newPos = SNAKES[newPos]; }
                else if (LADDERS[newPos]) { msg = `🪜 Ladder! ${players[pi].name} climbs to ${LADDERS[newPos]}`; newPos = LADDERS[newPos]; }
                else msg = '';
                positions[pi] = newPos;
            }
            if (positions[pi] >= 100 && !over) { over = true; const results = players.map((p, i) => ({ playerId: p.id, score: i === pi ? 1 : 0 })); setTimeout(() => window.vennaEndGame(results), 800); }
            turnIdx++; diceRolled = false;
            draw();
            setTimeout(() => { msg = ''; draw(); }, 1200);
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const my = e.clientY - rect.top, mx = e.clientX - rect.left;
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            if (!diceRolled && isMyTurn && !over && my > H - 55 && mx > W / 2 - 55 && mx < W / 2 + 55) {
                const val = Math.floor(Math.random() * 6) + 1;
                const pi = turnIdx % nP;
                diceRolled = true;
                const action = { type: 'roll', val, pi };
                applyRoll(action);
                socket.emit('game-action', { roomCode, action });
            }
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'roll') applyRoll(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['snakes'] = { init };
    G['snake-ladders'] = { init };
})();
