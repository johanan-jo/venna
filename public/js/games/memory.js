// Memory Card Matching — 2-4 players
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑', '🥭', '🍍', '🥥', '🍌', '🌸', '🌺', '🌻', '🦋', '🐸', '🐧', '🦊', '🐺', '🦄', '🐬', '🦁', '🐯'];

    function init({ canvas, socket, roomCode, myPlayerId, players, isHost }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const N = 16; // 4x4 grid
        const pairs = EMOJIS.slice(0, N / 2);

        // Start with a placeholder deck; will be replaced once init action received
        let deck = [];

        const scores = {};
        players.forEach(p => scores[p.id] = 0);
        let turnIdx = 0;
        let selected = [];
        let locked = false;
        let over = false;
        const COLS = 4, ROWS = 4;
        const PAD = 20;
        const CW = (W - PAD * 2) / COLS, CH = (H - PAD * 2 - 50) / ROWS;

        function buildDeck(emojis) {
            return emojis.map((e, i) => ({ emoji: e, id: i, flipped: false, matched: false }));
        }

        // Host creates and broadcasts the canonical shuffled order; then also uses it locally
        if (isHost) {
            const pool = [...pairs, ...pairs];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            deck = buildDeck(pool);
            // Emit BEFORE adding listener so guest receives correct order
            socket.emit('game-action', { roomCode, action: { type: 'init', deck: pool } });
        }

        function cardRect(i) {
            return { x: PAD + (i % COLS) * CW, y: 50 + PAD + Math.floor(i / COLS) * CH, w: CW - 6, h: CH - 6 };
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);

            // Score row
            ctx.font = '15px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#7986a8';
            players.forEach((p, i) => { ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10 + i * 140, 6); });

            // Turn indicator
            const isMyTurn = players[turnIdx % players.length]?.id === myPlayerId;
            ctx.textAlign = 'center';
            ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8';
            ctx.fillText(isMyTurn ? 'Your turn!' : `${players[turnIdx % players.length]?.name}'s turn`, W / 2, 6);

            if (deck.length === 0) {
                ctx.fillStyle = '#7986a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Waiting for game to start…', W / 2, H / 2);
                return;
            }

            deck.forEach((card, i) => {
                const { x, y, w, h } = cardRect(i);
                if (card.matched) {
                    ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
                    ctx.font = `${Math.min(w, h) * 0.55}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.globalAlpha = 0.3; ctx.fillText(card.emoji, x + w / 2, y + h / 2); ctx.globalAlpha = 1;
                } else if (card.flipped || selected.includes(i)) {
                    ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
                    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.font = `${Math.min(w, h) * 0.55}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#fff'; ctx.fillText(card.emoji, x + w / 2, y + h / 2);
                } else {
                    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
                    grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(1, '#312e81');
                    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
                    ctx.strokeStyle = '#4338ca'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.font = `${Math.min(w, h) * 0.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#6366f1'; ctx.fillText('🎴', x + w / 2, y + h / 2);
                }
            });
        }

        function checkEnd() {
            if (deck.every(c => c.matched) && !over) {
                over = true;
                const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                setTimeout(() => window.vennaEndGame(results), 1000);
            }
        }

        function handleClick(e) {
            if (locked || over || deck.length === 0) return;
            if (players[turnIdx % players.length]?.id !== myPlayerId) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            for (let i = 0; i < deck.length; i++) {
                const { x, y, w, h } = cardRect(i);
                if (mx >= x && mx <= x + w && my >= y && my <= y + h && !deck[i].matched && !deck[i].flipped && !selected.includes(i)) {
                    const action = { type: 'flip', idx: i };
                    applyFlip(action);
                    socket.emit('game-action', { roomCode, action });
                    break;
                }
            }
        }

        function applyFlip({ idx }) {
            if (!deck[idx] || deck[idx].matched || deck[idx].flipped) return;
            // Mark as flipped so both players see it revealed
            deck[idx].flipped = true;
            selected.push(idx);
            draw();
            if (selected.length === 2) {
                locked = true;
                setTimeout(() => {
                    const [a, b] = selected;
                    if (deck[a].emoji === deck[b].emoji) {
                        deck[a].matched = deck[b].matched = true;
                        deck[a].flipped = deck[b].flipped = false;
                        const pId = players[turnIdx % players.length]?.id;
                        scores[pId] = (scores[pId] || 0) + 1;
                        // Same player goes again
                    } else {
                        deck[a].flipped = deck[b].flipped = false;
                        turnIdx++;
                    }
                    selected = [];
                    locked = false;
                    draw();
                    checkEnd();
                }, 900);
            }
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'init') {
                // Both host and guest sync from canonical deck order
                deck = buildDeck(action.deck);
                draw();
            } else if (action.type === 'flip') {
                applyFlip(action);
            }
        });

        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['memory'] = { init };
})();
