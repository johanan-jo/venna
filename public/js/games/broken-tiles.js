// Broken Tiles — Break floor tiles before opponents (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const COLS = 10, ROWS = 8;
        const CELL_W = (W - 80) / COLS, CELL_H = (H - 100) / ROWS;
        const OX = 40, OY = 60;

        // Tile states: 0=intact, 1=cracked, 2=broken, -1=claimed by player i
        let tiles = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        let claims = Array(ROWS).fill(null).map(() => Array(COLS).fill(-1)); // which player claimed
        let scores = Array(nP).fill(0);
        let over = false;

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = OX + c * CELL_W, y = OY + r * CELL_H;
                    const st = tiles[r][c], owner = claims[r][c];

                    if (st === 0) {
                        // Intact tile
                        ctx.fillStyle = '#374151'; ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                    } else if (st === 1) {
                        // Cracked
                        ctx.fillStyle = '#1f2937'; ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                        ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                        // Crack lines
                        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(x + CELL_W / 2, y + 4); ctx.lineTo(x + CELL_W * 0.3, y + CELL_H - 4); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(x + CELL_W / 2, y + 4); ctx.lineTo(x + CELL_W * 0.8, y + CELL_H * 0.6); ctx.stroke();
                    } else if (st === 2 && owner >= 0) {
                        // Broken / claimed
                        ctx.fillStyle = COLORS[owner] + '33'; ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                        ctx.fillStyle = COLORS[owner]; ctx.font = `${CELL_W * 0.5}px serif`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(['💥', '💧', '🌿', '💛'][owner], x + CELL_W / 2, y + CELL_H / 2);
                    } else {
                        // Broken, unclaimed (hole)
                        ctx.fillStyle = '#030712'; ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
                    }
                }
            }

            // Scores
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 52);
            players.slice(0, nP).forEach((p, i) => {
                ctx.fillStyle = COLORS[i]; ctx.font = 'bold 13px Inter';
                ctx.textAlign = i % 2 === 0 ? 'left' : 'right';
                const tx = i % 2 === 0 ? 10 : W - 10;
                ctx.textBaseline = 'top'; ctx.fillText(`${p.name}${i === myIdx ? ' ←' : ''}: ${scores[i]} tiles`, tx, 6 + Math.floor(i / 2) * 18);
            });
            ctx.fillStyle = '#7986a8'; ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText('Click once to crack, click again to break & claim!', W / 2, H - 4);
        }

        function handleClick(e) {
            if (over) return;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width) - OX;
            const my = (e.clientY - rect.top) * (canvas.height / rect.height) - OY;
            if (mx < 0 || my < 0) return;
            const c = Math.floor(mx / CELL_W), r = Math.floor(my / CELL_H);
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
            if (tiles[r][c] === 2) return; // already broken

            const newState = tiles[r][c] + 1;
            const newOwner = newState === 2 ? myIdx : -1;
            tiles[r][c] = newState;
            if (newState === 2) { claims[r][c] = myIdx; scores[myIdx]++; }
            socket.emit('game-action', { roomCode, action: { type: 'break', r, c, state: newState, owner: newOwner } });
            checkEnd();
            draw();
        }

        function checkEnd() {
            const allBroken = tiles.every(row => row.every(t => t === 2));
            if (allBroken && !over) {
                over = true;
                const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                setTimeout(() => window.vennaEndGame(results), 800);
            }
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'break') {
                tiles[action.r][action.c] = action.state;
                if (action.owner >= 0) { claims[action.r][action.c] = action.owner; scores[action.owner]++; }
                checkEnd(); draw();
            }
        });

        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['broken-tiles'] = { init };
})();
