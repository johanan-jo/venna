// Knife Hit — click to throw knives at rotating target
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        let targetAngle = 0, rotSpeed = 0.02, scores = {};
        players.forEach(p => scores[p.id] = 0);
        let knivesInTarget = [];
        let myKnivesLeft = 8, round = 1, maxRounds = 3, over = false, animId, lastTime = 0;
        let failed = false, successFlash = 0;
        const CX = W / 2, CY = H / 2 - 30, TARGET_R = 70;

        function draw() {
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
            ctx.save(); ctx.translate(CX, CY); ctx.rotate(targetAngle);
            // Target log
            ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.arc(0, 0, TARGET_R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = 8; ctx.stroke();
            // Concentric rings
            [50, 35, 20].forEach((r, i) => { ctx.strokeStyle = ['#fff3', '#fff2', '#fff1'][i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); });
            // Knives in target
            knivesInTarget.forEach(kn => {
                ctx.save(); ctx.rotate(kn.angle - targetAngle);
                ctx.strokeStyle = COLORS[kn.pi]; ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(0, -TARGET_R); ctx.lineTo(0, -TARGET_R - 35); ctx.stroke();
                ctx.fillStyle = COLORS[kn.pi]; ctx.beginPath(); ctx.moveTo(-4, -TARGET_R - 35); ctx.lineTo(4, -TARGET_R - 35); ctx.lineTo(0, -TARGET_R - 50); ctx.fill();
                ctx.restore();
            });
            ctx.restore();
            // Fail flash
            if (failed) { ctx.fillStyle = 'rgba(239,68,68,0.3)'; ctx.fillRect(0, 0, W, H); }
            if (successFlash > 0) { ctx.fillStyle = `rgba(16,185,129,${successFlash / 10})`; ctx.fillRect(0, 0, W, H); successFlash--; }
            // Knife slots (bottom)
            const myPi = ids.indexOf(myPlayerId);
            for (let i = 0; i < myKnivesLeft; i++) {
                ctx.strokeStyle = COLORS[myPi]; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(W / 2 - 40 + i * 12, H - 20); ctx.lineTo(W / 2 - 40 + i * 12, H - 44); ctx.stroke();
                ctx.fillStyle = COLORS[myPi]; ctx.beginPath(); ctx.moveTo(W / 2 - 44 + i * 12, H - 44); ctx.lineTo(W / 2 - 36 + i * 12, H - 44); ctx.lineTo(W / 2 - 40 + i * 12, H - 60); ctx.fill();
            }
            // Scores
            ctx.font = '14px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            players.forEach((p, i) => { ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 8 + i * 20); });
            ctx.textAlign = 'center'; ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8';
            ctx.fillText(`Round ${round}/${maxRounds}  •  Click to throw!`, W / 2, H - 70);
            if (failed) { ctx.font = 'bold 22px Outfit'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.fillText('HIT A KNIFE! 😱', W / 2, H * 0.35); }
        }

        function throwKnife() {
            if (over || failed || myKnivesLeft <= 0) return;
            const pi = ids.indexOf(myPlayerId);
            // Check collision with existing knives
            const HIT_THRESH = 0.12;
            const hit = knivesInTarget.some(kn => { const diff = ((targetAngle - kn.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return diff < HIT_THRESH || (Math.PI * 2 - diff) < HIT_THRESH; });
            if (hit) { failed = true; socket.emit('game-action', { roomCode, action: { type: 'fail', playerId: myPlayerId } }); setTimeout(() => { failed = false; myKnivesLeft = 0; nextRound(); }, 1500); return; }
            knivesInTarget.push({ angle: targetAngle, pi });
            scores[myPlayerId] = (scores[myPlayerId] || 0) + 10;
            successFlash = 8;
            myKnivesLeft--;
            socket.emit('game-action', { roomCode, action: { type: 'throw', angle: targetAngle, pi, playerId: myPlayerId } });
            if (myKnivesLeft <= 0) setTimeout(nextRound, 1000);
        }

        function nextRound() {
            if (round >= maxRounds || over) {
                over = true;
                const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                window.vennaEndGame(results); return;
            }
            round++;
            knivesInTarget = [];
            myKnivesLeft = 8;
            rotSpeed = 0.02 + round * 0.01;
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'throw' && action.playerId !== myPlayerId) { knivesInTarget.push({ angle: action.angle, pi: action.pi }); scores[action.playerId] = (scores[action.playerId] || 0) + 10; }
            if (action.type === 'fail' && action.playerId !== myPlayerId) { scores[action.playerId] = Math.max(0, (scores[action.playerId] || 0) - 20); }
        });

        canvas.addEventListener('click', throwKnife);
        document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); throwKnife(); } });

        function gameLoop(ts) {
            if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts;
            if (!over && !failed) targetAngle += rotSpeed * (dt / 16);
            draw();
            if (!over) animId = requestAnimationFrame(gameLoop);
        }
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', throwKnife); socket.off('game-action'); };
    }

    G['knife-hit'] = { init };
})();
