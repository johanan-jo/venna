// Archery — aim and shoot, covers Archery, Archery Master, Target Practice, Cornhole, Dart
(function () {
    const G = window.VennaGames = window.VennaGames || {};
    const CFGS = {
        'archery': { projectile: '🏹', target: '🎯', bg: '#0a1400', movingTarget: false, rounds: 5, windEnabled: false },
        'archery-master': { projectile: '🏹', target: '🎯', bg: '#0a1400', movingTarget: true, rounds: 5, windEnabled: true },
        'target-practice': { projectile: '💥', target: '🎪', bg: '#100014', movingTarget: true, rounds: 5, windEnabled: false },
        'dart': { projectile: '🎯', target: '🎳', bg: '#0a0a1a', movingTarget: false, rounds: 5, windEnabled: false },
        'cornhole': { projectile: '🥏', target: '🎳', bg: '#001400', movingTarget: false, rounds: 4, windEnabled: false },
    };

    function makeInit(slug) {
        return function init({ canvas, socket, roomCode, myPlayerId, players }) {
            const cfg = CFGS[slug] || CFGS['archery'];
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const ids = players.map(p => p.id);
            const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            const scores = {};
            players.forEach(p => scores[p.id] = 0);
            let turnIdx = 0, roundsLeft = cfg.rounds, over = false;
            let aiming = false, power = 0, powerDir = 1, wind = 0;
            let shots = []; // {x,y,playerId,score,t}
            let targetX = W / 2, targetY = H * 0.3, targetVy = 0;
            let aimAngle = 0, mouseX = 0, mouseY = 0;

            if (cfg.windEnabled) wind = (Math.random() - 0.5) * 4;

            // Target ring radii for scoring
            const RINGS = [{ r: 15, pts: 10, color: '#ef4444' }, { r: 30, pts: 8, color: '#ef4444' }, { r: 50, pts: 6, color: '#3b82f6' }, { r: 70, pts: 4, color: '#3b82f6' }, { r: 95, pts: 2, color: '#f0f0f0' }];

            function update(dt) {
                if (cfg.movingTarget) { targetY += targetVy * (dt / 16); if (targetY < 60 || targetY > H * 0.5) targetVy *= -1; targetVy += (Math.random() - 0.5) * 0.2; }
                shots = shots.filter(s => s.t > 0);
                shots.forEach(s => s.t -= dt);
                if (aiming) { power += powerDir * 3; if (power >= 100 || power <= 0) powerDir *= -1; }
            }

            function hitScore(tx, ty, sx, sy) {
                const d = Math.hypot(sx - tx, sy - ty);
                for (const ring of RINGS) if (d < ring.r) return ring.pts;
                return 0;
            }

            function draw() {
                ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
                // Wind
                if (cfg.windEnabled) {
                    ctx.font = '13px Inter'; ctx.fillStyle = '#7986a8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                    ctx.fillText(`Wind: ${wind > 0 ? '→' : '←'} ${Math.abs(wind).toFixed(1)}`, 10, 10);
                }
                // Target
                RINGS.slice().reverse().forEach(ring => {
                    ctx.fillStyle = ring.color + '33'; ctx.strokeStyle = ring.color; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(targetX, targetY, ring.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                });
                ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.target, targetX, targetY);
                // Bow/player position at bottom
                const myPi = ids.indexOf(myPlayerId);
                const bowX = 120 + myPi * 160, bowY = H - 60;
                ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏹', bowX, bowY);
                // Aim line
                if (aiming) {
                    const dx = targetX - bowX, dy = targetY - bowY;
                    const len = Math.min(80, Math.hypot(dx, dy));
                    const ang = Math.atan2(dy, dx);
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
                    ctx.beginPath(); ctx.moveTo(bowX, bowY); ctx.lineTo(bowX + Math.cos(ang) * len, bowY + Math.sin(ang) * len); ctx.stroke();
                    ctx.setLineDash([]);
                }
                // Power bar
                const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
                if (isMyTurn && !over) {
                    ctx.fillStyle = '#1a1a2a'; ctx.fillRect(W / 2 - 60, H - 30, 120, 16);
                    ctx.fillStyle = power > 70 ? '#ef4444' : power > 40 ? '#f59e0b' : '#10b981'; ctx.fillRect(W / 2 - 60, H - 30, 120 * (power / 100), 16);
                    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 60, H - 30, 120, 16);
                    ctx.font = '11px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('POWER', W / 2, H - 22);
                }
                // Shots
                shots.forEach(s => { ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.projectile, s.x, s.y); if (s.pts) { ctx.font = 'bold 16px Inter'; ctx.fillStyle = '#f59e0b'; ctx.fillText('+' + s.pts, s.x, s.y - 20); } });
                // Scores
                ctx.font = '14px Inter'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
                players.forEach((p, i) => { ctx.fillStyle = COLORS[i]; ctx.fillText(`${p.name}: ${scores[p.id] || 0}`, 10, 30 + i * 22); });
                // Turn
                ctx.textAlign = 'center'; ctx.fillStyle = isMyTurn ? '#10b981' : '#7986a8'; ctx.font = '14px Inter';
                ctx.fillText(isMyTurn ? `Your turn! (${roundsLeft} shots left) — Click to aim+shoot` : `${players[turnIdx % players.length]?.name}'s turn`, W / 2, H / 2 + HHeight() / 2 + 10);
                function HHeight() { return 0; }
            }

            function shoot() {
                const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
                if (!isMyTurn || over) return;
                const myPi = ids.indexOf(myPlayerId);
                const bowX = 120 + myPi * 160, bowY = H - 60;
                const dx = mouseX - bowX, dy = mouseY - bowY;
                const len = Math.hypot(dx, dy) || 1;
                const spreadX = targetX + (Math.random() - 0.5) * ((100 - power) * 2 + 10) * ((wind || 0) * 2);
                const spreadY = targetY + (Math.random() - 0.5) * (100 - power) * 1.5;
                const pts = hitScore(targetX, targetY, spreadX, spreadY);
                scores[myPlayerId] = (scores[myPlayerId] || 0) + pts;
                shots.push({ x: spreadX, y: spreadY, pts, t: 1500, playerId: myPlayerId });
                socket.emit('game-action', { roomCode, action: { type: 'shoot', playerId: myPlayerId, x: spreadX, y: spreadY, pts } });
                aiming = false; power = 0;
                if (--roundsLeft <= 0) {
                    turnIdx++;
                    roundsLeft = cfg.rounds;
                    if (turnIdx >= players.length && !over) {
                        over = true;
                        const results = players.map(p => ({ playerId: p.id, score: scores[p.id] || 0 }));
                        setTimeout(() => window.vennaEndGame(results), 1200);
                    }
                }
                draw();
            }

            socket.on('game-action', ({ action }) => {
                if (action.type === 'shoot') { scores[action.playerId] = (scores[action.playerId] || 0) + action.pts; shots.push({ x: action.x, y: action.y, pts: action.pts, t: 1500 }); }
            });

            canvas.addEventListener('mousedown', e => { const rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top; aiming = true; });
            canvas.addEventListener('mouseup', () => shoot());
            canvas.addEventListener('mousemove', e => { const rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top; });

            let animId, lastTime = 0;
            function gameLoop(ts) { if (!lastTime) lastTime = ts; const dt = Math.min(ts - lastTime, 100); lastTime = ts; if (!over) update(dt); draw(); if (!over) animId = requestAnimationFrame(gameLoop); }
            animId = requestAnimationFrame(gameLoop);
            return () => { cancelAnimationFrame(animId); socket.off('game-action'); };
        };
    }

    ['archery', 'archery-master', 'target-practice', 'dart', 'cornhole'].forEach(s => { G[s] = { init: makeInit(s) }; });
})();
