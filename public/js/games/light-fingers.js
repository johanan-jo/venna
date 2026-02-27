// Light Fingers — Red Light / Green Light race (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

        let positions = Array(nP).fill(0); // 0–1 (start to finish)
        let light = 'green'; // 'red' or 'green'
        let lightTimer = 0, lightDuration = 2.5;
        let frozen = Array(nP).fill(false);
        let over = false;
        let lastTime = null, animId = null;
        let pressHeld = false;
        let moveAccum = 0; // accumulate movement while key held

        const LANES = ['#1e3a5f', '#1a3a1e', '#3d1f00', '#2d2000'];
        const FINISH = 0.95;

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            // Track
            const trackY = 90, trackH = H - 180;
            const laneW = (W - 80) / nP;

            // Finish line
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(40, trackY + trackH * (1 - FINISH)); ctx.lineTo(W - 40, trackY + trackH * (1 - FINISH)); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#fff'; ctx.font = '12px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText('FINISH', W / 2, trackY + trackH * (1 - FINISH) - 2);

            // Start line
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(40, trackY + trackH); ctx.lineTo(W - 40, trackY + trackH); ctx.stroke();

            players.slice(0, nP).forEach((p, i) => {
                const lx = 40 + i * laneW;
                // Lane bg
                ctx.fillStyle = LANES[i] + 'aa';
                ctx.fillRect(lx, trackY, laneW, trackH);
                // Player token
                const py = trackY + trackH - positions[i] * trackH;
                const radius = 22;
                ctx.beginPath();
                ctx.arc(lx + laneW / 2, py, radius, 0, Math.PI * 2);
                ctx.fillStyle = frozen[i] ? '#4b5563' : COLORS[i];
                ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.name.slice(0, 2).toUpperCase(), lx + laneW / 2, py);
                if (frozen[i]) {
                    ctx.font = '18px serif'; ctx.fillText('🧊', lx + laneW / 2 + 18, py - 18);
                }
                // Progress
                ctx.fillStyle = '#7986a8'; ctx.font = '11px Inter'; ctx.textBaseline = 'top';
                ctx.fillText(`${Math.round(positions[i] * 100)}%`, lx + laneW / 2, trackY + trackH + 4);
            });

            // Traffic light
            const lightX = W / 2, lightY = 40;
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(lightX - 22, lightY - 18, 44, 36, 6); ctx.fill();
            ctx.beginPath(); ctx.arc(lightX - 11, lightY, 10, 0, Math.PI * 2);
            ctx.fillStyle = light === 'red' ? '#ef4444' : '#374151'; ctx.fill();
            ctx.beginPath(); ctx.arc(lightX + 11, lightY, 10, 0, Math.PI * 2);
            ctx.fillStyle = light === 'green' ? '#22c55e' : '#374151'; ctx.fill();

            ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = light === 'green' ? '#22c55e' : '#ef4444';
            ctx.fillText(light === 'green' ? '🟢 GO! Hold SPACE / Click' : '🔴 STOP!', W / 2, H - 28);
        }

        function loop(ts) {
            if (over) return;
            if (!lastTime) lastTime = ts;
            const dt = Math.min((ts - lastTime) / 1000, 0.1);
            lastTime = ts;

            // Switch light
            lightTimer += dt;
            if (lightTimer >= lightDuration) {
                light = light === 'green' ? 'red' : 'green';
                lightTimer = 0;
                lightDuration = 1.5 + Math.random() * 2.5;
                // Catch cheaters on red
                if (light === 'red') {
                    moveAccum = 0; // reset so held press doesn't carry over
                }
            }

            // My movement — only when holding space/click on green
            if (pressHeld && light === 'green' && !frozen[myIdx] && !over) {
                const speed = 0.06;
                positions[myIdx] = Math.min(FINISH, positions[myIdx] + speed * dt);
                socket.emit('game-action', { roomCode, action: { type: 'pos', pi: myIdx, pos: positions[myIdx] } });
                if (positions[myIdx] >= FINISH) checkWin(myIdx);
            }

            draw();
            animId = requestAnimationFrame(loop);
        }

        function checkWin(pi) {
            if (over) return;
            over = true;
            cancelAnimationFrame(animId);
            const winner = pi;
            const results = players.map((p, i) => ({ playerId: p.id, score: i === winner ? 1 : 0 }));
            setTimeout(() => window.vennaEndGame(results), 800);
        }

        function onKeyDown(e) {
            if (e.code === 'Space') { e.preventDefault(); pressHeld = true; }
            if (light === 'red' && pressHeld && !frozen[myIdx]) {
                // Caught moving on red — freeze briefly
                frozen[myIdx] = true;
                positions[myIdx] = Math.max(0, positions[myIdx] - 0.1);
                socket.emit('game-action', { roomCode, action: { type: 'freeze', pi: myIdx, pos: positions[myIdx] } });
                setTimeout(() => { frozen[myIdx] = false; }, 2000);
            }
        }
        function onKeyUp(e) { if (e.code === 'Space') pressHeld = false; }

        let pointerDown = false;
        canvas.addEventListener('pointerdown', () => { pointerDown = true; pressHeld = true; });
        canvas.addEventListener('pointerup', () => { pointerDown = false; pressHeld = false; });

        socket.on('game-action', ({ action }) => {
            if (action.type === 'pos') positions[action.pi] = action.pos;
            if (action.type === 'freeze') { positions[action.pi] = action.pos; frozen[action.pi] = true; setTimeout(() => { frozen[action.pi] = false; }, 2000); }
            if (action.type === 'win') checkWin(action.pi);
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        animId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animId);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            socket.off('game-action');
        };
    }

    G['light-fingers'] = { init };
})();
