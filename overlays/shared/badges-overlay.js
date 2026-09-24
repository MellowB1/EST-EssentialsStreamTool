/**
 * Badges overlay render logic (shared by all badge presets).
 *
 * The preset layout is selected by body classes set in each preset's
 * HTML (e.g. <body class="layout-badges-h">). If no layout-badges-*
 * class is present (e.g. the generic overlays/badges/badges.html), it falls
 * back to the ?preset= query param for backwards compatibility.
 *
 * Visual differences (horizontal/vertical/2row/2col) are handled entirely
 * by scoped CSS in overlays/shared/bw2-overlay.css.
 *
 * Slots are persistent (same pattern as party-overlay.js): never wipe
 * #badgesPanel. Images are only replaced when imgKey changes.
 */
(function () {
    // ── Preset selection (body class set by the HTML, or ?preset= fallback) ──
    if (!/\blayout-badges-/.test(document.body.className)) {
        var presetId = (new URLSearchParams(location.search)).get('preset') || 'badges-h';
        var PRESETS = {
            'badges-h':    'layout-badges-h',
            'badges-v':    'layout-badges-v',
            'badges-2row': 'layout-badges-2row',
            'badges-2col': 'layout-badges-2col',
        };
        document.body.classList.add(PRESETS[presetId] || PRESETS['badges-h']);
    }

    var params = getOverlayParams();
    var ws = new StreamToolWS({ host: params.host, port: params.port, explicitHost: params.explicitHost });
    injectStatusBanner(ws, params.port);

    var badgesPanel = document.getElementById('badgesPanel');
    var spriteHost = (params.host && String(params.host).trim()) || window.location.hostname || 'localhost';
    var spritePort = (Number(params.port) || 8585) + 1;
    var spriteBaseUrl = 'http://' + spriteHost + ':' + spritePort;
    var badgeUrlsFromServer = null;
    var badgeInfo = null;
    var slots = [];
    // How many badges the sprite server can actually serve an image for.
    // Fangames often ship fewer badge graphics than gyms (demos, WIP), and the
    // server reports those as null entries in badgeUrls.
    var availableCount = 0;

    function badgeName(i) {
        return (badgeInfo && badgeInfo[i] && badgeInfo[i].name) ? String(badgeInfo[i].name) : 'Badge '+(i+1);
    }

    function rewriteHost(url) {
        return String(url).replace(/^http:\/\/[^/:]+/i, 'http://' + spriteHost);
    }

    function withCacheBuster(url, token) {
        return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + token;
    }

    function badgeSrcList(i, token) {
        var list = [];
        var seen = {};
        function add(url, raw) {
            if (!url || seen[url]) return;
            seen[url] = true;
            list.push({ url: withCacheBuster(url, token), raw: !!raw });
        }
        var serverUrl = (badgeUrlsFromServer && badgeUrlsFromServer[i]) ? rewriteHost(badgeUrlsFromServer[i]) : '';
        var badgeUrl = spriteBaseUrl + '/badge/' + i;
        if (serverUrl) add(serverUrl, false);
        add(badgeUrl, false);
        add(spriteBaseUrl + '/file?path=Transitions/getBadge' + i + '.png', true);
        add(spriteBaseUrl + '/file?path=Transitions/badge' + i + '.png', true);
        add(spriteBaseUrl + '/file?path=Badges/getBadge' + i + '.png', true);
        add(spriteBaseUrl + '/file?path=Badges/badge' + i + '.png', true);
        add(spriteBaseUrl + '/file?path=Pictures/getBadge' + i + '.png', true);
        add(spriteBaseUrl + '/file?path=UI/getBadge' + i + '.png', true);
        return list;
    }

    function imageKey(i) {
        var first = (badgeUrlsFromServer && badgeUrlsFromServer[i])
            ? rewriteHost(badgeUrlsFromServer[i])
            : (spriteBaseUrl + '/badge/' + i);
        return spritePort + '|' + i + '|' + first;
    }

    function hasLoadedImage(wrap) {
        var img = wrap.querySelector('img');
        return !!(img && img.complete && img.naturalWidth > 0);
    }

    function countUrlImages(arr) {
        if (!Array.isArray(arr)) return 0;
        var n = 0;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i]) n++;
        }
        return n;
    }

    function createSlot(obtained, name) {
        var root = document.createElement('div');
        root.className = 'badge-slot';
        root.classList.toggle('obtained', obtained);
        root.classList.toggle('not-obtained', !obtained);
        root.title = name;
        var wrap = document.createElement('div');
        wrap.className = 'badge-icon-wrap';
        root.appendChild(wrap);
        badgesPanel.appendChild(root);
        return {
            root: root,
            wrap: wrap,
            obtained: obtained,
            loadedKey: '',
            loadingKey: '',
            loadToken: 0,
            retryAfter: 0,
            retryDelay: 1000,
        };
    }

    function ensureSlots(count) {
        while (slots.length < count) {
            var i = slots.length;
            slots.push(createSlot(false, badgeName(i)));
        }
        // Never shrink here: live ticks can send a shorter array for one frame
        // (empty badges / badgeInfo). Only trimSlots() removes slots.
    }

    function trimSlots(count) {
        while (slots.length > count) {
            var sl = slots.pop();
            if (sl.root.parentNode) sl.root.parentNode.removeChild(sl.root);
        }
    }

    function unlockUnloadedSlotImages() {
        for (var s = 0; s < slots.length; s++) {
            if (!hasLoadedImage(slots[s].wrap)) {
                slots[s].loadedKey = '';
                slots[s].loadingKey = '';
                slots[s].retryAfter = 0;
                slots[s].retryDelay = 1000;
            }
        }
    }

    function tryBadgeImage(slot, idx, name, key) {
        var token = ++slot.loadToken;
        var attempts = badgeSrcList(idx, Date.now() + '-' + token);
        var attempt = 0;
        slot.loadingKey = key;

        function tryNext() {
            if (slot.loadToken !== token || slot.loadingKey !== key) return;
            if (attempt >= attempts.length) {
                slot.loadingKey = '';
                slot.retryAfter = Date.now() + slot.retryDelay;
                slot.retryDelay = Math.min(slot.retryDelay * 2, 8000);
                return;
            }
            var a = attempts[attempt++];
            var img = document.createElement('img');
            img.className = a.raw ? 'badge-icon-raw' : 'badge-icon';
            img.alt = name;
            img.onload = function () {
                if (slot.loadToken !== token || slot.loadingKey !== key) return;
                img.onerror = null;
                var box = slot.wrap.clientWidth || 48;
                if (img.naturalWidth > box) img.classList.add('badge-icon-smooth');
                slot.wrap.replaceChildren(img);
                slot.wrap.setAttribute('data-img-key', key);
                slot.loadedKey = key;
                slot.loadingKey = '';
                slot.retryAfter = 0;
                slot.retryDelay = 1000;
            };
            img.onerror = function () {
                tryNext();
            };
            img.src = a.url;
        }
        tryNext();
    }

    function renderBadges(input, loadImages) {
        var hasBadgeData = Array.isArray(input) && input.length > 0;
        var badges = hasBadgeData ? input.map(function(v){return !!v}) : null;
        var infoLen = Array.isArray(badgeInfo) && badgeInfo.length > 0 ? badgeInfo.length : 0;
        var count;
        if (availableCount > 0) {
            // Only show badges the game actually has a graphic for: an empty
            // slot can never render anything, it just leaves a dead gap.
            count = Math.min(24, availableCount);
            trimSlots(count);
        } else {
            count = Math.min(24, Math.max(8, slots.length, badges ? badges.length : 0, infoLen));
        }
        ensureSlots(count);
        for (var i = 0; i < count; i++) {
            var sl = slots[i];
            var bName = badgeName(i);
            if (sl.root.title !== bName) sl.root.title = bName;
            if (hasBadgeData && sl.obtained !== !!badges[i]) {
                sl.obtained = !!badges[i];
                sl.root.classList.toggle('obtained', sl.obtained);
                sl.root.classList.toggle('not-obtained', !sl.obtained);
            }
            if (!loadImages) continue;
            if (badgeUrlsFromServer && badgeUrlsFromServer[i] === null) continue;
            var key = imageKey(i);
            if (sl.loadedKey === key && hasLoadedImage(sl.wrap)) continue;
            if (sl.loadingKey === key) continue;
            if (Date.now() < sl.retryAfter) continue;
            tryBadgeImage(sl, i, bName, key);
        }
    }

    ws.on('full_state', function (state) {
        if (!state) state = {};
        var shouldRetry = false;
        if (state.spriteServerPort && state.spriteServerPort !== spritePort) {
            spritePort = state.spriteServerPort;
            spriteBaseUrl = 'http://' + spriteHost + ':' + spritePort;
            shouldRetry = true;
        }
        var urlCount = countUrlImages(state.badgeUrls);
        if (urlCount > 0) {
            if (!badgeUrlsFromServer) shouldRetry = true;
            badgeUrlsFromServer = state.badgeUrls;
            availableCount = urlCount;
        }
        if (Array.isArray(state.badgeInfo) && state.badgeInfo.length > 0) badgeInfo = state.badgeInfo;
        if (shouldRetry) unlockUnloadedSlotImages();
        try { renderBadges(state.badges, true); } catch(e) { console.warn('[badges]', e); }
    });

    ws.on('badge_update', function (data) {
        try {
            if (Array.isArray(data)) { renderBadges(data, true); return; }
            if (data && Array.isArray(data.badgeInfo) && data.badgeInfo.length > 0) badgeInfo = data.badgeInfo;
            renderBadges(data && data.badges, true);
        } catch(e) { console.warn('[badges]', e); }
    });

    ws.on('connected', function () {
        if (ws.host) {
            spriteHost = ws.host;
            spriteBaseUrl = 'http://' + spriteHost + ':' + spritePort;
        }
        unlockUnloadedSlotImages();
        ws.send('request_state');
    });

    renderBadges([], false);
})();
