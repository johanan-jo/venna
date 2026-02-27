// Last Sashimi — Musical chairs: grab the sushi when it appears!
// Edge Case: Simultaneous grab within 16ms (one frame) → tie → split / nobody scores
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const SUSHI = ['🍣', '🍱', '🦪', '🍤', '🍙', '🥟', '🍜', '🥡'];
        const ROUNDS = 6;
        const SIMUL_WINDOW_MS = 16; // same-frame tie threshold

        let scores = Array(nP).fill(0);
        let round = 0;
        let phase = 'waiting';
        let countdownVal = 0, countdownTimer = 0;
        let sushiVisible = false, sushiGrabbed = false, grabber = -1;
        let flashMsg = '', flashTimer = 0;
        let animId = null, lastTs = null;
        let sushiX = W / 2, sushiY = H / 2;
        let currentSushi = SUSHI[0];
        let over = false;

        // ── Simultaneous grab tracking
        let grabQueue = []; // { pi, ts } pairs received this round
        let grabResolutionTimer = null;

        function startRound() {
            if (round >= ROUNDS) { endGame(); return; }
            phase = 'countdown';
            sushiVisible = false; sushiGrabbed = false; grabber = -1;
            countdownVal = Math.floor(Math.random() * 5) + 3;
            countdownTimer = countdownVal;
            currentSushi = SUSHI[Math.floor(Math.random() * SUSHI.length)];
            sushiX = W * 0.2 + Math.random() * W * 0.6;
            sushiY = H * 0.2 + Math.random() * H * 0.5;
            flashMsg = ''; flashTimer = 0;
            grabQueue = [];
        }

        function resolveGrab() {
            // Called after a short window to collect all simultaneous claims
            if (sushiGrabbed || grabQueue.length === 0) return;
            sushiGrabbed = true;

            if (grabQueue.length === 1) {
                // Clear winner
                const { pi } = grabQueue[0];
                grabber = pi; scores[pi]++;
                flashMsg = `${players[pi].name} grabbed the sushi! 🎉`;
            } else {
                // ── Simultaneous grab: check if first two are within 16ms of each other
                grabQueue.sort((a, b) => a.ts - b.ts);
                const tDiff = grabQueue[1].ts - grabQueue[0].ts;
                if (tDiff <= SIMUL_WINDOW_MS) {
                    // True tie: nobody scores (fairest outcome for async networks)
                    flashMsg = `⏰ Simultaneous grab! Nobody scores this round.`;
                } else {
                    // Clear winner by timestamp
                    const { pi } = grabQueue[0];
                    grabber = pi; scores[pi]++;
                    flashMsg = `${players[pi].name} grabbed the sushi! 🎉`;
                }
            }

            flashTimer = 2;
            round++;
            setTimeout(() => { if (!over) startRound(); }, 2000);
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H));
            grad.addColorStop(0, '#1e1208'); grad.addColorStop(1, '#0d0f1a');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

            ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.45, H * 0.35, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#2d1810'; ctx.fill();
            ctx.strokeStyle = '#92400e'; ctx.lineWidth = 8; ctx.stroke();

            ctx.font = 'bold 14px Inter'; ctx.textBaseline = 'top';
            players.slice(0, nP).forEach((p, i) => {
                ctx.fillStyle = COLORS[i]; ctx.textAlign = i % 2 === 0 ? 'left' : 'right';
                ctx.fillText(`${p.name}: ${scores[i]}🍣`, i % 2 === 0 ? 10 : W - 10, 10 + Math.floor(i / 2) * 22);
            });
            ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center';
            ctx.fillText(`Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`, W / 2, 10);

            if (phase === 'countdown') {
                ctx.fillStyle = '#94a3b8'; ctx.font = '15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`Sushi coming in… ${Math.ceil(countdownTimer)}`, W / 2, H - 40);
                const barW = 300, barH = 10;
                ctx.fillStyle = '#1f2937'; ctx.fillRect(W / 2 - barW / 2, H - 24, barW, barH);
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(W / 2 - barW / 2, H - 24, barW * (1 - countdownTimer / countdownVal), barH);
            }

            if (sushiVisible && !sushiGrabbed) {
                const grd = ctx.createRadialGradient(sushiX, sushiY, 10, sushiX, sushiY, 60);
                grd.addColorStop(0, '#f59e0b55'); grd.addColorStop(1, 'transparent');
                ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sushiX, sushiY, 60, 0, Math.PI * 2); ctx.fill();
                ctx.font = '52px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(currentSushi, sushiX, sushiY);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter'; ctx.textBaseline = 'top';
                ctx.fillText('CLICK IT!', sushiX, sushiY + 35);
            }

            if (flashMsg && flashTimer > 0) {
                ctx.globalAlpha = Math.min(1, flashTimer / 0.3);
                ctx.fillStyle = flashTimer > 1.5 ? '#facc15' : '#94a3b8';
                ctx.font = 'bold 26px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(flashMsg, W / 2, H / 2 + 60);
                ctx.globalAlpha = 1;
            }
        }

        function loop(ts) {
            if (over) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.1);
            lastTs = ts;

            if (phase === 'countdown') {
                countdownTimer -= dt;
                if (countdownTimer <= 0) {
                    phase = 'grab'; sushiVisible = true;
                    if (isHost) socket.emit('game-action', { roomCode, action: { type: 'sushi-reveal', x: sushiX, y: sushiY, emoji: currentSushi } });
                }
            }
            if (flashTimer > 0) flashTimer -= dt;
            draw(); animId = requestAnimationFrame(loop);
        }

        function handleClick(e) {
            if (phase !== 'grab' || sushiGrabbed || over) return;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (canvas.height / rect.height);
            if (Math.hypot(mx - sushiX, my - sushiY) > 60) return;

            const claimTs = Date.now();
            socket.emit('game-action', { roomCode, action: { type: 'grab', pi: myIdx, ts: claimTs } });
            // Register my own grab locally too
            grabQueue.push({ pi: myIdx, ts: claimTs });
            // Wait one frame window for other simultaneous grabs before resolving
            clearTimeout(grabResolutionTimer);
            grabResolutionTimer = setTimeout(resolveGrab, SIMUL_WINDOW_MS + 5);
        }

        function endGame() {
            over = true; cancelAnimationFrame(animId);
            const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
            setTimeout(() => window.vennaEndGame(results), 500);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'sushi-reveal') {
                phase = 'grab'; sushiVisible = true;
                sushiX = action.x; sushiY = action.y; currentSushi = action.emoji;
            }
            if (action.type === 'grab' && !sushiGrabbed) {
                grabQueue.push({ pi: action.pi, ts: action.ts });
                clearTimeout(grabResolutionTimer);
                grabResolutionTimer = setTimeout(resolveGrab, SIMUL_WINDOW_MS + 5);
            }
        });

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(loop);
        startRound();
        return () => {
            cancelAnimationFrame(animId);
            clearTimeout(grabResolutionTimer);
            canvas.removeEventListener('click', handleClick);
            socket.off('game-action');
        };
    }

    G['last-sashimi'] = { init };
})();
