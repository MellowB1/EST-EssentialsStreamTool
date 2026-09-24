/**
 * Lives overlay render logic (shared by all lives presets).
 *
 * The preset layout is selected by body classes set in each preset's
 * HTML (e.g. <body class="layout-lives-h">). If no layout-lives-*
 * class is present (e.g. the generic overlays/lives/lives.html), it falls
 * back to the ?preset= query param when provided. Without a query param the
 * legacy full UI (header + value + wrapped hearts) is kept.
 *
 * Visual differences (horizontal/vertical/count) are handled entirely by
 * scoped CSS in overlays/shared/bw2-overlay.css.
 */
(function () {
    // ── Preset selection (body class set by the HTML, or ?preset= fallback) ──
    if (!/\blayout-lives-/.test(document.body.className)) {
        var presetId = (new URLSearchParams(location.search)).get('preset');
        if (presetId) {
            var PRESETS = {
                'lives-h':     'layout-lives-h',
                'lives-v':     'layout-lives-v',
                'lives-count': 'layout-lives-count',
            };
            document.body.classList.add(PRESETS[presetId] || PRESETS['lives-h']);
        }
    }

    var isCountMode = /\blayout-lives-count\b/.test(document.body.className);

    var params = getOverlayParams();
    var ws = new StreamToolWS({ host: params.host, port: params.port, explicitHost: params.explicitHost });
    injectStatusBanner(ws, params.port);

    var livesPanel = document.getElementById('livesPanel');
    var livesValue = document.getElementById('livesValue');
    var livesHearts = document.getElementById('livesHearts');
    var livesCompact = document.getElementById('livesCompact');
    var lifeCountNum = document.querySelector('#livesCompact .life-count-num');
    var livesFp = '';
    var cachedLives = { current: 0, max: 0, format: 'hearts' };

    function ensureHearts(max) {
        while (livesHearts.children.length < max) {
            var h = document.createElement('span');
            h.className = 'life-heart';
            h.textContent = '❤';
            livesHearts.appendChild(h);
        }
        while (livesHearts.children.length > max) livesHearts.removeChild(livesHearts.lastChild);
    }

    function renderLives(lives) {
        if (lives && typeof lives === 'object') {
            cachedLives = {
                current: Number(lives.current) || 0,
                max: Number(lives.max) || 0,
                format: (lives.format != null ? lives.format : cachedLives.format) || 'hearts'
            };
        }
        var cur = Number(cachedLives.current) || 0;
        var max = Number(cachedLives.max) || 0;
        var fp = cur + '|' + max + '|' + (isCountMode ? 'count' : 'hearts');
        if (livesFp === fp) return;
        livesFp = fp;

        if (max <= 0) {
            livesPanel.hidden = true;
            livesHearts.innerHTML = '';
            if (livesCompact) livesCompact.hidden = true;
            return;
        }

        livesPanel.hidden = false;

        if (isCountMode) {
            if (livesHearts) livesHearts.innerHTML = '';
            if (livesCompact) livesCompact.hidden = false;
            if (lifeCountNum) lifeCountNum.textContent = String(cur);
            return;
        }

        if (livesCompact) livesCompact.hidden = true;
        if (livesValue) livesValue.textContent = cur + ' / ' + max;
        ensureHearts(max);
        for (var i = 0; i < max; i++) {
            var heart = livesHearts.children[i];
            if (heart) heart.classList.toggle('dead', i >= cur);
        }
    }

    ws.on('full_state', function (state) {
        if (!state) state = {};
        if (state.lives && typeof state.lives === 'object') renderLives(state.lives);
        else renderLives(cachedLives);
    });

    ws.on('lives_update', function (lives) { renderLives(lives); });

    ws.on('connected', function () { ws.send('request_state'); });
})();
