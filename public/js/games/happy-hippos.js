// Happy Hippos — click your hippo to eat marbles
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const HIPPOS = [{ x: W * 0.15, y: H / 2 }, { x: W * 0.85, y: H / 2 }, { x: W / 2, y: H * 0.15 }, { x: W / 2, y: H * 0.85 }];
        const scores = {};
        players.forEach(p => scores[p.id] = 0);
        const GAME_DUR = 30;
        let timeLeft = GAME_DUR, over = false, animId, lastTime = 0;
        let marbles = [];
        let hippoMouths = Array(nP).fill(0); // 0=closed, >0 = open timer

        function spawn() {
            const ang = Math.random() * Math.PI * 2;
            marbles.push({ x: W / 2 + (Math.random() - 0.5) * 80, y: H / 2 + (Math.random() - 0.5) * 80, vx: Math.cos(ang) * 2.5, vy: Math.sin(ang) * 2.5, r: 7, color: `hsl(${Math.random() * 360},70%,60%)` });
        }

        function update(dt) {
            marbles.forEach(m => {
                m.x += m.vx * (dt / 16); m.y += m.vy * (dt / 16);
                if (m.x < m.r || m.x > W - m.r) m.vx *= -1; if (m.y < m.r || m.y > H - m.r) m.vy *= -1;
            });
            hippoMouths = hippoMouths.map(t => Math.max(0, t - dt));
            // Eat marbles near open hippos
            players.slice(0, nP).forEach((p, i) => {
                if (hippoMouths[i] <= 0) return;
                const h = HIPPOS[i];
                marbles.forEach(m => { if (Math.hypot(m.x - h.x, m.y - h.y) < 50) { m.eaten = true; scores[p.id] = (scores[p.id] || 0) + 1; } });
            });
            marbles = marbles.filter(m => !m.eaten);
            if (marbles.length < 6) spawn();
            timeLeft -= dt / 1000;
            if (timeLeft <= 0 && !over) endGame();
        }

        function chomp(i) {
            hippoMouths[i] = 300;
            const action = { type: 'chomp', playerId: ids[i], hippoIdx: i };
            socket.emit('game-action', { roomCode, action });
        }

        function handleClick(e) {
            if (over) return;
            const idx = ids.indexOf(myPlayerId);
            if (idx >= 0 && idx < nP) chomp(idx);
        }
        const kd = e => { if (e.code === 'Space') { e.preventDefault(); handleClick(null); } };

        socket.on('game-action', ({ action }) => {
            if (action.type === 'chomp') hippoMouths[action.hippoIdx] = 300;
            if (action.type === 'eat') { scores[action.playerId] = (scores[action.playerId] || 0) + action.count; }
        });

        function draw() {
            ctx.fillStyle = '#001a00'; ctx.fillRect(0, 0, W, H);
            // Central pool
            ctx.fillStyle = '#003a5a'; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#0057a0'; ctx.lineWidth = 3; ctx.stroke();
            // Marbles
            marbles.forEach(m => { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); });
            // Hippos
            players.slice(0, nP).forEach((p, i) => {
                const h = HIPPOS[i]; const open = hippoMouths[i] > 0;
                ctx.fillStyle = COLORS[i]; ctx.beginPath(); ctx.arc(h.x, h.y, 35, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(open ? '😮' : '🦛', h.x, h.y);
                ctx.font = '11px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, h.x, h.y + 40);
                if (ids[i] === myPlayerId) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 40, 0, Math.PI * 2); ctx.stroke(); }
            });
            ctx.font = 'bold 16px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
            ctx.fillText(`⏱ ${Math.ceil(Math.max(0, timeLeft))}s  •  Click/Space to snap!`, W / 2, 8);
        }

        function endGame() { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); cancelAnimationFrame(animId); window.vennaEndGame(results); }

        function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
        canvas.addEventListener('click', handleClick); document.addEventListener('keydown', kd);
        for (let i = 0; i < 8; i++) spawn();
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); document.removeEventListener('keydown', kd); socket.off('game-action'); };
    }

    G['happy-hippos'] = { init };
})();
