// Side Scroller — Flappy Jump, Gravity Run, Happy Birds, Chicken Jump, Piranha Rush
// Each player runs their own local game; scores sync at end
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'flappy-jump': { bg: '#0d1f3a', bird: '🐦', pipe: '🟩', label: 'Tap/Space to flap!', pipeW: 50, gap: 150, speed: 2.5, grav: 0.4, flapForce: -7 },
        'gravity-run': { bg: '#0d0d1f', bird: '🪂', pipe: '🔮', label: 'Space to flip gravity!', pipeW: 50, gap: 160, speed: 2.8, grav: 0.35, flapForce: -8 },
        'happy-birds': { bg: '#0f2a0f', bird: '🐧', pipe: '🌲', label: 'Click to flap wings!', pipeW: 45, gap: 155, speed: 2.3, grav: 0.38, flapForce: -7 },
        'chicken-jump': { bg: '#2a1a00', bird: '🐔', pipe: '🌵', label: 'Click to jump!', pipeW: 40, gap: 170, speed: 2.0, grav: 0.45, flapForce: -8 },
        'piranha-rush': { bg: '#001a1a', bird: '🐠', pipe: '🐬', label: 'Swim! Avoid piranhas!', pipeW: 50, gap: 145, speed: 3.0, grav: 0.3, flapForce: -6 },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
            const cfg = CFGS[slug] || CFGS['flappy-jump'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const scores = {};
            players.forEach(p => scores[p.id] = 0);
            let alive = true, score = 0, over = false, animId;
            let lastTime = 0;
            let pipes = [], elapsed = 0;
            let bird = { x: W * 0.2, y: H / 2, vy: 0 };
            let pipeTimer = 0;
            let sharedScores = {};

            function flap() { if (alive) bird.vy = cfg.flapForce; }

            function update(dt) {
                if (!alive) return;
                bird.vy += cfg.grav * (dt / 16);
                bird.y += bird.vy * (dt / 16);
                pipeTimer += dt;
                if (pipeTimer > 1500) { pipeTimer = 0; const gapY = 80 + Math.random() * (H - cfg.gap - 160); pipes.push({ x: W, topH: gapY, scored: false }); }
                pipes.forEach(p => p.x -= cfg.speed * (dt / 16));
                pipes = pipes.filter(p => p.x > -cfg.pipeW - 20);
                if (bird.y > H - 30 || bird.y < 30) { alive = false; setTimeout(endMyRun, 500); return; }
                pipes.forEach(p => {
                    const bx = bird.x, by = bird.y;
                    if (bx + 20 > p.x && bx - 20 < p.x + cfg.pipeW && (by - 20 < p.topH || by + 20 > p.topH + cfg.gap)) { alive = false; setTimeout(endMyRun, 500); return; }
                    if (!p.scored && p.x + cfg.pipeW < bx) { p.scored = true; score++; }
                });
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Ground & sky
                ctx.fillStyle = '#1a1a0a'; ctx.fillRect(0, H - 30, W, 30);
                // Pipes
                pipes.forEach(p => {
                    ctx.fillStyle = '#16a34a';
                    ctx.fillRect(p.x, 0, cfg.pipeW, p.topH);
                    ctx.fillRect(p.x, p.topH + cfg.gap, cfg.pipeW, H - p.topH - cfg.gap);
                    ctx.font = `${cfg.pipeW}px serif`; ctx.textBaseline = 'middle';
                    ctx.fillText(cfg.pipe, p.x, p.topH - 25);
                    ctx.fillText(cfg.pipe, p.x, p.topH + cfg.gap + 25);
                });
                // Bird
                if (alive) {
                    ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(Math.min(Math.PI / 4, bird.vy * 0.04));
                    ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(cfg.bird, 0, 0); ctx.restore();
                }
                // HUD
                ctx.font = 'bold 22px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(score, W / 2, 10);
                ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText(cfg.label, W / 2, 40);
                // Scores from others
                let sy = 65;
                Object.entries(sharedScores).forEach(([pid, sc]) => {
                    const p = players.find(p => p.id === pid); if (!p) return;
                    ctx.font = '12px Inter'; ctx.textAlign = 'left'; ctx.fillStyle = '#7986a8';
                    ctx.fillText(`${p.name}: ${sc}`, 10, sy); sy += 18;
                });
                if (!alive) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
                    ctx.font = 'bold 28px Outfit'; ctx.textAlign = 'center'; ctx.fillStyle = '#f59e0b';
                    ctx.fillText('💀 Game Over!', W / 2, H / 2 - 20);
                    ctx.font = '20px Inter'; ctx.fillStyle = '#fff'; ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 20);
                }
            }

            function gameLoop(ts) {
                if (!lastTime) lastTime = ts;
                const dt = Math.min(ts - lastTime, 100); lastTime = ts;
                update(dt);
                draw();
                if (!over) animId = requestAnimationFrame(gameLoop);
            }

            function endMyRun() {
                socket.emit('game-action', { roomCode, action: { type: 'done', playerId: myPlayerId, score } });
                sharedScores[myPlayerId] = score;
                checkAllDone();
            }

            function checkAllDone() {
                if (Object.keys(sharedScores).length >= players.length && !over) {
                    over = true;
                    const results = players.map(p => ({ playerId: p.id, score: sharedScores[p.id] || 0 }));
                    setTimeout(() => window.vennaEndGame(results), 1000);
                }
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'done') { sharedScores[action.playerId] = action.score; checkAllDone(); }
            });

            function handleInput(e) { if (e.type === 'click' || (e.type === 'keydown' && (e.code === 'Space' || e.code === 'ArrowUp'))) flap(); }
            canvas.addEventListener('click', handleInput);
            document.addEventListener('keydown', handleInput);
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleInput); document.removeEventListener('keydown', handleInput); socket.off('game-action'); };
        };
    }

    ['flappy-jump', 'gravity-run', 'happy-birds', 'chicken-jump', 'piranha-rush'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
