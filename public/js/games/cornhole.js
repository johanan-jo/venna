// Cornhole — Toss beanbags, 3pts hole / 1pt board, first to 21 (2 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const COLORS = ['#ef4444', '#3b82f6'];

        const BOARD = { w: 160, h: 250, holeR: 28 };
        const boardX = W / 2 - BOARD.w / 2;
        const boardY = 80;
        const holeCX = W / 2, holeCY = boardY + 75;
        const launchY = H - 80;

        let scores = [0, 0];
        let bags = []; // { x, y, vx, vy, player, settled: bool, pts }
        let myTurn = myIdx === 0;
        let phase = 'aim'; // 'aim' | 'flying' | 'wait'
        let aimAngle = -Math.PI / 3, power = 0, powerDir = 1;
        let animId = null, over = false;

        function drawBoard() {
            ctx.save(); ctx.translate(W / 2, boardY + BOARD.h / 2 + 10);
            ctx.rotate(-0.15);
            // Board plank
            const grad = ctx.createLinearGradient(-BOARD.w / 2, 0, BOARD.w / 2, 0);
            grad.addColorStop(0, '#92400e'); grad.addColorStop(1, '#78350f');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.roundRect(-BOARD.w / 2, -BOARD.h / 2, BOARD.w, BOARD.h, 8); ctx.fill();
            ctx.strokeStyle = '#451a03'; ctx.lineWidth = 3; ctx.stroke();
            // Hole
            ctx.beginPath(); ctx.arc(0, -BOARD.h / 2 + 75, BOARD.holeR, 0, Math.PI * 2);
            ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        }

        function draw() {
            ctx.fillStyle = '#1a472a'; ctx.fillRect(0, 0, W, H);
            // Grass pattern
            ctx.strokeStyle = '#1b5c32'; ctx.lineWidth = 1;
            for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

            drawBoard();

            // Bags
            bags.forEach(b => {
                ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
                ctx.fillStyle = COLORS[b.player]; ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
                if (b.pts !== undefined) {
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(b.pts > 0 ? '+' + b.pts : '0', b.x, b.y);
                }
            });

            // Aim indicator (my turn only)
            if (phase === 'aim' && myTurn) {
                const sx = W / 2, sy = launchY;
                const ex = sx + Math.cos(aimAngle) * 80 * power;
                const ey = sy + Math.sin(aimAngle) * 80 * power;
                ctx.strokeStyle = COLORS[myIdx] + '99'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
                ctx.setLineDash([]);
                // Power bar
                ctx.fillStyle = '#111'; ctx.fillRect(W / 2 - 60, H - 24, 120, 12);
                ctx.fillStyle = `hsl(${120 - power * 120}, 90%, 50%)`; ctx.fillRect(W / 2 - 60, H - 24, 120 * power, 12);

                // Aim bar (horizontal)
                const aim01 = (aimAngle + Math.PI) / Math.PI;
                ctx.fillStyle = '#111'; ctx.fillRect(W / 2 - 60, H - 40, 120, 10);
                ctx.fillStyle = '#818cf8'; ctx.fillRect(W / 2 - 60, H - 40, 120 * aim01, 10);
            }

            // Scores
            ctx.font = 'bold 18px Inter'; ctx.textBaseline = 'top';
            ctx.fillStyle = COLORS[0]; ctx.textAlign = 'left'; ctx.fillText(`${players[0].name}: ${scores[0]}`, 12, 12);
            ctx.fillStyle = COLORS[1]; ctx.textAlign = 'right'; ctx.fillText(`${players[1].name}: ${scores[1]}`, W - 12, 12);

            // Status
            ctx.font = '13px Inter'; ctx.fillStyle = '#d1fae5'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(myTurn ? (phase === 'aim' ? 'Click to lock aim, then click again to throw!' : '') : "Opponent's turn…", W / 2, H - 4);
        }

        let aimLocked = false;
        function handleClick() {
            if (!myTurn || phase !== 'aim' || over) return;
            if (!aimLocked) { aimLocked = true; return; }
            // Second click: throw
            aimLocked = false;
            const spd = power * 15 + 5;
            const vx = Math.cos(aimAngle) * spd;
            const vy = Math.sin(aimAngle) * spd;
            const bag = { x: W / 2, y: launchY, vx, vy, player: myIdx, settled: false };
            bags.push(bag);
            phase = 'flying';
            myTurn = false;
            socket.emit('game-action', { roomCode, action: { type: 'throw', pi: myIdx, vx, vy } });
        }

        function simulate() {
            bags.forEach(b => {
                if (b.settled) return;
                b.x += b.vx; b.y += b.vy; b.vy += 0.4; // gravity
                b.vx *= 0.98;
                // Check hole
                if (Math.hypot(b.x - holeCX, b.y - holeCY) < BOARD.holeR && b.vy > 0) {
                    b.settled = true; b.pts = 3; scores[b.player] += 3;
                    afterSettle();
                }
                // Check board
                if (b.y > boardY && b.y < boardY + BOARD.h && b.x > boardX && b.x < boardX + BOARD.w && !b.settled) {
                    b.y = boardY; b.vy *= -0.3; b.vx *= 0.8;
                    if (Math.abs(b.vy) < 0.5) { b.settled = true; b.pts = 1; scores[b.player] += 1; afterSettle(); }
                }
                // Hit ground
                if (b.y > H - 20 && !b.settled) { b.settled = true; b.pts = 0; afterSettle(); }
            });
        }

        function afterSettle() {
            if (scores[0] >= 21 || scores[1] >= 21) {
                over = true;
                const winner = scores[0] >= 21 ? 0 : 1;
                const results = players.map((p, i) => ({ playerId: p.id, score: scores[i] }));
                setTimeout(() => window.vennaEndGame(results), 1000); return;
            }
            // Switch turn
            phase = 'aim'; power = 0; aimLocked = false;
            myTurn = !myTurn;
        }

        function animate() {
            if (!over) {
                if (phase === 'aim' && myTurn) {
                    aimAngle += 0.02 * (aimAngle < -Math.PI * 0.1 ? 1 : aimAngle > -Math.PI * 0.9 ? -1 : 1);
                    if (!aimLocked) { power += 0.02 * powerDir; if (power >= 1 || power <= 0) powerDir *= -1; }
                }
                simulate();
                draw();
            }
            animId = requestAnimationFrame(animate);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'throw') {
                const bag = { x: W / 2, y: launchY, vx: action.vx, vy: action.vy, player: action.pi, settled: false };
                bags.push(bag);
                phase = 'flying'; myTurn = myIdx !== action.pi;
            }
        });

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(animate);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['cornhole'] = { init };
})();
