/**
 * Party overlay render logic (shared by all team presets).
 *
 * The preset layout/info is selected by body classes set in each preset's
 * HTML (e.g. <body class="layout-vertical info-sprite">). If no layout
 * class is present (e.g. the generic overlays/party/party.html), it falls back
 * to the ?preset= query param for backwards compatibility.
 *
 * Visual differences (vertical/horizontal, full/name/sprite) are handled
 * entirely by scoped CSS in overlays/shared/bw2-overlay.css.
 */
(function () {
    // ── Preset selection (body class set by the HTML, or ?preset= fallback) ──
    if (!/\blayout-/.test(document.body.className)) {
        var presetId = (new URLSearchParams(location.search)).get('preset') || 'team-h-full';
        // Built from overlays/shared/team-presets.js (keep mirrors in sync).
        var PRESETS = {};
        var list = (typeof window !== 'undefined' && window.EST_TEAM_PRESETS) || [];
        for (var pi = 0; pi < list.length; pi++) {
            PRESETS[list[pi].id] = { layout: list[pi].layout, info: list[pi].info, plain: !!list[pi].plain };
        }
        if (!PRESETS['team-h-full']) {
            PRESETS['team-h-full'] = { layout: 'horizontal', info: 'full', plain: false };
        }
        var cfg = PRESETS[presetId] || PRESETS['team-h-full'];
        document.body.classList.add('layout-' + cfg.layout, 'info-' + cfg.info);
        if (cfg.plain) document.body.classList.add('no-type-bg');
    }

    var params = getOverlayParams();
    var ws = new StreamToolWS({ host: params.host, port: params.port, explicitHost: params.explicitHost });
    injectStatusBanner(ws, params.port);

    var teamStrip = document.getElementById('teamStrip');
    var MAX_SLOTS = 6;
    var SPRITE_DISPLAY = 104;
    var slots = [];
    var slotFingerprints = [];
    var slotSpriteKeys = [];
    var slotAnimStops = [];
    var slotSpriteRetries = [];
    var slotSpriteRetryTimers = [];
    var spriteHost = (params.host && String(params.host).trim()) || window.location.hostname || 'localhost';
    var gameRev = '';
    var cachedPermalocke = { enabled: false, initialHearts: 25, maxPartySize: null };
    var cachedLives = { current: 0, max: 0, format: 'hearts' };
    var cachedChallenge = null;

    for (var _i = 0; _i < MAX_SLOTS; _i++) {
        slotFingerprints.push('');
        slotSpriteKeys.push('');
        slotAnimStops.push(null);
        slotSpriteRetries.push(0);
        slotSpriteRetryTimers.push(null);
    }

    function stopSlotAnimation(index) {
        var fn = slotAnimStops[index];
        if (typeof fn === 'function') { fn(); slotAnimStops[index] = null; }
        if (typeof SpriteAnimator !== 'undefined' && slots[index]) {
            SpriteAnimator.stop(slots[index].spriteWrap);
        }
    }

    function inferFramesFromImage(img, poke) {
        var frameCount = Number(poke && poke.spriteFrames) || 1;
        var frameW = Number(poke && poke.spriteFrameW) || 0;
        var frameH = Number(poke && poke.spriteFrameH) || 0;
        var nw = img.naturalWidth || 0;
        var nh = img.naturalHeight || 0;
        if (!frameW || !frameH) {
            if (frameCount > 1 && nw > 0) { frameW = Math.floor(nw / frameCount); frameH = nh; }
            else if (nh > 0 && nw > nh * 2) { frameH = nh; frameW = nh; frameCount = Math.max(1, Math.floor(nw / frameW)); }
            else { frameW = nw; frameH = nh; frameCount = 1; }
        }
        if (frameCount < 1) frameCount = 1;
        if (!frameW || !frameH) return null;
        return { frameCount: frameCount, frameW: frameW, frameH: frameH };
    }

    function renderAnimatedSprite(slot, poke, index, key) {
        var displaySize = SPRITE_DISPLAY;
        var canvas = document.createElement('canvas');
        canvas.width = displaySize; canvas.height = displaySize;
        canvas.style.width = displaySize + 'px'; canvas.style.height = displaySize + 'px';
        canvas.style.imageRendering = 'pixelated';
        slot.spriteWrap.innerHTML = '';
        slot.spriteWrap.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        var img = new Image();
        img.onload = function () {
            if (slotSpriteKeys[index] !== key) return;
            var meta = inferFramesFromImage(img, poke);
            if (!meta) return;
            var fc = meta.frameCount, fw = meta.frameW, fh = meta.frameH;
            var frame = 0, fps = 16, dur = Math.round(1000 / fps), last = performance.now(), rafId = 0;
            function draw() { ctx.clearRect(0, 0, displaySize, displaySize); ctx.drawImage(img, frame * fw, 0, fw, fh, 0, 0, displaySize, displaySize); }
            draw();
            if (fc <= 1) return;
            function tick(now) {
                if (slotSpriteKeys[index] !== key) return;
                if (now - last >= dur) { frame = (frame + 1) % fc; draw(); last = now - ((now - last) % dur); }
                rafId = requestAnimationFrame(tick);
            }
            rafId = requestAnimationFrame(tick);
            slotAnimStops[index] = function () { cancelAnimationFrame(rafId); };
        };
        img.onerror = function () {
            if (slotSpriteKeys[index] !== key) return;
            slot.spriteWrap.innerHTML = '';
            onSpriteError(index, poke);
        };
        img.src = poke.spritePath;
    }

    function createSlot() {
        var root = document.createElement('div'); root.className = 'team-slot empty';
        var spriteWrap = document.createElement('div'); spriteWrap.className = 'sprite-wrap';
        var meta = document.createElement('div'); meta.className = 'slot-meta';
        var top = document.createElement('div'); top.className = 'slot-top';
        var nameRow = document.createElement('div'); nameRow.className = 'slot-name-row';
        var name = document.createElement('div'); name.className = 'slot-name'; name.textContent = '---';
        nameRow.appendChild(name);
        var levelRow = document.createElement('div'); levelRow.className = 'slot-level-row';
        var level = document.createElement('div'); level.className = 'slot-level'; level.textContent = '';
        var gender = document.createElement('span'); gender.className = 'slot-gender'; gender.textContent = '';
        levelRow.appendChild(level); levelRow.appendChild(gender);
        top.appendChild(nameRow); top.appendChild(levelRow);
        meta.appendChild(top);
        var hpTrack = document.createElement('div'); hpTrack.className = 'slot-hp';
        var hpFill = document.createElement('div'); hpFill.className = 'slot-hp-fill';
        hpTrack.appendChild(hpFill);
        root.appendChild(meta);
        root.appendChild(spriteWrap);
        root.appendChild(hpTrack);
        var lockOverlay = document.createElement('div');
        lockOverlay.className = 'slot-lock-overlay';
        lockOverlay.setAttribute('aria-hidden', 'true');
        var lockImg = document.createElement('img');
        lockImg.className = 'slot-lock-icon';
        lockImg.src = '../shared/candado.png';
        lockImg.alt = '';
        lockImg.draggable = false;
        lockOverlay.appendChild(lockImg);
        root.appendChild(lockOverlay);
        return { root: root, spriteWrap: spriteWrap, name: name, level: level, gender: gender, hpTrack: hpTrack, hpFill: hpFill, lockOverlay: lockOverlay };
    }

    function ensureSlots() {
        if (slots.length > 0) return;
        for (var i = 0; i < MAX_SLOTS; i++) { var s = createSlot(); slots.push(s); teamStrip.appendChild(s.root); }
    }

    function rewriteHost(url) {
        return String(url).replace(/^http:\/\/[^/:]+/i, 'http://' + spriteHost);
    }
    function rewritePokeSprite(poke) {
        if (!poke || !poke.spritePath) return poke;
        var next = {};
        for (var k in poke) next[k] = poke[k];
        next.spritePath = rewriteHost(poke.spritePath);
        return next;
    }
    function teamFp(poke) {
        if (!poke) return 'empty';
        return [gameRev, poke.egg?1:0, poke.species||'', poke.name||'', poke.nickname||'', poke.level||0, poke.gender||'', (Array.isArray(poke.types)&&poke.types[0])?String(poke.types[0]):'', poke.fainted?1:0].join('|');
    }
    function spKey(poke) { return poke ? gameRev+':'+(poke.egg?'egg:':'')+(poke.spritePath||'')+':'+(poke.spriteFrames||1) : ''; }
    function primaryType(poke) { if(!poke||!Array.isArray(poke.types)||!poke.types.length) return 'unknown'; return String(poke.types[0]||'unknown').trim().toLowerCase(); }
    function fmtGender(v) {
        // Live state / plugin: 0=male, 1=female, 2=genderless (also accept M/F strings)
        if (v === 0 || v === '0' || String(v).trim().toUpperCase() === 'M') return '\u2642'; // ♂
        if (v === 1 || v === '1' || String(v).trim().toUpperCase() === 'F') return '\u2640'; // ♀
        return '';
    }
    function setGenderEl(el, v) {
        var sym = fmtGender(v);
        el.textContent = sym;
        el.classList.toggle('male', sym === '\u2642');
        el.classList.toggle('female', sym === '\u2640');
    }

    function scheduleSpriteRetry(index, poke) {
        var n = (slotSpriteRetries[index] || 0) + 1;
        if (n > 3) return;
        slotSpriteRetries[index] = n;
        if (slotSpriteRetryTimers[index]) clearTimeout(slotSpriteRetryTimers[index]);
        var delay = 1000 * Math.pow(2, n - 1);
        slotSpriteRetryTimers[index] = setTimeout(function () {
            slotSpriteKeys[index] = '';
            updateSprite(slots[index], poke, index);
        }, delay);
    }
    function onSpriteError(index, poke) {
        slotSpriteKeys[index] = '';
        scheduleSpriteRetry(index, poke);
    }
    function updateSprite(slot, poke, index) {
        poke = rewritePokeSprite(poke);
        var key = spKey(poke);
        if (slotSpriteKeys[index] === key) return;
        stopSlotAnimation(index);
        slotSpriteKeys[index] = key;
        slot.spriteWrap.innerHTML = '';
        if (!poke || !poke.spritePath) return;
        if (typeof SpriteAnimator !== 'undefined') {
            SpriteAnimator.fromPokemon(slot.spriteWrap, poke, {
                displaySize: SPRITE_DISPLAY,
                autoFit: true,
                onError: function () { onSpriteError(index, poke); },
            });
            return;
        }
        if ((poke.spriteFrames || 1) > 1) { renderAnimatedSprite(slot, poke, index, key); return; }
        var img = document.createElement('img');
        img.src = poke.spritePath; img.alt = poke.name||poke.species||'';
        img.style.width = SPRITE_DISPLAY + 'px'; img.style.height = SPRITE_DISPLAY + 'px'; img.style.imageRendering = 'pixelated';
        img.onerror = function () { onSpriteError(index, poke); };
        slot.spriteWrap.appendChild(img);
    }

    function updateHpBar(slot, poke) {
        if (!slot || !slot.hpFill) return;
        if (!poke || poke.egg) {
            slot.hpFill.style.width = '0%';
            slot.hpFill.className = 'slot-hp-fill';
            return;
        }
        var maxHp = Number(poke.maxHp) || 0;
        var hp = Number(poke.hp);
        if (!isFinite(hp)) hp = 0;
        if (poke.fainted) hp = 0;
        var pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
        slot.hpFill.style.width = pct + '%';
        var band = 'hp-high';
        if (pct <= 20) band = 'hp-low';
        else if (pct <= 50) band = 'hp-mid';
        slot.hpFill.className = 'slot-hp-fill ' + band;
    }

    function updatePermalockeLocks() {
        ensureSlots();
        var c = Number(cachedLives && cachedLives.current) || 0;
        var livesMax = Number(cachedLives && cachedLives.max) || 0;
        if (livesMax < c) livesMax = c;
        // Have usable lives data (max may be missing on partial lives_update)
        var ready = livesMax > 0 || c > 0;
        // Only when server says Permalocke/Añil is enabled — never force on other fangames
        var en = !!(cachedPermalocke && cachedPermalocke.enabled);
        var maxParty = null;
        if (cachedChallenge && cachedChallenge.maxPartySize != null) {
            maxParty = Number(cachedChallenge.maxPartySize);
        } else if (cachedPermalocke && cachedPermalocke.maxPartySize != null) {
            maxParty = Number(cachedPermalocke.maxPartySize);
        }
        var limit = 6;
        if (en && ready && typeof maxParty === 'number' && isFinite(maxParty) && maxParty >= 0) {
            limit = maxParty;
        }
        if (en && ready && c <= 6) {
            limit = Math.min(limit, c);
        }
        for (var i = 0; i < MAX_SLOTS; i++) {
            var locked = !!(en && ready && i >= limit);
            slots[i].root.classList.toggle('permalocke-locked', locked);
            if (slots[i].lockOverlay) slots[i].lockOverlay.style.display = locked ? 'flex' : 'none';
        }
    }

    function renderTeam(team) {
        ensureSlots();
        var list = Array.isArray(team) ? team : [];
        for (var i = 0; i < MAX_SLOTS; i++) {
            var poke = list[i] || null;
            var fp = teamFp(poke);
            var sl = slots[i];
            if (slotFingerprints[i] !== fp) {
                slotFingerprints[i] = fp;
                if (!poke) {
                    sl.root.className = 'team-slot empty';
                    sl.name.textContent = '---';
                    sl.level.textContent = '';
                    setGenderEl(sl.gender, null);
                    sl.root.dataset.type = 'unknown';
                    updateSprite(sl, null, i);
                } else {
                    sl.root.className = 'team-slot';
                    if (poke.fainted && !poke.egg) sl.root.classList.add('fainted');
                    if (poke.egg) {
                        sl.root.dataset.type = 'unknown';
                        sl.name.textContent = 'Egg';
                        sl.level.textContent = '';
                        setGenderEl(sl.gender, null);
                    } else {
                        sl.root.dataset.type = primaryType(poke);
                        sl.name.textContent = String(poke.nickname || poke.name || poke.species || 'UNKNOWN');
                        sl.level.textContent = 'Lv ' + (poke.level || 0);
                        setGenderEl(sl.gender, poke.gender);
                    }
                    updateSprite(sl, poke, i);
                }
            } else if (poke && slotSpriteKeys[i] !== spKey(poke)) {
                // Same species/level fingerprint, but spritePath arrived later (e.g. IF atlas enrich)
                updateSprite(sl, poke, i);
            }
            updateHpBar(sl, poke);
        }
        updatePermalockeLocks();
    }

    function syncLives(lives) {
        if (lives && typeof lives === 'object') {
            var nextCurrent = Number(lives.current);
            if (!isFinite(nextCurrent)) nextCurrent = Number(cachedLives.current) || 0;
            var nextMax = (lives.max != null && lives.max !== '')
                ? (Number(lives.max) || 0)
                : (Number(cachedLives.max) || 0);
            if (nextMax < nextCurrent) nextMax = nextCurrent;
            cachedLives = {
                current: nextCurrent,
                max: nextMax,
                format: (lives.format != null ? lives.format : cachedLives.format) || 'hearts'
            };
        }
        updatePermalockeLocks();
    }

    ws.on('full_state', function (state) {
        if (!state) state = {};
        if (ws.host) spriteHost = ws.host;
        var title = state.gameInfo && state.gameInfo.title ? String(state.gameInfo.title) : '';
        var nextRev = title + '|' + (state.spriteServerPort || '');
        if (nextRev !== gameRev) {
            gameRev = nextRev;
            for (var r = 0; r < MAX_SLOTS; r++) {
                slotFingerprints[r] = '';
                slotSpriteKeys[r] = '';
                slotSpriteRetries[r] = 0;
            }
        }
        cachedPermalocke = state.permalocke || { enabled: false, initialHearts: 25, maxPartySize: null };
        cachedChallenge = state.challenge || null;
        if (state.lives && typeof state.lives === 'object') syncLives(state.lives);
        renderTeam(state.team);
    });

    ws.on('team_update', function (team) {
        renderTeam(team);
        if (ws.state && ws.state.lives) syncLives(ws.state.lives);
    });

    ws.on('lives_update', function (lives) { syncLives(lives); });

    ws.on('connected', function () { ws.send('request_state'); });

    ensureSlots();
})();
