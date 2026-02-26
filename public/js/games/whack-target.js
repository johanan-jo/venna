// Whack Target — handles Whack A Mole, Hammer Hit, Light Fingers
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CONFIGS = {
        'whack-mole': { icon: '🐭', bg: '#0d2a0d', spawnRate: 1000, label: 'Whack the Moles!', hit: '💥', miss: '❌' },
        'hammer-hit': { icon: '🎯', bg: '#0d0d2a', spawnRate: 900, label: 'Hit the Targets!', hit: '💥', miss: '❌' },
        'light-fingers': { icon: '💡', bg: '#2a1a0d', spawnRate: 750, label: 'Tap the Lights!', hit: '✨', miss: '❌' },
    };

    function createGame(cfg) {
        return function init({ canvas, socket, roomCode, myPlayerId, players, isHost, gameSlug }) {
            const config = CONFIGS[gameSlug] || CONFIGS['whack-mole'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const GAME_DUR = 30;
            const ids = players.map(p => p.id);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            const scores = {};
            players.forEach(p => scores[p.id] = 0);
            let targets = [];
            let particles = [];
            let timeLeft = GAME_DUR;
            let over = false;
            let animId;
            let lastTime = 0;
            let spawnTimer = 0;

            function spawn() {
                const margin = 60;
                targets.push({
                    id: Math.random().toString(36).slice(2),
                    x: margin + Math.random() * (W - margin * 2),
                    y: 100 + Math.random() * (H - 200),
                    r: 35, life: 2500,
                    scale: 0, growing: true,
                });
            }

            function update(dt) {
                spawnTimer += dt;
                if (spawnTimer > config.spawnRate) { spawnTimer = 0; spawn(); }
                targets.forEach(t => { t.life -= dt; t.scale = t.growing ? Math.min(1, t.scale + dt / 200) : Math.max(0, t.scale - dt / 200); if (t.life < 500) t.growing = false; });
                targets = targets.filter(t => t.life > 0 && t.scale > 0);
                particles = particles.filter(p => p.life > 0);
                particles.forEach(p => { p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += 0.3; p.life -= dt; p.alpha = p.life / 500; });
            }

            function draw() {
                ctx.fillStyle = config.bg; ctx.fillRect(0, 0, W, H);
                // HUD
                ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
                ctx.fillText(`⏱ ${Math.ceil(timeLeft)}s`, W / 2, 30);
                ctx.font = '14px Inter'; ctx.textAlign = 'left';
                players.forEach((p, i) => { ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 55 + i * 22); });
                ctx.textAlign = 'center'; ctx.fillStyle = '#7986a8'; ctx.font = '13px Inter';
                ctx.fillText(config.label, W / 2, 55);
                // Targets
                targets.forEach(t => {
                    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.scale, t.scale);
                    const pulse = 1 + 0.05 * Math.sin(Date.now() / 200);
                    ctx.scale(pulse, pulse);
                    ctx.font = `${t.r * 1.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(config.icon, 0, 0);
                    ctx.restore();
                });
                // Particles
                particles.forEach(p => { ctx.globalAlpha = p.alpha; ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.icon, p.x, p.y); });
                ctx.globalAlpha = 1;
            }

            function gameLoop(ts) {
                if (!lastTime) lastTime = ts;
                const dt = Math.min(ts - lastTime, 100); lastTime = ts;
                if (!over) {
                    timeLeft -= dt / 1000;
                    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }
                    update(dt);
                }
                draw();
                animId = requestAnimationFrame(gameLoop);
            }

            function endGame() {
                over = true;
                const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                cancelAnimationFrame(animId);
                draw();
                window.vennaEndGame(results);
            }

            function handleClick(e) {
                if (over) return;
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                for (let i = targets.length - 1; i >= 0; i--) {
                    const t = targets[i];
                    if (Math.hypot(mx - t.x, my - t.y) < t.r * t.scale) {
                        targets.splice(i, 1);
                        scores[myPlayerId] = (scores[myPlayerId] || 0) + 1;
                        for (let j = 0; j < 5; j++) particles.push({ x: t.x, y: t.y, vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, life: 500, alpha: 1, icon: config.hit });
                        socket.emit('game-action', { roomCode, action: { type: 'score', id: t.id, playerId: myPlayerId } });
                        break;
                    }
                }
            }

            socket.on('game-action', ({ playerId, action }) => {
                if (action.type === 'score' && playerId !== myPlayerId) {
                    scores[action.playerId] = (scores[action.playerId] || 0) + 1;
                    targets = targets.filter(t => t.id !== action.id);
                }
            });

            canvas.addEventListener('click', handleClick);
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
        };
    }

    G['whack-mole'] = { init: createGame('whack-mole') };
    G['hammer-hit'] = { init: createGame('hammer-hit') };
    G['light-fingers'] = { init: createGame('light-fingers') };
})();
