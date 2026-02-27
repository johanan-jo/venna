// Paint Fight / Color Wars — Paint the floor, most % of area wins (2-4 players)
// Edge Cases: Pixel Majority Tie → Sudden Death (next pixel painted wins)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function makeGame(slug) {
        function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const myIdx = ids.indexOf(myPlayerId);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
            // Pre-parsed RGB for fast pixel comparison
            const RGBS = [[239, 68, 68], [59, 130, 246], [16, 185, 129], [245, 158, 11]];
            const DURATION = 30, SPEED = 200, PAINT_R = 16;
            const STARTS = [{ x: 60, y: 60 }, { x: W - 60, y: H - 60 }, { x: W - 60, y: 60 }, { x: 60, y: H - 60 }];

            let positions = Array(nP).fill(null).map((_, i) => ({ ...STARTS[i] }));
            let keys = {};
            let elapsed = 0, lastTs = null, animId = null, over = false;
            let suddenDeath = false, suddenDeathWinner = -1;

            const offCanvas = document.createElement('canvas');
            offCanvas.width = W; offCanvas.height = H;
            const offCtx = offCanvas.getContext('2d');
            offCtx.fillStyle = '#111827'; offCtx.fillRect(0, 0, W, H); // distinct bg colour

            function paintAt(x, y, colorIdx) {
                offCtx.beginPath();
                offCtx.arc(x, y, PAINT_R, 0, Math.PI * 2);
                offCtx.fillStyle = COLORS[colorIdx]; offCtx.fill();

                // ── Sudden Death: the first paint after tie is declared wins
                if (suddenDeath && suddenDeathWinner === -1) {
                    suddenDeathWinner = colorIdx;
                    over = true;
                    cancelAnimationFrame(animId);
                    const results = players.map((p, i) => ({ playerId: p.id, score: i === colorIdx ? 999 : 0 }));
                    setTimeout(() => window.vennaEndGame(results), 600);
                }
            }

            function countPaint() {
                const data = offCtx.getImageData(0, 0, W, H).data;
                const counts = Array(nP).fill(0);
                let total = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    if (a < 200) continue;
                    for (let pi = 0; pi < nP; pi++) {
                        const [cr, cg, cb] = RGBS[pi];
                        if (Math.abs(r - cr) < 25 && Math.abs(g - cg) < 25 && Math.abs(b - cb) < 25) {
                            counts[pi]++; total++; break;
                        }
                    }
                }
                return { counts, total };
            }

            function draw() {
                ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, W, H);
                ctx.drawImage(offCanvas, 0, 0);

                positions.forEach((p, i) => {
                    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[i]; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(players[i].name.slice(0, 2).toUpperCase(), p.x, p.y);
                });

                const timeLeft = Math.max(0, DURATION - elapsed);
                ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, 28);
                ctx.font = 'bold 13px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (suddenDeath) {
                    ctx.fillStyle = '#ef4444'; ctx.fillText('⚡ SUDDEN DEATH! Next pixel wins!', W / 2, 14);
                } else {
                    ctx.fillStyle = '#fff'; ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  |  WASD / arrows to move and paint`, W / 2, 14);
                }
            }

            let syncTimer = 0;
            function loop(ts) {
                if (over) return;
                if (!lastTs) lastTs = ts;
                const dt = Math.min((ts - lastTs) / 1000, 0.08);
                lastTs = ts;
                elapsed += dt;

                const me = positions[myIdx];
                let dx = 0, dy = 0;
                if (keys['ArrowLeft'] || keys['a']) dx -= 1;
                if (keys['ArrowRight'] || keys['d']) dx += 1;
                if (keys['ArrowUp'] || keys['w']) dy -= 1;
                if (keys['ArrowDown'] || keys['s']) dy += 1;
                if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
                me.x = Math.max(16, Math.min(W - 16, me.x + dx * SPEED * dt));
                me.y = Math.max(16, Math.min(H - 16, me.y + dy * SPEED * dt));
                if (dx !== 0 || dy !== 0) paintAt(me.x, me.y, myIdx);

                syncTimer += dt;
                if (syncTimer > 0.05 && (dx !== 0 || dy !== 0)) {
                    syncTimer = 0;
                    socket.emit('game-action', { roomCode, action: { type: 'move', pi: myIdx, x: me.x, y: me.y } });
                }

                if (elapsed >= DURATION && !over && !suddenDeath) {
                    // Count pixels to detect tie
                    const { counts, total } = countPaint();
                    if (total > 0 && nP === 2) {
                        const diff = Math.abs(counts[0] - counts[1]);
                        const pct = diff / total;
                        if (pct < 0.001) {
                            // ── Pixel majority tie: enter sudden death
                            suddenDeath = true;
                            socket.emit('game-action', { roomCode, action: { type: 'sudden-death' } });
                            draw(); animId = requestAnimationFrame(loop); return;
                        }
                    }
                    over = true; cancelAnimationFrame(animId);
                    const { counts: c } = countPaint();
                    const results = players.map((p, i) => ({ playerId: p.id, score: c[i] || 0 }));
                    draw(); setTimeout(() => window.vennaEndGame(results), 500); return;
                }

                draw(); animId = requestAnimationFrame(loop);
            }

            function onKey(e, down) { keys[e.key] = down; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'move') {
                    positions[action.pi].x = action.x; positions[action.pi].y = action.y;
                    paintAt(action.x, action.y, action.pi);
                }
                if (action.type === 'sudden-death') suddenDeath = true;
            });

            document.addEventListener('keydown', e => onKey(e, true));
            document.addEventListener('keyup', e => onKey(e, false));
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

    G['paint-fight'] = makeGame('paint-fight');
    G['color-wars'] = makeGame('color-wars');
})();
