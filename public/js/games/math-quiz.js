// Math Quiz — fastest to answer wins points
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
        const ids = players.map(p => p.id);
        let question = null, answers = [], correctIdx = -1;
        let scores = {};
        players.forEach(p => scores[p.id] = 0);
        let round = 0, maxRounds = 10, over = false, feedback = '', feedbackTimer = 0;
        let animId, lastTime = 0;
        let answered = false;

        function genQuestion() {
            const ops = ['+', '-', '×'];
            const op = ops[Math.floor(Math.random() * ops.length)];
            let a, b, correct;
            if (op === '+') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1; correct = a + b; }
            else if (op === '-') { a = Math.floor(Math.random() * 50) + 20; b = Math.floor(Math.random() * a) + 1; correct = a - b; }
            else { a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1; correct = a * b; }
            question = `${a} ${op} ${b} = ?`;
            // Build 4 answer choices
            const set = new Set([correct]);
            while (set.size < 4) { const wrong = correct + Math.floor(Math.random() * 20) - 10; if (wrong !== correct && wrong > 0) set.add(wrong); }
            answers = [...set].sort(() => Math.random() - 0.5);
            correctIdx = answers.indexOf(correct);
            answered = false;
            if (isHost) socket.emit('game-action', { roomCode, action: { type: 'question', question, answers, correctIdx } });
        }

        if (isHost) setTimeout(genQuestion, 500);

        function draw() {
            ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, W, H);
            ctx.font = 'bold 22px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
            ctx.fillText(`Round ${Math.min(round + 1, maxRounds)} / ${maxRounds}`, W / 2, 16);
            // Scores
            players.forEach((p, i) => { ctx.font = '14px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'left'; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 48 + i * 22); });
            if (question) {
                ctx.font = 'bold 30px Outfit'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8eaf6';
                ctx.fillText(question, W / 2, H * 0.28);
                answers.forEach((ans, i) => {
                    const cols = 2, col = i % cols, row = Math.floor(i / cols);
                    const bw = (W - 80) / cols, bh = 60, bx = 40 + col * bw, by = H * 0.45 + row * (bh + 16);
                    const ANSCOLORS = ['#7c3aed', '#ec4899', '#10b981', '#f97316'];
                    ctx.fillStyle = ANSCOLORS[i]; ctx.beginPath(); ctx.roundRect(bx, by, bw - 10, bh, 10); ctx.fill();
                    ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
                    ctx.fillText(ans, bx + (bw - 10) / 2, by + bh / 2);
                });
            }
            if (feedback) { ctx.font = 'bold 22px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = feedback.startsWith('✅') ? '#10b981' : '#ef4444'; ctx.fillText(feedback, W / 2, H - 12); }
            if (!question) { ctx.font = '18px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7986a8'; ctx.fillText('Waiting for question…', W / 2, H / 2); }
        }

        function handleClick(e) {
            if (!question || answered || over) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            answers.forEach((ans, i) => {
                const cols = 2, col = i % cols, row = Math.floor(i / cols);
                const bw = (W - 80) / cols, bh = 60, bx = 40 + col * bw, by = H * 0.45 + row * (bh + 16);
                if (mx >= bx && mx <= bx + bw - 10 && my >= by && my <= by + bh) {
                    answered = true;
                    const correct = i === correctIdx;
                    if (correct) { scores[myPlayerId] = (scores[myPlayerId] || 0) + 10; feedback = '✅ Correct! +10'; }
                    else feedback = '❌ Wrong!';
                    socket.emit('game-action', { roomCode, action: { type: 'answer', playerId: myPlayerId, correct, idx: i } });
                    feedbackTimer = 2000;
                }
            });
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'question') { question = action.question; answers = action.answers; correctIdx = action.correctIdx; answered = false; feedback = ''; }
            if (action.type === 'answer') {
                if (action.correct) scores[action.playerId] = (scores[action.playerId] || 0) + 10;
                if (action.playerId !== myPlayerId) { const p = players.find(p => p.id === action.playerId); feedback = `${p?.name} answered ${action.correct ? 'correctly!' : 'wrong!'}`; feedbackTimer = 1500; }
                // Move to next question after delay (host drives)
                if (isHost) { round++; if (round >= maxRounds) { setTimeout(() => { over = true; const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 })); window.vennaEndGame(results); }, 1500); } else { setTimeout(genQuestion, 2500); } }
            }
        });

        canvas.addEventListener('click', handleClick);

        function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (feedbackTimer > 0) { feedbackTimer -= dt; if (feedbackTimer <= 0) { feedback = ''; } } draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
        animId = requestAnimationFrame(gameLoop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['math-quiz'] = { init };
})();
