// Pull The Rope — keyboard mashing tug of war
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        // Team A vs Team B
        const teamA = ids.filter((_, i) => i % 2 === 0), teamB = ids.filter((_, i) => i % 2 === 1);
        const myTeam = teamA.includes(myPlayerId) ? 'A' : 'B';
        let ropePos = 0; // -100 to +100, positive = B wins
        let lastKey = ''; let alternating = false;
        let over = false, animId, lastTime = 0;
        let particles = [];
        const GAME_DUR = 15;
        let timeLeft = GAME_DUR;
        const PULL_FORCE = 2.5, DECAY = 0.92;
        let velocity = 0;
        let myPresses = 0, sharedPresses = {};
        players.forEach(p => sharedPresses[p.id] = 0);

        function draw() {
            ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, W, H);
            // Rope
            const midX = W / 2;
            const ropeY = H / 2, ropeLen = W - 80;
            const knot = midX + ropePos * 2.5;
            // Grass
            ctx.fillStyle = '#1a3a1a'; ctx.fillRect(0, H - 40, W * 0.5 - 20, 40);
            ctx.fillStyle = '#1a1a3a'; ctx.fillRect(W * 0.5 + 20, H - 40, W, 40);
            // Win zones
            ctx.fillStyle = 'rgba(239,68,68,0.1)'; ctx.fillRect(0, 0, W * 0.2, H);
            ctx.fillStyle = 'rgba(59,130,246,0.1)'; ctx.fillRect(W * 0.8, 0, W * 0.2, H);
            ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.fillText('A WINS', W * 0.1, H / 2);
            ctx.fillStyle = 'rgba(59,130,246,0.5)'; ctx.fillText('B WINS', W * 0.9, H / 2);
            // Rope
            ctx.strokeStyle = '#c4963c'; ctx.lineWidth = 10; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(W * 0.05, ropeY - 5); ctx.lineTo(knot, ropeY + Math.sin(ropePos / 10) * 8); ctx.lineTo(W * 0.95, ropeY - 5); ctx.stroke();
            // Knot
            ctx.fillStyle = Math.abs(ropePos) > 70 ? '#ef4444' : '#fff'; ctx.beginPath(); ctx.arc(knot, ropeY, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c4963c'; ctx.lineWidth = 3; ctx.stroke();
            ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎗️', knot, ropeY);
            // Players pulling
            players.slice(0, nP).forEach((p, i) => {
                const isA = i % 2 === 0; const presses = sharedPresses[p.id] || 0;
                const px = isA ? W * 0.22 - i * 30 : W * 0.78 + i * 30, py = ropeY;
                ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.save(); if (!isA) ctx.scale(-1, 1); ctx.fillText('🧑', isA ? px : -px, py); ctx.restore();
                ctx.font = '10px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.fillText(`${p.name}:${presses}`, px, py + 35);
            });
            // HUD
            ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
            ctx.fillText(`⏱ ${Math.ceil(timeLeft)}s`, W / 2, 10);
            ctx.font = '14px Inter'; ctx.fillStyle = '#7986a8';
            ctx.fillText(`Team A ◀ — mash SPACE/click to pull! — ▶ Team B`, W / 2, 40);
            // Particles
            particles.forEach(p => { ctx.font = '14px serif'; ctx.globalAlpha = p.alpha; ctx.textAlign = 'center'; ctx.fillText('💪', p.x, p.y); ctx.globalAlpha = 1; });
        }

        function myPull() {
            if (over) return;
            myPresses++;
            sharedPresses[myPlayerId] = (sharedPresses[myPlayerId] || 0) + 1;
            const dir = myTeam === 'A' ? -1 : 1;
            velocity += PULL_FORCE * dir;
            socket.emit('game-action', { roomCode, action: { type: 'pull', playerId: myPlayerId, dir } });
            particles.push({ x: myTeam === 'A' ? W * 0.25 : W * 0.75, y: H / 2 - 20, vy: -2, alpha: 1 });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'pull') { sharedPresses[action.playerId] = (sharedPresses[action.playerId] || 0) + 1; velocity += PULL_FORCE * action.dir; }
        });

        function gameLoop(ts) {
            if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts;
            if (!over) {
                velocity *= DECAY;
                ropePos += velocity * (dt / 16);
                ropePos = Math.max(-100, Math.min(100, ropePos));
                timeLeft -= dt / 1000;
                particles.forEach(p => { p.y += p.vy; p.alpha -= 0.03; }); particles = particles.filter(p => p.alpha > 0);
                if (Math.abs(ropePos) >= 100 || timeLeft <= 0) {
                    over = true;
                    const winner = ropePos <= -100 ? 'A' : ropePos >= 100 ? 'B' : (teamA.length > 0 && sharedPresses[teamA[0]] >= (sharedPresses[teamB[0]] || 0) ? 'A' : 'B');
                    const winTeam = winner === 'A' ? teamA : teamB;
                    const results = players.map(p => ({ playerId: p.id, score: winTeam.includes(p.id) ? 1 : 0 }));
                    setTimeout(() => window.vennaEndGame(results), 800);
                }
            }
            draw();
            if (!over) animId = requestAnimationFrame(gameLoop);
        }

        canvas.addEventListener('click', myPull);
        const kd = e => { if (e.code === 'Space') { e.preventDefault(); myPull(); } };
        document.addEventListener('keydown', kd);
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', myPull); document.removeEventListener('keydown', kd); socket.off('game-action'); };
    }

    G['pull-rope'] = { init };
})();
