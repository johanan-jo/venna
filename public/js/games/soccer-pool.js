// Soccer Pool — Pool/billiards mechanics with soccer theme (2 players)
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const myIdx = ids.indexOf(myPlayerId);
        const COLORS = ['#ef4444', '#3b82f6'];

        const POCKET_R = 18, BALL_R = 12, FRICTION = 0.985;
        const pockets = [
            { x: 50, y: 50 }, { x: W / 2, y: 40 }, { x: W - 50, y: 50 },
            { x: 50, y: H - 50 }, { x: W / 2, y: H - 40 }, { x: W - 50, y: H - 50 },
        ];

        // Balls: type 0=cue, 1-7=player0, 8=8ball, 9-15=player1
        function makeBalls() {
            const balls = [];
            // Cue ball
            balls.push({ x: W * 0.25, y: H / 2, vx: 0, vy: 0, r: BALL_R, type: 'cue', sunk: false });
            // Rack
            const rx = W * 0.65, ry = H / 2;
            const rack = [
                [0, 0], [1, 0.5], [1, -0.5], [2, 1], [2, 0], [2, -1],
                [3, 1.5], [3, 0.5], [3, -0.5], [3, -1.5], [4, 2], [4, 1], [4, 0], [4, -1], [4, -2]
            ];
            rack.forEach(([row, col], i) => {
                const bx = rx + row * BALL_R * 2.1, by = ry + col * BALL_R * 2.1;
                const type = i === 7 ? '8ball' : i < 7 ? 0 : 1;
                balls.push({ x: bx, y: by, vx: 0, vy: 0, r: BALL_R, type, sunk: false });
            });
            return balls;
        }

        let balls = makeBalls();
        let scores = [0, 0];
        let myTurn = myIdx === 0;
        let phase = 'aim'; // aim | shooting | waiting
        let aimAngle = 0, power = 0, powerDir = 1;
        let over = false, animId = null;
        let msg = '';

        function drawTable() {
            ctx.fillStyle = '#166534'; ctx.fillRect(40, 30, W - 80, H - 60);
            ctx.strokeStyle = '#92400e'; ctx.lineWidth = 18;
            ctx.strokeRect(40, 30, W - 80, H - 60);
            // Pockets
            pockets.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
                ctx.fillStyle = '#000'; ctx.fill();
                ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.stroke();
            });
        }

        function drawBall(b) {
            if (b.sunk) return;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            if (b.type === 'cue') { ctx.fillStyle = '#fff'; }
            else if (b.type === '8ball') { ctx.fillStyle = '#111'; }
            else { ctx.fillStyle = b.type === 0 ? COLORS[0] : COLORS[1]; }
            ctx.fill();
            ctx.strokeStyle = '#00000044'; ctx.lineWidth = 1; ctx.stroke();
            if (b.type === 'cue') { ctx.fillStyle = '#94a3b8'; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚽', b.x, b.y); }
            if (b.type === '8ball') { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('8', b.x, b.y); }
        }

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            drawTable();
            balls.forEach(drawBall);

            // Aim line
            if (phase === 'aim' && myTurn) {
                const cue = balls[0];
                ctx.setLineDash([6, 5]);
                ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(cue.x, cue.y);
                ctx.lineTo(cue.x - Math.cos(aimAngle) * power * 12, cue.y - Math.sin(aimAngle) * power * 12);
                ctx.stroke(); ctx.setLineDash([]);
                // Power bar
                ctx.fillStyle = '#111'; ctx.fillRect(W / 2 - 60, H - 22, 120, 10);
                ctx.fillStyle = `hsl(${120 - power / 20 * 120}, 90%, 45%)`; ctx.fillRect(W / 2 - 60, H - 22, 120 * power / 20, 10);
            }

            // Scores + status
            ctx.fillStyle = COLORS[0]; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(`${players[0].name}: ${scores[0]}`, 52, 36);
            ctx.fillStyle = COLORS[1]; ctx.textAlign = 'right';
            ctx.fillText(`${players[1].name}: ${scores[1]}`, W - 52, 36);
            ctx.fillStyle = '#d1fae5'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.font = '12px Inter';
            ctx.fillText(msg || (myTurn ? 'Click to lock aim / click again to shoot!' : "Opponent's turn…"), W / 2, H - 6);
        }

        let aimLocked = false;
        function handleClick(e) {
            if (!myTurn || phase !== 'aim' || over) return;
            if (!aimLocked) { aimLocked = true; return; }
            aimLocked = false;
            const cue = balls[0];
            cue.vx = Math.cos(aimAngle) * power;
            cue.vy = Math.sin(aimAngle) * power;
            phase = 'shooting';
            socket.emit('game-action', { roomCode, action: { type: 'shoot', vx: cue.vx, vy: cue.vy } });
        }

        function simulate() {
            let moving = false;
            balls.forEach(b => {
                if (b.sunk) return;
                b.x += b.vx; b.y += b.vy;
                b.vx *= FRICTION; b.vy *= FRICTION;
                if (Math.abs(b.vx) < 0.05 && Math.abs(b.vy) < 0.05) { b.vx = b.vy = 0; } else moving = true;
                // Wall bounce
                if (b.x - b.r < 50) { b.x = 50 + b.r; b.vx *= -0.7; }
                if (b.x + b.r > W - 50) { b.x = W - 50 - b.r; b.vx *= -0.7; }
                if (b.y - b.r < 40) { b.y = 40 + b.r; b.vy *= -0.7; }
                if (b.y + b.r > H - 40) { b.y = H - 40 - b.r; b.vy *= -0.7; }
                // Pocket
                pockets.forEach(pk => {
                    if (Math.hypot(b.x - pk.x, b.y - pk.y) < POCKET_R) {
                        b.sunk = true; b.vx = b.vy = 0;
                        if (b.type === 'cue') { b.x = W * 0.25; b.y = H / 2; b.sunk = false; } // respawn
                        else if (b.type === '8ball') { endGame(myTurn ? 0 : 1 /* other wins */); }
                        else { scores[b.type]++; }
                    }
                });
            });
            // Ball-ball collisions
            for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
                const a = balls[i], b2 = balls[j];
                if (a.sunk || b2.sunk) continue;
                const dx = b2.x - a.x, dy = b2.y - a.y, d = Math.hypot(dx, dy);
                if (d < a.r + b2.r && d > 0) {
                    const nx = dx / d, ny = dy / d;
                    const relV = (a.vx - b2.vx) * nx + (a.vy - b2.vy) * ny;
                    a.vx -= relV * nx; a.vy -= relV * ny;
                    b2.vx += relV * nx; b2.vy += relV * ny;
                    const overlap = (a.r + b2.r - d) / 2;
                    a.x -= nx * overlap; a.y -= ny * overlap;
                    b2.x += nx * overlap; b2.y += ny * overlap;
                }
            }
            return moving;
        }

        function endGame(winner) {
            if (over) return; over = true;
            const results = players.map((p, i) => ({ playerId: p.id, score: i === winner ? 1 : 0 }));
            setTimeout(() => window.vennaEndGame(results), 800);
        }

        function loop() {
            if (!over) {
                if (phase === 'shooting') {
                    const moving = simulate();
                    if (!moving) {
                        phase = 'aim'; myTurn = !myTurn; aimLocked = false;
                        msg = myTurn ? '' : "Opponent's turn";
                    }
                } else if (phase === 'aim' && myTurn) {
                    if (!aimLocked) { aimAngle += 0.022; }
                    power += 0.15 * powerDir;
                    if (power >= 20 || power <= 1) powerDir *= -1;
                }
                draw();
            }
            animId = requestAnimationFrame(loop);
        }

        socket.on('game-action', ({ action }) => {
            if (action.type === 'shoot') {
                balls[0].vx = action.vx; balls[0].vy = action.vy;
                phase = 'shooting'; myTurn = true;
            }
        });

        canvas.addEventListener('click', handleClick);
        animId = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(animId); canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['soccer-pool'] = { init };
})();
