// Golf — angle and power click shot
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        const HOLES = 9;
        let hole = 1, par = 3, power = 0, angle = 200, angleDir = 1;
        let shooting = false, aiming = false;
        let scores = {};
        players.forEach(p => scores[p.id] = 0);
        let strokes = {};
        players.forEach(p => strokes[p.id] = 0);
        let balls = {};
        let holeX, holeY, teeX, teeY;
        let over = false, animId, lastTime = 0;

        function newHole() {
            holeX = W * 0.75 + Math.random() * W * 0.1; holeY = 100 + Math.random() * (H - 200);
            teeX = W * 0.15; teeY = H / 2;
            balls = {};
            players.forEach((p, i) => { balls[p.id] = { x: teeX + (i - 1) * 20, y: teeY, vx: 0, vy: 0, r: 8, done: false }; });
            aiming = false; shooting = false; power = 0; angle = Math.atan2(holeY - teeY, holeX - teeX) * (180 / Math.PI);
        }
        newHole();

        // Obstacles (simplified circular rocks)
        let obstacles = [];
        function genObstacles() { obstacles = []; for (let i = 0; i < 3; i++) obstacles.push({ x: W * 0.3 + Math.random() * W * 0.35, y: 60 + Math.random() * (H - 120), r: 20 }); }
        genObstacles();

        function update(dt) {
            Object.values(balls).forEach(b => {
                if (b.done) return;
                b.x += b.vx * (dt / 16); b.y += b.vy * (dt / 16);
                b.vx *= 0.97; b.vy *= 0.97;
                if (b.x < 0 || b.x > W) { b.vx *= -0.7; } if (b.y < 0 || b.y > H) { b.vy *= -0.7; b.y = Math.max(0, Math.min(H, b.y)); }
                obstacles.forEach(o => { const d = Math.hypot(b.x - o.x, b.y - o.y); if (d < o.r + b.r) { const nx = (b.x - o.x) / d, ny = (b.y - o.y) / d; b.vx = nx * Math.abs(b.vx + b.vy) * 0.7; b.vy = ny * Math.abs(b.vx + b.vy) * 0.7; } });
                if (Math.hypot(b.x - holeX, b.y - holeY) < 20 && Math.sqrt(b.vx ** 2 + b.vy ** 2) < 3) { b.done = true; b.x = holeX; b.y = holeY; }
                if (Math.sqrt(b.vx ** 2 + b.vy ** 2) < 0.1) { b.vx = 0; b.vy = 0; }
            });
            if (aiming) { angle += angleDir * 1.5; if (angle > 260 || angle < 140) angleDir *= -1; }
        }

        function draw() {
            // Fairway
            ctx.fillStyle = '#1a4a1a'; ctx.fillRect(0, 0, W, H);
            // Rough grass
            ctx.fillStyle = '#142e14';[[W * 0.05, 0, W * 0.1, H], [W * 0.85, 0, W * 0.15, H]].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
            // Obstacles
            obstacles.forEach(o => { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🪨', o.x, o.y); });
            // Hole marker
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(holeX, holeY, 15, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(holeX, holeY, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ef4444'; ctx.fillRect(holeX, holeY - 35, 3, 35);
            ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('🚩', holeX + 8, holeY - 25);
            // Balls
            Object.entries(balls).forEach(([pid, b]) => {
                const pi = ids.indexOf(pid);
                ctx.fillStyle = COLORS[pi] || '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            });
            // Aim line for my ball
            const me = balls[myPlayerId];
            const isMyTurn = ids[Math.floor(hole) % ids.length] === myPlayerId || true; // everyone shoots simultaneously
            if (me && !me.done && aiming) {
                const rad = angle * (Math.PI / 180);
                ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
                ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(me.x + Math.cos(rad) * 100, me.y + Math.sin(rad) * 100); ctx.stroke(); ctx.setLineDash([]);
                // Power bar
                ctx.fillStyle = '#1a1a2a'; ctx.fillRect(me.x - 40, me.y - 28, 80, 10);
                ctx.fillStyle = power > 70 ? '#ef4444' : '#10b981'; ctx.fillRect(me.x - 40, me.y - 28, 80 * (power / 100), 10);
            }
            // HUD
            ctx.font = '14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            players.forEach((p, i) => { ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${strokes[p.id]} strokes`, 10, 8 + i * 20); });
            ctx.textAlign = 'center'; ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 15px Outfit';
            ctx.fillText(`⛳ Hole ${hole} / ${HOLES}`, W / 2, 8);
            ctx.font = '12px Inter'; ctx.fillStyle = '#7986a8';
            ctx.fillText(aiming ? 'Release to shoot!' : 'Click to aim!', W / 2, H - 22);
        }

        function handleMouseDown() { if (!balls[myPlayerId]?.done) aiming = true; }
        function handleMouseUp() {
            if (!aiming) return; aiming = false;
            const me = balls[myPlayerId]; if (!me || me.done) return;
            const rad = angle * (Math.PI / 180);
            const pwr = (power / 100) * 14;
            me.vx = Math.cos(rad) * pwr; me.vy = Math.sin(rad) * pwr;
            strokes[myPlayerId] = (strokes[myPlayerId] || 0) + 1;
            power = 0;
            socket.emit('game-action', { roomCode, action: { type: 'shot', playerId: myPlayerId, vx: me.vx, vy: me.vy } });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'shot') { const b = balls[action.playerId]; if (b) { b.vx = action.vx; b.vy = action.vy; strokes[action.playerId] = (strokes[action.playerId] || 0) + 1; } }
        });

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);

        function gameLoop(ts) {
            if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts;
            if (aiming) { power += 2; if (power > 100) power = 0; }
            if (!over) { update(dt); }
            draw();
            // Check all done
            if (Object.values(balls).every(b => b.done) && !over) {
                hole++;
                if (hole > HOLES) {
                    over = true;
                    const results = players.map(p => ({ playerId: p.id, score: HOLES * par * 3 - strokes[p.id] }));
                    setTimeout(() => window.vennaEndGame(results), 1000);
                } else { newHole(); genObstacles(); }
            }
            if (!over) animId = requestAnimationFrame(gameLoop);
        }
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousedown', handleMouseDown); canvas.removeEventListener('mouseup', handleMouseUp); socket.off('game-action'); };
    }

    G['golf'] = { init };
})();
