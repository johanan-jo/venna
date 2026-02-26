// Hot Potato — pass the potato before it explodes
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = players.length;
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6'];
        let holderIdx = Math.floor(Math.random() * nP);
        let timeLeft = 5 + Math.random() * 8; // random fuse
        let round = 1, maxRounds = 5, eliminated = new Set(), over = false;
        let animId, lastTime = 0;
        let shaking = false;
        // Broadcast initial state from host
        if (isHost) {
            socket.emit('game-action', { roomCode, action: { type: 'init', holderIdx, timeLeft } });
        }

        const WIN_SCORES = {};
        players.forEach(p => WIN_SCORES[p.id] = 0);

        function draw() {
            ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, W, H);
            // Players arranged in a circle
            const cx = W / 2, cy = H / 2, pr = Math.min(W, H) * 0.3;
            players.forEach((p, i) => {
                const ang = (i / nP) * Math.PI * 2 - Math.PI / 2;
                const px = cx + Math.cos(ang) * pr, py = cy + Math.sin(ang) * pr;
                const isHolder = i === holderIdx, isElim = eliminated.has(i);
                ctx.globalAlpha = isElim ? 0.3 : 1;
                ctx.fillStyle = isHolder ? COLORS[i] : '#2a2a2a'; ctx.beginPath(); ctx.arc(px, py, 36, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = isHolder ? '#f59e0b' : '#555'; ctx.lineWidth = isHolder ? 4 : 2; ctx.stroke();
                ctx.font = '14px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.name.slice(0, 8), px, py);
                if (isHolder && !isElim) {
                    const shake = shaking ? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 } : { x: 0, y: 0 };
                    ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('🥔', px + shake.x, py - 56 + shake.y);
                }
                if (isElim) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💀', px, py - 48); }
                ctx.globalAlpha = 1;
            });
            // Timer
            ctx.font = 'bold 28px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const tPct = timeLeft / (5 + 8);
            ctx.fillStyle = tPct > 0.5 ? '#10b981' : tPct > 0.25 ? '#f59e0b' : '#ef4444';
            ctx.fillText(`🔥 ${timeLeft.toFixed(1)}s`, W / 2, 16);
            // Round
            ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.fillText(`Round ${round}/${maxRounds}`, W / 2, 52);
            // Pass button
            if (ids[holderIdx] === myPlayerId && !over) {
                ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.roundRect(W / 2 - 70, H - 60, 140, 46, 10); ctx.fill();
                ctx.font = 'bold 16px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('🥔 PASS!', W / 2, H - 37);
            } else if (ids[holderIdx] !== myPlayerId) {
                ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`${players[holderIdx]?.name} has the potato!`, W / 2, H - 8);
            }
        }

        function passTo(toIdx) {
            socket.emit('game-action', { roomCode, action: { type: 'pass', toIdx } });
            holderIdx = toIdx;
        }

        function handleClick(e) {
            if (over || ids[holderIdx] !== myPlayerId) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            // Pass button
            if (my > H - 64 && my < H - 14 && mx > W / 2 - 74 && mx < W / 2 + 74) {
                let available = [];
                for (let i = 0; i < nP; i++) if (i !== holderIdx && !eliminated.has(i)) available.push(i);
                if (available.length > 0) passTo(available[Math.floor(Math.random() * available.length)]);
            }
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'init') { holderIdx = action.holderIdx; timeLeft = action.timeLeft; }
            if (action.type === 'pass') holderIdx = action.toIdx;
            if (action.type === 'explode') {
                eliminated.add(action.holderIdx);
                // New round
                let available = []; for (let i = 0; i < nP; i++) if (!eliminated.has(i)) available.push(i);
                holderIdx = available[Math.floor(Math.random() * available.length)] || 0;
                timeLeft = 4 + Math.random() * 7; round++;
                if (available.length <= 1 || round > maxRounds) {
                    over = true;
                    const winner = available[0] !== undefined ? ids[available[0]] : null;
                    const results = players.map((p, i) => ({ playerId: p.id, score: !eliminated.has(i) ? 10 : Math.max(0, 10 - [...eliminated].indexOf(i) * 2) }));
                    setTimeout(() => window.vennaEndGame(results), 1000);
                }
            }
        });

        function gameLoop(ts) {
            if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts;
            if (!over && isHost) {
                timeLeft -= dt / 1000;
                shaking = timeLeft < 2;
                if (timeLeft <= 0) {
                    const action = { type: 'explode', holderIdx };
                    socket.emit('game-action', { roomCode, action });
                    // Apply locally too
                    eliminated.add(holderIdx);
                    let available = []; for (let i = 0; i < nP; i++) if (!eliminated.has(i)) available.push(i);
                    holderIdx = available[Math.floor(Math.random() * available.length)] || 0;
                    timeLeft = 4 + Math.random() * 7; round++;
                    if (available.length <= 1 || round > maxRounds) {
                        over = true;
                        const results = players.map((p, i) => ({ playerId: p.id, score: !eliminated.has(i) ? 10 : Math.max(0, 10 - [...eliminated].indexOf(i) * 2) }));
                        setTimeout(() => window.vennaEndGame(results), 1000);
                    }
                }
            }
            draw();
            if (!over) animId = requestAnimationFrame(gameLoop);
        }

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['hot-potato'] = { init };
})();
