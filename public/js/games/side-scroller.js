// Side Scroller — Flappy Jump, Gravity Run, Happy Birds, Chicken Jump, Piranha Rush
// Edge Cases: Gravity-Run spawn buffer (no obstacle in player's vertical path on flip)
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'flappy-jump': { bg: '#0d1f3a', bird: '🐦', pipe: '🟩', label: 'Tap/Space to flap!', pipeW: 50, gap: 150, speed: 2.5, grav: 0.4, flapForce: -7, gravFlip: false },
        'gravity-run': { bg: '#0d0d1f', bird: '🪂', pipe: '🔮', label: 'Space to flip gravity!', pipeW: 50, gap: 160, speed: 2.8, grav: 0.35, flapForce: -8, gravFlip: true },
        'happy-birds': { bg: '#0f2a0f', bird: '🐧', pipe: '🌲', label: 'Click to flap wings!', pipeW: 45, gap: 155, speed: 2.3, grav: 0.38, flapForce: -7, gravFlip: false },
        'chicken-jump': { bg: '#2a1a00', bird: '🐔', pipe: '🌵', label: 'Click to jump!', pipeW: 40, gap: 170, speed: 2.0, grav: 0.45, flapForce: -8, gravFlip: false },
        'piranha-rush': { bg: '#001a1a', bird: '🐠', pipe: '🐬', label: 'Swim! Avoid piranhas!', pipeW: 50, gap: 145, speed: 3.0, grav: 0.3, flapForce: -6, gravFlip: false },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['flappy-jump'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            let scores = {}; players.forEach(p => scores[p.id] = 0);
            let alive = true, score = 0, over = false, animId;
            let lastTime = 0;
            let pipes = [], elapsed = 0;
            let bird = { x: W * 0.2, y: H / 2, vy: 0 };
            let pipeTimer = 0;
            let sharedScores = {};

            // ── Gravity-Run state
            let gravityDir = 1;   // 1 = normal (down), -1 = flipped (up)
            let gravFlipCooldown = 0; // frames since last flip, for spawn buffer

            // ── Spawn buffer: after flipping gravity, don't spawn a pipe for 600ms
            const SPAWN_BUFFER_MS = 600;
            let spawnBufferTimer = 0;

            function flap() {
                if (!alive) return;
                if (cfg.gravFlip) {
                    // Gravity-run: flip gravity
                    gravityDir *= -1;
                    bird.vy = 0; // cancel velocity on flip for clean transition
                    spawnBufferTimer = SPAWN_BUFFER_MS; // ── buffer: suppress next pipe spawn
                } else {
                    bird.vy = cfg.flapForce;
                }
            }

            function update(dt) {
                if (!alive) return;
                bird.vy += cfg.grav * gravityDir * (dt / 16);
                bird.y += bird.vy * (dt / 16);

                // Pipe timer & spawn
                pipeTimer += dt;
                spawnBufferTimer = Math.max(0, spawnBufferTimer - dt);

                if (pipeTimer > 1500) {
                    pipeTimer = 0;
                    // ── Spawn buffer: skip this spawn if within buffer window after gravity flip
                    if (spawnBufferTimer <= 0) {
                        let gapY = 80 + Math.random() * (H - cfg.gap - 160);
                        // ── Gravity trap guard: if gravity is flipped, make sure gap doesn't
                        //    start right at the ceiling where the bird currently is
                        if (cfg.gravFlip && gravityDir === -1) {
                            const birdZone = bird.y - 60;
                            gapY = Math.max(birdZone + 40, Math.min(H - cfg.gap - 80, gapY));
                        }
                        pipes.push({ x: W, topH: gapY, scored: false });
                    }
                }

                pipes.forEach(p => p.x -= cfg.speed * (dt / 16));
                pipes = pipes.filter(p => p.x > -cfg.pipeW - 20);

                // Boundary
                const topBound = gravityDir === -1 ? 30 : 30;
                const botBound = H - 30;
                if (bird.y > botBound || bird.y < topBound) {
                    alive = false; setTimeout(endMyRun, 500); return;
                }

                // Pipe collisions
                pipes.forEach(p => {
                    const bx = bird.x, by = bird.y;
                    if (bx + 20 > p.x && bx - 20 < p.x + cfg.pipeW &&
                        (by - 20 < p.topH || by + 20 > p.topH + cfg.gap)) {
                        alive = false; setTimeout(endMyRun, 500); return;
                    }
                    if (!p.scored && p.x + cfg.pipeW < bx) { p.scored = true; score++; }
                });
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Ground & sky
                if (gravityDir === 1) {
                    ctx.fillStyle = '#1a1a0a'; ctx.fillRect(0, H - 30, W, 30);
                } else {
                    ctx.fillStyle = '#1a1a0a'; ctx.fillRect(0, 0, W, 30);
                }
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
                    ctx.save(); ctx.translate(bird.x, bird.y);
                    ctx.rotate(Math.min(Math.PI / 4, bird.vy * 0.04 * gravityDir));
                    if (gravityDir === -1) ctx.scale(1, -1); // flip sprite when gravity flipped
                    ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(cfg.bird, 0, 0); ctx.restore();
                }
                // Gravity indicator for gravity-run
                if (cfg.gravFlip) {
                    ctx.fillStyle = gravityDir === 1 ? '#22c55e' : '#f59e0b';
                    ctx.font = '14px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                    ctx.fillText(gravityDir === 1 ? '⬇ Normal' : '⬆ Flipped', 10, H - 50);
                }
                // HUD
                ctx.font = 'bold 22px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
                ctx.fillText(score, W / 2, 10);
                ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText(cfg.label, W / 2, 40);
                // Opponent scores
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
                update(dt); draw();
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

            function handleInput(e) {
                if (e.type === 'click' || (e.type === 'keydown' && (e.code === 'Space' || e.code === 'ArrowUp'))) {
                    if (e.type === 'keydown') e.preventDefault();
                    flap();
                }
            }
            canvas.addEventListener('click', handleInput);
            document.addEventListener('keydown', handleInput);
            animId = requestAnimationFrame(gameLoop);
            return () => {
                cancelAnimationFrame(animId);
                canvas.removeEventListener('click', handleInput);
                document.removeEventListener('keydown', handleInput);
                socket.off('game-action');
            };
        };
    }

    ['flappy-jump', 'gravity-run', 'happy-birds', 'chicken-jump', 'piranha-rush'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
