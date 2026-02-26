// Racing — top-down racer for Racing Cars, Rat Race, Slot Cars
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'racing-cars': { car: '🏎️', bg: '#1a1a1a', label: 'Racing Cars!', laps: 3, speed: 200 },
        'rat-race': { car: '🐀', bg: '#0d1a0d', label: 'Rat Race!', laps: 3, speed: 180 },
        'slot-cars': { car: '🚗', bg: '#0a0014', label: 'Slot Cars!', laps: 3, speed: 220 },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['racing-cars'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const nP = Math.min(players.length, 4);
            const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

            // Oval track waypoints
            const CX = W / 2, CY = H / 2;
            const TW = W * 0.38, TH = H * 0.35;
            const WAYPOINTS = [], NW = 24;
            for (let i = 0; i < NW; i++) {
                const a = (i / NW) * Math.PI * 2 - Math.PI / 2;
                WAYPOINTS.push({ x: CX + Math.cos(a) * TW, y: CY + Math.sin(a) * TH });
            }

            // Players state
            const racer = players.slice(0, nP).map((p, i) => ({
                id: p.id, name: p.name, x: WAYPOINTS[0].x + (i - nP / 2) * 18, y: WAYPOINTS[0].y + i * 24,
                angle: 0, speed: 0, wayptIdx: 0, laps: 0, finished: false,
                lane: i % 2 === 0 ? 1.1 : 0.9, // slightly different radii
            }));
            let input = { up: false, left: false, right: false };
            let over = false, animId, lastTime = 0;
            let positions = {}; // shared from network

            function update(dt) {
                const me = racer.find(r => r.id === myPlayerId); if (!me || me.finished) return;
                const dt_s = dt / 1000;
                if (input.up) me.speed = Math.min(cfg.speed, me.speed + 300 * dt_s);
                else me.speed = Math.max(0, me.speed - 200 * dt_s);
                if (input.left) me.angle -= 2.5 * dt_s * (me.speed / cfg.speed);
                if (input.right) me.angle += 2.5 * dt_s * (me.speed / cfg.speed);
                me.x += Math.cos(me.angle) * me.speed * dt_s;
                me.y += Math.sin(me.angle) * me.speed * dt_s;
                // Waypoint crossing
                const wp = WAYPOINTS[me.wayptIdx];
                if (Math.hypot(me.x - wp.x, me.y - wp.y) < 40) {
                    me.wayptIdx = (me.wayptIdx + 1) % NW;
                    if (me.wayptIdx === 0) { me.laps++; if (me.laps >= cfg.laps && !over) { me.finished = true; endGame(); } }
                }
                // Boundary
                me.x = Math.max(20, Math.min(W - 20, me.x)); me.y = Math.max(20, Math.min(H - 20, me.y));
                const spd = Math.round(me.speed);
                socket.emit('game-action', { roomCode, action: { type: 'pos', id: me.id, x: me.x, y: me.y, angle: me.angle, laps: me.laps, spd } });
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Track
                ctx.strokeStyle = '#555'; ctx.lineWidth = 60;
                ctx.beginPath();
                for (let i = 0; i < NW; i++) { if (i === 0) ctx.moveTo(WAYPOINTS[i].x, WAYPOINTS[i].y); else ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y); }
                ctx.closePath(); ctx.stroke();
                ctx.strokeStyle = '#888'; ctx.lineWidth = 62; ctx.beginPath(); for (let i = 0; i < NW; i++) { if (i === 0) ctx.moveTo(WAYPOINTS[i].x, WAYPOINTS[i].y); else ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y); } ctx.closePath(); ctx.stroke();
                ctx.fillStyle = cfg.bg; ctx.beginPath(); for (let i = 0; i < NW; i++) { if (i === 0) ctx.moveTo(WAYPOINTS[i].x, WAYPOINTS[i].y); else ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y); } ctx.closePath(); ctx.fill();
                // Road lines
                ctx.strokeStyle = '#fff6'; ctx.lineWidth = 1; ctx.setLineDash([10, 10]);
                ctx.beginPath(); for (let i = 0; i < NW; i++) { if (i === 0) ctx.moveTo(WAYPOINTS[i].x, WAYPOINTS[i].y); else ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y); } ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
                // Finish line
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(CX - TW - 30, CY); ctx.lineTo(CX - TW + 30, CY); ctx.stroke();
                // Cars
                racer.forEach((r, i) => {
                    const data = positions[r.id] || r;
                    ctx.save(); ctx.translate(data.x, data.y); ctx.rotate(data.angle + Math.PI / 2);
                    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(cfg.car, 0, 0); ctx.restore();
                    ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = COLORS[i]; ctx.textBaseline = 'top';
                    ctx.fillText(r.name, data.x, data.y + 14);
                });
                // HUD
                ctx.font = 'bold 14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                racer.forEach((r, i) => {
                    const data = positions[r.id] || r;
                    ctx.fillStyle = COLORS[i]; ctx.fillText(`${r.name}: Lap ${(data.laps || 0) + 1}/${cfg.laps}`, 10, 8 + i * 20);
                });
                ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.font = '12px Inter';
                ctx.fillText('↑ Accelerate  ←→ Steer', W / 2, H - 20);
            }

            function endGame() {
                over = true;
                const finishTimes = racer.map((r, i) => ({ playerId: r.id, score: r.finished ? cfg.laps * 100 : ((positions[r.id] || r).laps || 0) * 100 + Math.round(((positions[r.id] || r).wayptIdx || 0)) }));
                cancelAnimationFrame(animId);
                window.vennaEndGame(finishTimes);
            }

            function gameLoop(ts) {
                if (!lastTime) lastTime = ts;
                const dt = Math.min(ts - lastTime, 100); lastTime = ts;
                if (!over) update(dt);
                draw();
                if (!over) animId = requestAnimationFrame(gameLoop);
            }

            socket.on('game-action', ({ playerId, action }) => {
                if (action.type === 'pos') positions[action.id] = { x: action.x, y: action.y, angle: action.angle, laps: action.laps };
                if (action.type === 'finished' && !over) endGame();
            });

            const kd = e => { if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = true; if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true; if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true; };
            const ku = e => { if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false; if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false; };
            document.addEventListener('keydown', kd);
            document.addEventListener('keyup', ku);
            // Init positions
            racer.forEach(r => { positions[r.id] = { x: r.x, y: r.y, angle: r.angle, laps: 0 }; });
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); socket.off('game-action'); };
        };
    }

    ['racing-cars', 'rat-race', 'slot-cars'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
