// Star Catcher / Money Grabber / Fruit Dual — Collect falling items (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function makeCollectorGame(slug) {
        const THEMES = {
            'star-catcher': { items: ['⭐', '🌟', '💫', '✨'], bg: '#0d0f2a', basketEmoji: '🪣', dur: 30 },
            'money-grabber': { items: ['💰', '💵', '🪙', '💎'], bg: '#0f1a0d', basketEmoji: '💼', dur: 30 },
            'fruit-dual': { items: ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒'], bg: '#1a0d0f', basketEmoji: '🧺', dur: 30 },
        };
        const theme = THEMES[slug] || THEMES['star-catcher'];

        function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const myIdx = ids.indexOf(myPlayerId);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
            const BASKET_W = 60, BASKET_SPEED = 400;
            const ITEM_R = 20;

            let scores = Array(nP).fill(0);
            let baskets = Array(nP).fill(null).map((_, i) => ({ x: (i + 0.5) * W / nP, y: H - 40 }));
            let items = [];
            let elapsed = 0, lastTs = null, animId = null, over = false;
            let keys = {};
            let lastSync = 0;

            function spawnItem() {
                return { x: 60 + Math.random() * (W - 120), y: -ITEM_R, vy: 120 + Math.random() * 100, emoji: theme.items[Math.floor(Math.random() * theme.items.length)], id: Math.random() };
            }

            function draw() {
                ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
                // Stars / background
                if (slug === 'star-catcher') {
                    for (let i = 0; i < 40; i++) {
                        ctx.fillStyle = '#ffffff22';
                        ctx.fillRect((i * 137) % W, (i * 97) % (H - 60), 1.5, 1.5);
                    }
                }
                // Items
                items.forEach(it => {
                    ctx.font = `${ITEM_R * 1.8}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(it.emoji, it.x, it.y);
                });
                // Baskets
                baskets.forEach((b, i) => {
                    ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(theme.basketEmoji, b.x, b.y);
                    ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 2;
                    ctx.strokeRect(b.x - BASKET_W / 2, b.y - 16, BASKET_W, 32);
                    ctx.fillStyle = COLORS[i]; ctx.font = 'bold 11px Inter'; ctx.textBaseline = 'bottom';
                    ctx.fillText(`${players[i].name}${i === myIdx ? ' ←' : ''}`, b.x, b.y - 18);
                });
                // HUD
                const timeLeft = Math.max(0, theme.dur - elapsed);
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 26);
                ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const scoreStr = players.slice(0, nP).map((p, i) => `${COLORS[i].replace('#', '')?.length ? '' : ''}${p.name}: ${scores[i]}`).join('  ·  ');
                ctx.fillStyle = '#7986a8'; ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  |  ← → or A/D to move`, W / 2, 13);
                players.slice(0, nP).forEach((p, i) => {
                    ctx.fillStyle = COLORS[i]; ctx.font = 'bold 12px Inter';
                    ctx.textAlign = i % 2 === 0 ? 'left' : 'right';
                    ctx.fillText(`${p.name}: ${scores[i]}`, i % 2 === 0 ? 8 : W - 8, 13);
                });
            }

            function loop(ts) {
                if (over) return;
                if (!lastTs) lastTs = ts;
                const dt = Math.min((ts - lastTs) / 1000, 0.1);
                lastTs = ts; elapsed += dt;

                // Move my basket
                const b = baskets[myIdx];
                let moved = false;
                if (keys['ArrowLeft'] || keys['a']) { b.x -= BASKET_SPEED * dt; moved = true; }
                if (keys['ArrowRight'] || keys['d']) { b.x += BASKET_SPEED * dt; moved = true; }
                b.x = Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, b.x));
                lastSync += dt;
                if (moved && lastSync > 0.04) { lastSync = 0; socket.emit('game-action', { roomCode, action: { type: 'move', pi: myIdx, x: b.x } }); }

                // Drop items
                if (Math.random() < dt * 2.5 && items.length < 15) items.push(spawnItem());
                items.forEach(it => { it.y += it.vy * dt; });

                // Catch check
                items = items.filter(it => {
                    for (let i = 0; i < nP; i++) {
                        const bb = baskets[i];
                        if (Math.abs(it.x - bb.x) < BASKET_W / 2 && Math.abs(it.y - bb.y) < 30) {
                            if (i === myIdx) {
                                scores[i]++;
                                socket.emit('game-action', { roomCode, action: { type: 'catch', pi: i, id: it.id } });
                            }
                            return false;
                        }
                    }
                    return it.y < H + ITEM_R;
                });

                if (elapsed >= theme.dur) {
                    over = true; cancelAnimationFrame(animId); draw();
                    const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                    setTimeout(() => window.vennaEndGame(results), 500); return;
                }
                draw(); animId = requestAnimationFrame(loop);
            }

            function onKey(e, v) { keys[e.key] = v; if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); }
            document.addEventListener('keydown', e => onKey(e, true));
            document.addEventListener('keyup', e => onKey(e, false));
            socket.on('game-action', ({ action }) => {
                if (action.type === 'move') baskets[action.pi].x = action.x;
                if (action.type === 'catch') { scores[action.pi]++; items = items.filter(it => it.id !== action.id); }
            });
            animId = requestAnimationFrame(loop);
            return () => {
                cancelAnimationFrame(animId);
                document.removeEventListener('keydown', e => onKey(e, true));
                document.removeEventListener('keyup', e => onKey(e, false));
                socket.off('game-action');
            };
        }
        return { init };
    }

    G['star-catcher'] = makeCollectorGame('star-catcher');
    G['money-grabber'] = makeCollectorGame('money-grabber');
    G['fruit-dual'] = makeCollectorGame('fruit-dual');
})();
