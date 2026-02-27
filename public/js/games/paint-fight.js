// Paint Fight / Color Wars — Paint the floor, most % of area wins (2-4 players)
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
            const HEX = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
            const DURATION = 30, SPEED = 200, PAINT_R = 16;

            const STARTS = [
                { x: 60, y: 60 }, { x: W - 60, y: H - 60 },
                { x: W - 60, y: 60 }, { x: 60, y: H - 60 },
            ];

            let positions = Array(nP).fill(null).map((_, i) => ({ ...STARTS[i] }));
            let keys = {};
            let elapsed = 0, lastTs = null, animId = null, over = false;

            // Offscreen pixel canvas for tracking paint
            const offCanvas = document.createElement('canvas');
            offCanvas.width = W; offCanvas.height = H;
            const offCtx = offCanvas.getContext('2d');
            offCtx.fillStyle = '#0d0f1a'; offCtx.fillRect(0, 0, W, H);

            function paintAt(x, y, colorIdx) {
                offCtx.beginPath();
                offCtx.arc(x, y, PAINT_R, 0, Math.PI * 2);
                offCtx.fillStyle = COLORS[colorIdx]; offCtx.fill();
            }

            function countPaint() {
                const data = offCtx.getImageData(0, 0, W, H).data;
                const counts = Array(nP).fill(0);
                let painted = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    if (r === 0x0d && g === 0x0f && b === 0x1a) continue;
                    painted++;
                    for (let pi = 0; pi < nP; pi++) {
                        const hr = (HEX[pi] >> 16) & 0xff;
                        const hg = (HEX[pi] >> 8) & 0xff;
                        const hb = HEX[pi] & 0xff;
                        if (Math.abs(r - hr) < 20 && Math.abs(g - hg) < 20 && Math.abs(b - hb) < 20) { counts[pi]++; break; }
                    }
                }
                return counts;
            }

            function draw() {
                ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
                ctx.drawImage(offCanvas, 0, 0);

                // Player tokens
                positions.forEach((p, i) => {
                    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
                    ctx.fillStyle = COLORS[i]; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(players[i].name.slice(0, 2).toUpperCase(), p.x, p.y);
                });

                // Timer + controls hint
                const timeLeft = Math.max(0, DURATION - elapsed);
                ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, 28);
                ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s  |  WASD or Arrow keys to move and paint!`, W / 2, 14);
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

                if (elapsed >= DURATION) {
                    over = true; cancelAnimationFrame(animId);
                    const counts = countPaint();
                    draw();
                    const results = players.map((p, i) => ({ playerId: p.id, score: counts[i] }));
                    setTimeout(() => window.vennaEndGame(results), 800); return;
                }

                draw();
                animId = requestAnimationFrame(loop);
            }

            function onKey(e, down) {
                keys[e.key] = down;
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'move') {
                    positions[action.pi].x = action.x;
                    positions[action.pi].y = action.y;
                    paintAt(action.x, action.y, action.pi);
                }
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
