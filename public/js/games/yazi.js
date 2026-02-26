// Yazi (Yahtzee-style dice game)
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CATS = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', '3 of a Kind', '4 of a Kind', 'Full House', 'Sm Straight', 'Lg Straight', 'YAZI', 'Chance'];

    function calcScore(cat, dice) {
        const d = dice.slice().sort();
        const counts = {};
        d.forEach(v => counts[v] = (counts[v] || 0) + 1);
        const sum = d.reduce((a, b) => a + b, 0);
        const vals = Object.values(counts).sort((a, b) => b - a);
        const num = parseInt(cat) + 1;
        if (cat === '0') return d.filter(v => v === 1).reduce((a, b) => a + b, 0);
        if (cat === '1') return d.filter(v => v === 2).reduce((a, b) => a + b, 0);
        if (cat === '2') return d.filter(v => v === 3).reduce((a, b) => a + b, 0);
        if (cat === '3') return d.filter(v => v === 4).reduce((a, b) => a + b, 0);
        if (cat === '4') return d.filter(v => v === 5).reduce((a, b) => a + b, 0);
        if (cat === '5') return d.filter(v => v === 6).reduce((a, b) => a + b, 0);
        if (cat === '6') return vals[0] >= 3 ? sum : 0;
        if (cat === '7') return vals[0] >= 4 ? sum : 0;
        if (cat === '8') return (vals[0] === 3 && vals[1] === 2) || (vals[0] === 5) ? 25 : 0;
        if (cat === '9') { const u = Object.keys(counts).map(Number).sort((a, b) => a - b); for (let i = 0; i <= u.length - 4; i++) if (u[i + 1] - u[i] === 1 && u[i + 2] - u[i + 1] === 1 && u[i + 3] - u[i + 2] === 1) return 30; return 0; }
        if (cat === '10') { const u = Object.keys(counts).map(Number).sort((a, b) => a - b); for (let i = 0; i <= u.length - 5; i++) if (u[i + 4] - u[i] === 4 && u.length >= 5) return 40; if (u.length === 5 && u[4] - u[0] === 4) return 40; return 0; }
        if (cat === '11') return vals[0] === 5 ? 50 : 0;
        if (cat === '12') return sum;
        return 0;
    }

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];

        let dice = [1, 1, 1, 1, 1];
        let held = [false, false, false, false, false];
        let rollsLeft = 3;
        let turnIdx = 0;
        let scoreCards = Array(nP).fill(null).map(() => Array(13).fill(null));
        let over = false;

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            const pi = ids.indexOf(myPlayerId);
            // Dice
            dice.forEach((d, i) => {
                const x = 50 + i * 80, y = 50, sz = 60;
                ctx.fillStyle = held[i] ? '#1e1b4b' : '#e8eaf6';
                ctx.strokeStyle = held[i] ? '#7c3aed' : '#555'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 10); ctx.fill(); ctx.stroke();
                ctx.font = `bold ${sz * 0.65}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = held[i] ? '#a78bfa' : '#111';
                ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d], x + sz / 2, y + sz / 2);
            });
            // Roll button
            if (isMyTurn && !over && rollsLeft > 0) {
                ctx.fillStyle = rollsLeft > 0 ? '#7c3aed' : '#444'; ctx.beginPath(); ctx.roundRect(50, 130, 200, 44, 8); ctx.fill();
                ctx.font = 'bold 15px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`🎲 Roll (${rollsLeft} left)`, 150, 152);
                if (isMyTurn) { ctx.font = '12px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'left'; ctx.fillText('Hold dice by clicking them', 50, 185); }
            }
            // Score categories
            ctx.font = '12px Inter'; ctx.textBaseline = 'top';
            CATS.forEach((cat, ci) => {
                const x = 50, y = 200 + ci * 26;
                ctx.fillStyle = '#1e1e3a'; ctx.fillRect(x, y, W - 100, 22);
                ctx.fillStyle = '#7986a8'; ctx.textAlign = 'left'; ctx.fillText(cat, x + 6, y + 5);
                // show own score
                players.slice(0, nP).forEach((p, pi2) => {
                    const sc = scoreCards[pi2][ci];
                    const px = x + 100 + pi2 * 80;
                    ctx.fillStyle = sc !== null ? COLORS[pi2] : '#2a2a4a'; ctx.fillRect(px, y, 70, 22);
                    ctx.fillStyle = sc !== null ? '#fff' : '#555'; ctx.textAlign = 'center';
                    if (sc !== null) ctx.fillText(sc, px + 35, y + 5);
                    else if (pi2 === pi && isMyTurn && rollsLeft < 3) {
                        const pot = calcScore(String(ci), dice);
                        ctx.fillStyle = '#4a4a7a'; ctx.fillText(pot > 0 ? pot : '✕', px + 35, y + 5);
                    }
                });
            });
            // Status
            ctx.font = '13px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
            ctx.fillText(isMyTurn ? 'Your turn' : 'Opponent\'s turn', W / 2, H - 5);
            // Player scores total
            players.slice(0, nP).forEach((p, pi2) => {
                const tot = scoreCards[pi2].reduce((a, b) => a + (b || 0), 0);
                ctx.textAlign = 'center'; ctx.fillStyle = COLORS[pi2];
                ctx.fillText(`${p.name}: ${tot}`, 100 + pi2 * 100, H - 5);
            });
        }

        function rollDice() {
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            if (!isMyTurn || rollsLeft <= 0 || over) return;
            dice = dice.map((d, i) => held[i] ? d : Math.ceil(Math.random() * 6));
            rollsLeft--;
            held = held.map(h => false);
            const action = { type: 'roll-state', dice: [...dice], rollsLeft, pi: turnIdx % nP };
            socket.emit('game-action', { roomCode, action });
            draw();
        }

        function selectCat(ci) {
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            const pi = turnIdx % nP;
            if (!isMyTurn || rollsLeft === 3 || scoreCards[pi][ci] !== null || over) return;
            const sc = calcScore(String(ci), dice);
            const action = { type: 'score', pi, ci, sc, dice: [...dice] };
            applyScore(action);
            socket.emit('game-action', { roomCode, action });
        }

        function applyScore({ pi, ci, sc }) {
            scoreCards[pi][ci] = sc;
            rollsLeft = 3; held.fill(false);
            turnIdx++;
            if (scoreCards.every(sc2 => sc2.every(v => v !== null)) && !over) {
                over = true;
                const totals = players.slice(0, nP).map((p, i) => ({ playerId: p.id, score: scoreCards[i].reduce((a, b) => a + (b || 0), 0) }));
                setTimeout(() => window.vennaEndGame(totals), 800);
            }
            draw();
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            // Dice hold
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            if (my >= 50 && my <= 110 && isMyTurn && rollsLeft < 3) {
                dice.forEach((_, i) => { if (mx >= 50 + i * 80 && mx <= 50 + i * 80 + 60) { held[i] = !held[i]; draw(); } });
            }
            // Roll button
            if (my > 130 && my < 174 && mx > 50 && mx < 250 && isMyTurn && rollsLeft > 0) rollDice();
            // Category select
            const pi = ids.indexOf(myPlayerId);
            CATS.forEach((_, ci) => {
                const y = 200 + ci * 26;
                if (my > y && my < y + 22 && mx >= 100 + pi * 80 && mx <= 170 + pi * 80) selectCat(ci);
            });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'roll-state') { dice = [...action.dice]; rollsLeft = action.rollsLeft; draw(); }
            else if (action.type === 'score') applyScore(action);
        });

        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['yazi'] = { init };
})();
