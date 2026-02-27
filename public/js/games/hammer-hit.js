// Hammer Hit — Sweet spot reflex game (2-4 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const ROUNDS = 7;

        let scores = Array(nP).fill(0);
        let round = 0;
        let indicators = Array(nP).fill(null).map(() => ({ pos: 0, speed: 1.5, dir: 1, locked: false, result: null }));
        let over = false;
        let animId = null;

        const BAR_W = 320, BAR_H = 32;
        const SWEET = { start: 0.42, end: 0.58 }; // sweet spot 42%-58%
        const GOOD = { start: 0.3, end: 0.7 };

        function layout(i) {
            const cols = nP <= 2 ? 1 : 2;
            const rows = Math.ceil(nP / cols);
            const col = nP <= 2 ? 0 : i % cols;
            const row = Math.floor(i / cols);
            const panelW = W / (nP <= 2 ? 1 : cols);
            const panelH = H / rows;
            return { cx: panelW * col + panelW / 2, cy: panelH * row + panelH / 2, panelW, panelH };
        }

        function drawPanel(i) {
            const ind = indicators[i];
            const { cx, cy } = layout(i);
            const bx = cx - BAR_W / 2, by = cy - 30;
            const isMe = i === myIdx;

            // Panel bg
            ctx.fillStyle = '#111827'; ctx.beginPath();
            ctx.roundRect(cx - BAR_W / 2 - 20, cy - 90, BAR_W + 40, 180, 12); ctx.fill();

            // Player name
            ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillStyle = COLORS[i];
            ctx.fillText(`${players[i].name}${isMe ? ' (you)' : ''}  —  Score: ${scores[i]}`, cx, cy - 55);

            // Bar background
            ctx.fillStyle = '#1f2937'; ctx.fillRect(bx, by, BAR_W, BAR_H);
            // Good zone
            ctx.fillStyle = '#ca8a04'; ctx.fillRect(bx + BAR_W * GOOD.start, by, BAR_W * (GOOD.end - GOOD.start), BAR_H);
            // Sweet spot
            ctx.fillStyle = '#16a34a'; ctx.fillRect(bx + BAR_W * SWEET.start, by, BAR_W * (SWEET.end - SWEET.start), BAR_H);
            ctx.fillStyle = '#86efac'; ctx.font = '10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SWEET SPOT', bx + BAR_W * (SWEET.start + SWEET.end) / 2, by + BAR_H / 2);

            // Indicator line
            if (!ind.locked) {
                ctx.fillStyle = '#fff'; ctx.fillRect(bx + BAR_W * ind.pos - 2, by - 4, 4, BAR_H + 8);
            }

            // Result
            if (ind.result !== null) {
                const label = ind.result === 2 ? '🔥 PERFECT!' : ind.result === 1 ? '👍 GOOD!' : '💨 MISS!';
                const col = ind.result === 2 ? '#22c55e' : ind.result === 1 ? '#eab308' : '#ef4444';
                ctx.fillStyle = col; ctx.font = 'bold 22px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(label, cx, by + BAR_H + 14);
            }

            // Round / hammer emoji
            ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🔨', cx, cy + 65);
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(`Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}  —  Click or press SPACE to hammer!`, W / 2, 8);
            for (let i = 0; i < nP; i++) drawPanel(i);
        }

        function animate() {
            if (over) return;
            indicators.forEach((ind, i) => {
                if (ind.locked) return;
                ind.pos += ind.speed * ind.dir * 0.016;
                if (ind.pos >= 1) { ind.pos = 1; ind.dir = -1; }
                if (ind.pos <= 0) { ind.pos = 0; ind.dir = 1; }
            });
            draw();
            animId = requestAnimationFrame(animate);
        }

        function computeScore(pos) {
            if (pos >= SWEET.start && pos <= SWEET.end) return 2;
            if (pos >= GOOD.start && pos <= GOOD.end) return 1;
            return 0;
        }

        function hammer(playerIdx) {
            const ind = indicators[playerIdx];
            if (ind.locked || over) return;
            ind.locked = true;
            const pts = computeScore(ind.pos);
            ind.result = pts;
            scores[playerIdx] += pts;
            // Check if all players have hammered
            setTimeout(() => {
                if (indicators.every(ind => ind.locked)) {
                    round++;
                    if (round >= ROUNDS) {
                        over = true;
                        cancelAnimationFrame(animId);
                        const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                        draw();
                        setTimeout(() => window.vennaEndGame(results), 1200);
                    } else {
                        // Next round: reset, increase speed
                        indicators = indicators.map((_, i) => ({
                            pos: Math.random(), speed: 1.5 + round * 0.4, dir: Math.random() > 0.5 ? 1 : -1, locked: false, result: null
                        }));
                    }
                }
            }, 800);
        }

        function handleKey(e) {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); triggerMyHammer(); }
        }

        function triggerMyHammer() {
            if (indicators[myIdx].locked || over) return;
            const pos = indicators[myIdx].pos;
            hammer(myIdx);
            socket.emit('game-action', { roomCode, action: { type: 'hammer', pi: myIdx, pos } });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'hammer') {
                indicators[action.pi].pos = action.pos;
                hammer(action.pi);
            }
        });

        canvas.addEventListener('click', triggerMyHammer);
        document.addEventListener('keydown', handleKey);
        animate();
        return () => {
            cancelAnimationFrame(animId);
            canvas.removeEventListener('click', triggerMyHammer);
            document.removeEventListener('keydown', handleKey);
            socket.off('game-action');
        };
    }

    G['hammer-hit'] = { init };
})();
