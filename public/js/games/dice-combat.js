// Dice Combat — turn-based HP battle using dice
(function () {
    const G = window.VennaGames = window.VennaGames || {};

    function init({ canvas, socket, roomCode, myPlayerId, players }) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const ids = players.map(p => p.id);
        const nP = Math.min(players.length, 4);
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        let hp = Array(nP).fill(20);
        let dice = null, turnIdx = 0, over = false, lastMsg = '';

        function draw() {
            ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, W, H);
            const cx = W / 2, cy = H / 2;
            // Draw players
            players.slice(0, nP).forEach((p, i) => {
                const px = [cx - 160, cx + 80, cx - 160, cx + 80][i];
                const py = [cy - 120, cy - 120, cy + 40, cy + 40][i];
                // HP bar
                ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.roundRect(px - 10, py - 10, 140, 120, 10); ctx.fill();
                ctx.strokeStyle = COLORS[i]; ctx.lineWidth = ids[i] === myPlayerId ? 2.5 : 1.5; ctx.stroke();
                // Avatar
                ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const emojis = ['🧙', '🦸', '🧝', '🤺'];
                ctx.fillText(emojis[i], px + 60, py + 30);
                ctx.font = 'bold 13px Inter'; ctx.fillStyle = COLORS[i]; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(p.name, px + 60, py);
                // HP bar track
                ctx.fillStyle = '#2a2a4a'; ctx.fillRect(px + 5, py + 65, 120, 14);
                const hpRatio = Math.max(0, hp[i] / 20);
                ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
                ctx.fillRect(px + 5, py + 65, 120 * hpRatio, 14);
                ctx.font = '11px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
                ctx.fillText(`${Math.max(0, hp[i])}/20 HP`, px + 65, py + 65);
                // Shield
                if (i === turnIdx % nP) {
                    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.roundRect(px - 14, py - 14, 148, 128, 12); ctx.stroke();
                }
            });
            // Dice display center
            if (dice) {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(cx - 30, cy - 30, 60, 60, 10); ctx.fill();
                ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3; ctx.stroke();
                ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111';
                ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice.att], cx, cy - 10);
                ctx.font = '12px Inter'; ctx.fillStyle = '#555'; ctx.fillText('vs', cx, cy + 20);
                ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#ef4444'; ctx.fillText(['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice.def], cx, cy + 38);
            }
            // Message
            ctx.font = '16px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#f59e0b';
            if (lastMsg) ctx.fillText(lastMsg, cx, 10);
            // Roll button
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            if (isMyTurn && !over) {
                ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.roundRect(cx - 60, H - 54, 120, 44, 8); ctx.fill();
                ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('⚔️ Attack!', cx, H - 32);
            } else if (!over) {
                ctx.fillStyle = '#7986a8'; ctx.font = '14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText('Opponent attacking…', cx, H - 8);
            }
        }

        function applyAttack({ attacker, target, att, def }) {
            dice = { att, def };
            const dmg = Math.max(0, att - def);
            hp[target] = Math.max(0, hp[target] - dmg);
            lastMsg = `${players[attacker].name} rolled ${att} vs ${def} → ${dmg} damage!`;
            turnIdx++;
            draw();
            // Check dead
            const dead = hp.findIndex(h => h <= 0);
            if (dead >= 0 && !over) {
                over = true;
                const results = players.map((p, i) => ({ playerId: p.id, score: hp[i] }));
                setTimeout(() => window.vennaEndGame(results), 1200);
            }
            setTimeout(() => { dice = null; draw(); }, 900);
        }

        function handleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const my = e.clientY - rect.top, mx = e.clientX - rect.left;
            const isMyTurn = ids[turnIdx % ids.length] === myPlayerId;
            if (!isMyTurn || over) return;
            if (my > H - 58 && my < H - 10 && mx > W / 2 - 65 && mx < W / 2 + 65) {
                const attIdx = ids.indexOf(myPlayerId) % nP;
                const target = (attIdx + 1) % nP;
                const att = Math.ceil(Math.random() * 6), def = Math.ceil(Math.random() * 6);
                const action = { type: 'attack', attacker: attIdx, target, att, def };
                applyAttack(action);
                socket.emit('game-action', { roomCode, action });
            }
        }

        socket.on('game-action', ({ action }) => { if (action.type === 'attack') applyAttack(action); });
        canvas.addEventListener('click', handleClick);
        draw();
        return () => { canvas.removeEventListener('click', handleClick); socket.off('game-action'); };
    }

    G['dice-combat'] = { init };
})();
