// Collector — Star Catcher, Money Grabber, Fruit Dual
// Player moves left/right to catch falling items
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'star-catcher': { items: ['⭐', '🌟', '💫'], miss: '☄️', bg: '#050714', playerIcon: '🚀', label: 'Catch falling stars!' },
        'money-grabber': { items: ['💰', '💵', '💎'], miss: '💣', bg: '#0a0a00', playerIcon: '🤑', label: 'Grab the cash!' },
        'fruit-dual': { items: ['🍎', '🍊', '🍋', '🍇'], miss: '🍆', bg: '#0a1400', playerIcon: '🧺', label: 'Catch your fruits!' },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['star-catcher'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const GAME_DUR = 30;
            const ids = players.map(p => p.id);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            const myIdx = ids.indexOf(myPlayerId);
            const scores = {};
            players.forEach(p => scores[p.id] = 0);

            const PLAYER_W = 60, PLAYER_H = 30;
            let myX = W / 2, keys = {};
            let itemsList = [];
            let spawnTimer = 0, timeLeft = GAME_DUR, over = false, animId, lastTime = 0;
            let sharedPositions = {}; // other players' x positions

            players.forEach((p, i) => { sharedPositions[p.id] = W / 2; });

            function spawnItem() {
                itemsList.push({ x: 40 + Math.random() * (W - 80), y: -30, vy: 2 + Math.random() * 2, icon: cfg.items[Math.floor(Math.random() * cfg.items.length)] });
            }

            function update(dt) {
                const speed = 280 * (dt / 1000);
                if (keys['ArrowLeft'] || keys['a']) myX = Math.max(PLAYER_W / 2, myX - speed);
                if (keys['ArrowRight'] || keys['d']) myX = Math.min(W - PLAYER_W / 2, myX + speed);
                sharedPositions[myPlayerId] = myX;
                spawnTimer += dt;
                if (spawnTimer > 700) { spawnTimer = 0; spawnItem(); }
                itemsList.forEach(item => item.y += item.vy * (dt / 16));
                // Catch
                const toRemove = [];
                itemsList.forEach((item, i) => {
                    if (item.y > H - 70 && item.y < H - 30) {
                        // my catch
                        if (Math.abs(item.x - myX) < PLAYER_W / 2 + 15) {
                            scores[myPlayerId] = (scores[myPlayerId] || 0) + 1;
                            socket.emit('game-action', { roomCode, action: { type: 'score', playerId: myPlayerId, idx: i } });
                            toRemove.push(i);
                        } else {
                            // check other players
                            players.forEach(p => {
                                if (p.id === myPlayerId) return;
                                const ox = sharedPositions[p.id] || W / 2;
                                if (Math.abs(item.x - ox) < PLAYER_W / 2 + 15) { toRemove.push(i); }
                            });
                        }
                    }
                    if (item.y > H) toRemove.push(i);
                });
                [...new Set(toRemove)].sort((a, b) => b - a).forEach(i => itemsList.splice(i, 1));
                timeLeft -= dt / 1000;
                if (timeLeft <= 0 && !over) endGame();
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Ground
                ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, H - 20, W, 20);
                // Items
                itemsList.forEach(item => { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.icon, item.x, item.y); });
                // Players
                players.forEach((p, i) => {
                    const px = i === myIdx ? myX : (sharedPositions[p.id] || W / 3 + i * 120);
                    ctx.fillStyle = COLORS[i]; ctx.beginPath(); ctx.roundRect(px - PLAYER_W / 2, H - 60, PLAYER_W, PLAYER_H, 8); ctx.fill();
                    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.playerIcon, px, H - 45);
                    ctx.font = '11px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.name, px, H - 22);
                });
                // HUD
                ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
                ctx.fillText(`⏱ ${Math.ceil(Math.max(0, timeLeft))}s`, W / 2, 8);
                players.forEach((p, i) => { ctx.font = '13px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 35 + i * 20); });
                ctx.textAlign = 'center'; ctx.fillStyle = '#7986a8'; ctx.font = '13px Inter'; ctx.fillText(cfg.label, W / 2, 35);
            }

            function endGame() {
                over = true;
                const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                cancelAnimationFrame(animId);
                window.vennaEndGame(results);
            }

            function gameLoop(ts) {
                if (!lastTime) lastTime = ts;
                const dt = Math.min(ts - lastTime, 100); lastTime = ts;
                if (!over) update(dt);
                draw();
                if (!over) animId = requestAnimationFrame(gameLoop);
            }

            socket.on('game-action', ({ playerId, action }) => {
                if (action.type === 'score' && playerId !== myPlayerId) { scores[action.playerId] = (scores[action.playerId] || 0) + 1; }
                if (action.type === 'pos') sharedPositions[playerId] = action.x;
            });

            // Sync position periodically
            const syncIv = setInterval(() => { if (!over) socket.emit('game-action', { roomCode, action: { type: 'pos', x: myX } }); }, 80);

            const kd = e => { keys[e.key] = true; };
            const ku = e => { keys[e.key] = false; };
            document.addEventListener('keydown', kd);
            document.addEventListener('keyup', ku);
            canvas.addEventListener('click', e => { const rect = canvas.getBoundingClientRect(); myX = e.clientX - rect.left; });
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); clearInterval(syncIv); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); socket.off('game-action'); };
        };
    }

    ['star-catcher', 'money-grabber', 'fruit-dual'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
