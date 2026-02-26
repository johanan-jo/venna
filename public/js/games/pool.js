// Pool — billiards physics, covers Pool and Soccer Pool
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const isSoccer = slug === 'soccer-pool';
            const ids = players.map(p => p.id);
            const myIdx = ids.indexOf(myPlayerId);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            // Table
            const TX = 80, TY = 60, TW = W - 160, TH = H - 120;
            // Balls
            let balls = [];
            function reset() {
                balls = [];
                if (isSoccer) {
                    balls.push({ x: TX + TW / 2, y: TY + TH / 2, r: 12, vx: 0, vy: 0, color: '#fff', type: 'cue', owner: -1 });
                    balls.push({ x: TX + TW / 2 - 80, y: TY + TH / 2, r: 14, vx: 0, vy: 0, color: '#ef4444', type: 'player', owner: 0 });
                    balls.push({ x: TX + TW / 2 + 80, y: TY + TH / 2, r: 14, vx: 0, vy: 0, color: '#3b82f6', type: 'player', owner: 1 });
                } else {
                    const rc = [[0, 0], [1, -0.5], [1, 0.5], [2, -1], [2, 0], [2, 1], [3, -1.5], [3, -0.5], [3, 0.5], [3, 1.5], [4, -2], [4, -1], [4, 0], [4, 1], [4, 2]];
                    const sp = 26;
                    rc.forEach(([r, c], i) => { balls.push({ x: TX + TW * 0.65 + r * sp * 0.87, y: TY + TH / 2 + c * sp, r: 11, vx: 0, vy: 0, color: i === 4 ? '#111' : ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#f97316', '#8b5cf6', '#14b8a6'][i % 8], type: i === 4 ? '8ball' : 'solid', num: i + 1, pocketed: false }); });
                    balls.push({ x: TX + TW * 0.2, y: TY + TH / 2, r: 11, vx: 0, vy: 0, color: '#fff', type: 'cue', pocketed: false });
                }
            }
            reset();

            let aiming = false, aimX = 0, aimY = 0, shotPow = 0, isMoving = false;
            let turn = 0, scores = {};
            players.forEach(p => scores[p.id] = 0);
            let over = false, animId, lastTime = 0;
            let pockets = [];
            if (!isSoccer) { const pos = [[TX, TY], [TX + TW / 2, TY], [TX + TW, TY], [TX, TY + TH], [TX + TW / 2, TY + TH], [TX + TW, TY + TH]]; pockets = pos.map(([x, y]) => ({ x, y, r: 16 })); }
            else { pockets = [{ x: TX, y: TY + TH / 2, r: 22, team: 0 }, { x: TX + TW, y: TY + TH / 2, r: 22, team: 1 }]; }

            function physicsStep(dt) {
                const s = dt / 16;
                balls.forEach(b => {
                    if (b.pocketed) return; b.x += b.vx * s; b.y += b.vy * s; b.vx *= 0.985; b.vy *= 0.985; if (Math.abs(b.vx) < 0.05) b.vx = 0; if (Math.abs(b.vy) < 0.05) b.vy = 0;
                    if (b.x - b.r < TX) { b.x = TX + b.r; b.vx *= -0.8; } if (b.x + b.r > TX + TW) { b.x = TX + TW - b.r; b.vx *= -0.8; }
                    if (b.y - b.r < TY) { b.y = TY + b.r; b.vy *= -0.8; } if (b.y + b.r > TY + TH) { b.y = TY + TH - b.r; b.vy *= -0.8; }
                });
                // Collisions
                for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
                    const a = balls[i], b = balls[j]; if (a.pocketed || b.pocketed) continue;
                    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), mn = a.r + b.r;
                    if (d < mn && d > 0) {
                        const nx = dx / d, ny = dy / d, ov = (mn - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
                        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                        if (rv < 0) { a.vx -= rv * nx; a.vy -= rv * ny; b.vx += rv * nx; b.vy += rv * ny; }
                    }
                }
                // Pockets
                pockets.forEach(pk => { balls.forEach(b => { if (!b.pocketed && Math.hypot(b.x - pk.x, b.y - pk.y) < pk.r + b.r) { b.pocketed = true; if (!isSoccer && b.type === 'cue') { b.pocketed = false; b.x = TX + TW * 0.2; b.y = TY + TH / 2; b.vx = b.vy = 0; } if (isSoccer && b.type === 'player') { const winner = pk.team === 0 ? 1 : 0; scores[ids[winner]] = (scores[ids[winner]] || 0) + 1; setTimeout(() => reset(), 500); } } }); });
                isMoving = balls.some(b => !b.pocketed && (Math.abs(b.vx) > 0.1 || Math.abs(b.vy) > 0.1));
                if (!isMoving && !aiming) socket.emit('game-action', { roomCode, action: { type: 'state', balls: balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, pocketed: b.pocketed })) } });
            }

            function draw() {
                ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#1a5c2a'; ctx.fillRect(TX, TY, TW, TH);
                ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 16; ctx.strokeRect(TX, TY, TW, TH);
                pockets.forEach(pk => { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2); ctx.fill(); });
                balls.forEach(b => { if (b.pocketed) return; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); if (b.num) { ctx.font = `bold ${b.r}px Inter`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.num, b.x, b.y); } });
                // Cue stick
                const cue = balls.find(b => b.type === 'cue' && !b.pocketed);
                const isMyTurn = ids[turn % ids.length] === myPlayerId;
                if (cue && aiming && isMyTurn) { const ang = Math.atan2(aimY - cue.y, aimX - cue.x) + Math.PI; ctx.strokeStyle = '#c4963c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(cue.x + Math.cos(ang) * 120, cue.y + Math.sin(ang) * 120); ctx.stroke(); }
                ctx.font = '14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; players.forEach((p, i) => { ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 8, 8 + i * 20); });
                ctx.textAlign = 'center'; ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8'; ctx.font = '13px Inter';
                ctx.fillText(isMyTurn && !isMoving ? 'Your turn — click and drag to aim, release to shoot' : 'Moving…', W / 2, TY - 14);
            }

            function handleMouseDown(e) { const rect = canvas.getBoundingClientRect(); aimX = e.clientX - rect.left; aimY = e.clientY - rect.top; if (!isMoving && ids[turn % ids.length] === myPlayerId) aiming = true; }
            function handleMouseMove(e) { const rect = canvas.getBoundingClientRect(); aimX = e.clientX - rect.left; aimY = e.clientY - rect.top; }
            function handleMouseUp() {
                if (!aiming) return; aiming = false;
                const cue = balls.find(b => b.type === 'cue' && !b.pocketed);
                if (!cue || isMoving) return;
                const ang = Math.atan2(aimY - cue.y, aimX - cue.x) + Math.PI;
                const pwr = Math.min(Math.hypot(aimX - cue.x, aimY - cue.y) / 50, 1) * 12;
                cue.vx = Math.cos(ang) * pwr; cue.vy = Math.sin(ang) * pwr;
                socket.emit('game-action', { roomCode, action: { type: 'shoot', vx: cue.vx, vy: cue.vy } });
                turn++;
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'shoot') { const cue = balls.find(b => b.type === 'cue'); if (cue) { cue.vx = action.vx; cue.vy = action.vy; } }
                if (action.type === 'state') action.balls.forEach((bd, i) => { if (balls[i]) { balls[i].x = bd.x; balls[i].y = bd.y; balls[i].vx = bd.vx; balls[i].vy = bd.vy; balls[i].pocketed = bd.pocketed; } });
            });

            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);

            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 50); lastTime = ts; physicsStep(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousedown', handleMouseDown); canvas.removeEventListener('mousemove', handleMouseMove); canvas.removeEventListener('mouseup', handleMouseUp); socket.off('game-action'); };
        };
    }

    G['pool'] = { init: makeInit('pool') };
    G['soccer-pool'] = { init: makeInit('soccer-pool') };
})();
