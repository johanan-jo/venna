// main.js — Home page: render game cards, search + filter
(function () {
    const grid = document.getElementById('gamesGrid');
    const noResults = document.getElementById('noResults');
    const searchInput = document.getElementById('searchInput');
    const filterRow = document.getElementById('filterRow');
    let activeCategory = 'all';

    function catTag(cat) {
        const color = window.CAT_COLORS[cat] || '#888';
        return `<span class="cat-tag" style="background:${color}22;color:${color}">${cat.replace('_', ' ')}</span>`;
    }

    function diffBadge(d) {
        return `<span class="badge badge-${d}">${d}</span>`;
    }

    function renderCards(games) {
        grid.innerHTML = '';
        if (!games.length) { noResults.style.display = 'block'; return; }
        noResults.style.display = 'none';
        games.forEach(g => {
            const card = document.createElement('a');
            card.className = 'game-card';
            card.href = `/lobby.html?game=${g.slug}`;
            card.innerHTML = `
        <div class="game-card-icon">${g.icon}</div>
        <h3>${g.name}</h3>
        <p>${g.desc}</p>
        <div class="game-card-cats">${g.cats.map(catTag).join('')}</div>
        <div class="game-card-meta">
          <span>👥 ${g.players} players</span>
          ${diffBadge(g.diff)}
          <span>⏱ ${g.dur}m</span>
        </div>`;
            grid.appendChild(card);
        });
    }

    function filterGames() {
        const q = searchInput.value.toLowerCase().trim();
        let list = window.VENNA_GAMES;
        if (activeCategory !== 'all') list = list.filter(g => g.cats.includes(activeCategory));
        if (q) list = list.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
        renderCards(list);
    }

    filterRow.addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.cat;
        filterGames();
    });

    searchInput.addEventListener('input', filterGames);

    // Initial render
    renderCards(window.VENNA_GAMES);
})();
