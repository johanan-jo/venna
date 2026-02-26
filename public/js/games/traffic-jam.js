// Traffic Jam — Rush Hour sliding puzzle, race to solve first
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const SZ = 6, CELL = 70;

    // Predefined puzzle layouts [{cars:[{id,row,col,len,horiz,isRed}]}]
    const PUZZLE = [
        { id: 'red', row: 2, col: 0, len: 2, horiz: true, isRed: true, color: '#ef4444' },
        { id: 'A', row: 0, col: 2, len: 2, horiz: false, color: '#3b82f6' },
        { id: 'B', row: 0, col: 5, len: 2, horiz: false, color: '#10b981' },
        { id: 'C', row: 1, col: 1, len: 3, horiz: true, color: '#f59e0b' },
        { id: 'D', row: 3, col: 1, len: 2, horiz: false, color: '#ec4899' },
        { id: 'E', row: 3, col: 3, len: 3, horiz: true, color: '#8b5cf6' },
        { id: 'F', row: 4, col: 0, len: 2, horiz: true, color: '#14b8a6' },
        { id: 'G', row: 5, col: 2, len: 2, horiz: true, color: '#f97316' },
    ];

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const OX = (W - SZ * CELL) / 2, OY = (H - SZ * CELL) / 2 - 20;
        const ids = players.map(p => p.id);
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        let cars = PUZZLE.map(c => ({ ...c }));
        let selected = null, moves = 0, over = false, startTime = Date.now();
        let scores = {};
        players.forEach(p => scores[p.id] = 0);

        function buildGrid() {
            const g = Array(SZ).fill(null).map(() => Array(SZ).fill(null));
            cars.forEach(c => { for (let i = 0; i < c.len; i++) { const r = c.horiz ? c.row : c.row + i, col = c.horiz ? c.col + i : c.col; if (r >= 0 && r < SZ && col >= 0 && col < SZ) g[r][col] = c.id; } });
            return g;
        }

        function canMove(car, dir) {
            const g = buildGrid();
            const step = dir > 0 ? car.len : 0;
            if (car.horiz) { const c = car.col + step + (dir > 0 ? 0 : -1); if (c < 0 || c >= SZ || g[car.row][c]) return false; }
            else { const r = car.row + step + (dir > 0 ? 0 : -1); if (r < 0 || r >= SZ || g[r][car.col]) return false; }
            return true;
        }

        function moveCar(id, dir) {
            const car = cars.find(c => c.id === id); if (!car) return;
            if (car.horiz) car.col += dir; else car.row += dir;
            moves++;
            const action = { type: 'move', state: cars.map(c => ({ id: c.id, row: c.row, col: c.col })) };
            socket.emit('game-action', { roomCode, action });
            // Check win: red car at col 4-5
            const red = cars.find(c => c.isRed);
            if (red && red.col >= SZ - red.len && !over) { over = true; const t = ((Date.now() - startTime) / 1000).toFixed(1); scores[myPlayerId] = Math.max(0, 1000 - moves * 10); socket.emit('game-action', { roomCode, action: { type: 'solved', playerId: myPlayerId, moves, time: t } }); }
            draw();
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            // Board
            ctx.fillStyle = '#1a1a2e'; ctx.fillRect(OX - 4, OY - 4, SZ * CELL + 8, SZ * CELL + 8);
            for (let r = 0; r < SZ; r++) for (let c = 0; c < SZ; c++) {
                ctx.fillStyle = (r + c) % 2 === 0 ? '#16162a' : '#1e1e3a';
                ctx.fillRect(OX + c * CELL, OY + r * CELL, CELL, CELL);
                ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 0.5; ctx.strokeRect(OX + c * CELL, OY + r * CELL, CELL, CELL);
            }
            // Exit arrow
            ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.moveTo(OX + SZ * CELL, OY + 2 * CELL + CELL * 0.4); ctx.lineTo(OX + SZ * CELL + 24, OY + 2 * CELL + CELL / 2); ctx.lineTo(OX + SZ * CELL, OY + 2 * CELL + CELL * 0.6); ctx.fill();
            ctx.font = '11px Inter'; ctx.fillStyle = '#10b981'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('EXIT', OX + SZ * CELL + 6, OY + 2 * CELL + CELL / 2 + 16);
            // Cars
            cars.forEach(car => {
                const x = OX + car.col * CELL + 4, y = OY + car.row * CELL + 4;
                const cw = car.horiz ? CELL * car.len - 8 : CELL - 8, ch = car.horiz ? CELL - 8 : CELL * car.len - 8;
                ctx.fillStyle = car.isRed ? '#ef4444' : car.color || '#888';
                ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 8); ctx.fill();
                ctx.strokeStyle = selected === car.id ? '#fff' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = selected === car.id ? 3 : 1; ctx.stroke();
                ctx.font = 'bold 11px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(car.isRed ? '🚗' : car.id, x + cw / 2, y + ch / 2);
            });
            // HUD
            ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
            ctx.fillText('Traffic Jam — Move the 🚗 to the EXIT!', W / 2, 12);
            ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText(`Moves: ${moves}`, W / 2, 36);
            ctx.font = '11px Inter'; ctx.fillText('Click car to select, arrows to move', W / 2, OY + SZ * CELL + 12);
            players.forEach((p, i) => { if (scores[p.id]) { ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: SOLVED in ${moves}!`, 10, H - 30 + i * 16); } });
        }

        function handleClick(e) {
            if (over) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const c = Math.floor((mx - OX) / CELL), r = Math.floor((my - OY) / CELL);
            if (c < 0 || c >= SZ || r < 0 || r >= SZ) { selected = null; draw(); return; }
            const g = buildGrid();
            selected = g[r]?.[c] || null;
            draw();
        }

        const kd = e => {
            if (!selected || over) return;
            const car = cars.find(c => c.id === selected); if (!car) return;
            if (e.code === 'ArrowLeft' && car.horiz && canMove(car, -1)) moveCar(selected, -1);
            if (e.code === 'ArrowRight' && car.horiz && canMove(car, 1)) moveCar(selected, 1);
            if (e.code === 'ArrowUp' && !car.horiz && canMove(car, -1)) moveCar(selected, -1);
            if (e.code === 'ArrowDown' && !car.horiz && canMove(car, 1)) moveCar(selected, 1);
        };

        socket.on('game-action', ({ action }) => {
            if (action.type === 'move' && action.state) action.state.forEach(({ id, row, col }) => { const c = cars.find(c => c.id === id); if (c) { c.row = row; c.col = col; } }); draw();
            if (action.type === 'solved') { scores[action.playerId] = Math.max(0, 1000 - action.moves * 10); draw(); if (!over && Object.keys(scores).filter(k => scores[k] > 0).length >= players.length) endGame(); }
        });

        function endGame() {
            over = true;
            const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
            window.vennaEndGame(results);
        }

        canvas.addEventListener('click', handleClick);
        document.addEventListener('keydown', kd);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); document.removeEventListener('keydown', kd); socket.off('game-action'); };
    }

    G['traffic-jam'] = { init };
})();
