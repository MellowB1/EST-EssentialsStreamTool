/**
 * WebSocket Client for Overlays
 * Auto-reconnecting WS client that receives live game state updates.
 * Used by all overlay HTML pages.
 */

class StreamToolWS {
    /**
     * @param {object} opts
     * @param {string} opts.host - WS host (default: 'localhost')
     * @param {number} opts.port - WS port (default: 8585)
     * @param {boolean} opts.autoReconnect - Auto-reconnect on disconnect (default: true)
     * @param {number} opts.reconnectInterval - Reconnect interval in ms (default: 3000)
     */
    constructor(opts = {}) {
        this.host = opts.host || 'localhost';
        this._explicitHost = opts.explicitHost === true;
        this._connectTimeoutMs = opts.connectTimeoutMs || 1500;
        this._connectWatchdog = null;
        this._switchingHost = false;
        this.port = opts.port || 8585;
        this.autoReconnect = opts.autoReconnect !== false;
        this.reconnectInterval = opts.reconnectInterval || 3000;
        this._hostCandidates = this._buildHostCandidates(this.host);
        this._hostIndex = 0;

        this.ws = null;
        this._listeners = {};
        this._reconnectTimer = null;
        this._connected = false;
        this._reconnectAttempts = 0;

        // Current cached state
        this.state = {
            team: [null, null, null, null, null, null],
            badges: [],
            player: { name: '', money: 0, playtime: '', catches: 0, deaths: 0 },
            catches: [],
            trainerTeam: [],
            trainerName: '',
            trainerReveals: [],
            wildPokemon: null,
            battle: null,
            lives: { current: 0, max: 0, format: 'hearts' },
            overlayConfig: null,
            gameInfo: null,
            spriteServerPort: null,
            permalocke: { enabled: false, initialHearts: 25, maxPartySize: null },
            challenge: null,
        };

        this.connect();
    }

    get connected() { return this._connected; }

    _buildHostCandidates(baseHost) {
        if (this._explicitHost) return [baseHost || 'localhost'];
        const preferred = (baseHost || '').trim();
        const candidates = [preferred, '127.0.0.1', 'localhost', '[::1]'];
        const unique = [];
        const seen = new Set();
        for (const host of candidates) {
            if (!host || seen.has(host)) continue;
            seen.add(host);
            unique.push(host);
        }
        return unique.length > 0 ? unique : ['127.0.0.1'];
    }

    _tryNextHost(reason) {
        if (this._explicitHost) return false;
        if (this._hostIndex >= this._hostCandidates.length - 1) return false;
        this._hostIndex++;
        this.host = this._hostCandidates[this._hostIndex];
        this._switchingHost = true;
        console.warn(`[WS] ${reason}; retrying with ${this.host}`);
        return true;
    }

    connect() {
        this._switchingHost = false;
        this.host = this._hostCandidates[this._hostIndex] || this.host;
        clearTimeout(this._connectWatchdog);
        if (this.ws) {
            // Remove handlers from old socket so late events don't fire
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            try { this.ws.close(); } catch (_) { }
        }

        const url = `ws://${this.host}:${this.port}`;
        this.ws = new WebSocket(url);
        const activeSocket = this.ws;

        this._connectWatchdog = setTimeout(() => {
            if (this.ws !== activeSocket) return;
            if (activeSocket.readyState === WebSocket.CONNECTING && !this._connected) {
                if (this._tryNextHost('connect timeout')) {
                    try { activeSocket.close(); } catch (_) { }
                    this.connect();
                } else {
                    try { activeSocket.close(); } catch (_) { }
                }
            }
        }, this._connectTimeoutMs);

        this.ws.onopen = () => {
            this._connected = true;
            this._reconnectAttempts = 0;
            clearTimeout(this._connectWatchdog);
            clearTimeout(this._reconnectTimer);
            console.log('[WS] Connected to', url);
            this._emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleMessage(msg);
            } catch (e) {
                console.warn('[WS] Invalid message:', e);
            }
        };

        this.ws.onclose = () => {
            clearTimeout(this._connectWatchdog);
            if (this._switchingHost) {
                this._switchingHost = false;
                return;
            }

            if (!this._connected && this._tryNextHost('closed before connect')) {
                this.connect();
                return;
            }

            this._connected = false;
            console.log('[WS] Disconnected');
            this._emit('disconnected');
            this._scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            if (!this._connected && this._tryNextHost('connection error')) {
                try { this.ws.close(); } catch (_) { }
                this.connect();
                return;
            }
            console.error('[WS] Error:', err);
        };
    }

    _scheduleReconnect() {
        if (!this.autoReconnect) return;
        clearTimeout(this._reconnectTimer);
        if (!this._explicitHost) this._hostIndex = 0;
        // Exponential backoff: 3s → 6s → 12s → ... capped at 30s
        const delay = Math.min(
            this.reconnectInterval * Math.pow(2, this._reconnectAttempts),
            30000
        );
        this._reconnectAttempts++;
        this._reconnectTimer = setTimeout(() => {
            console.log(`[WS] Reconnecting (attempt ${this._reconnectAttempts})...`);
            this.connect();
        }, delay);
    }

    _handleMessage(msg) {
        switch (msg.type) {
            case 'full_state': {
                // Assign each known key individually so a partial server
                // payload can't wipe unrelated state properties
                const d = msg.data;
                if (d.team !== undefined)        this.state.team = d.team;
                if (d.badges !== undefined)      this.state.badges = d.badges;
                if (d.badgeInfo !== undefined)   this.state.badgeInfo = d.badgeInfo;
                if (d.badgeUrls !== undefined)   this.state.badgeUrls = d.badgeUrls;
                if (d.player !== undefined)      this.state.player = d.player;
                if (d.catches !== undefined)     this.state.catches = d.catches;
                if (d.trainerTeam !== undefined) this.state.trainerTeam = d.trainerTeam;
                if (d.trainerName !== undefined) this.state.trainerName = d.trainerName;
                if (d.trainerReveals !== undefined) this.state.trainerReveals = d.trainerReveals;
                if (d.wildPokemon !== undefined) this.state.wildPokemon = d.wildPokemon;
                if (d.battle !== undefined)      this.state.battle = d.battle;
                if (d.lives !== undefined)       this.state.lives = d.lives;
                if (d.overlayConfig !== undefined) this.state.overlayConfig = d.overlayConfig;
                if (d.gameInfo !== undefined)    this.state.gameInfo = d.gameInfo;
                if (d.spriteServerPort !== undefined) this.state.spriteServerPort = d.spriteServerPort;
                if (d.permalocke !== undefined) this.state.permalocke = d.permalocke;
                if (d.challenge !== undefined) this.state.challenge = d.challenge;
                this._emit('full_state', this.state);
                break;
            }
            case 'team_update':
                this.state.team = msg.data;
                this._emit('team_update', msg.data);
                break;
            case 'badge_update':
                // Support both old format (array) and new format ({ badges, badgeInfo })
                if (Array.isArray(msg.data)) {
                    this.state.badges = msg.data;
                } else {
                    this.state.badges = msg.data.badges;
                    if (msg.data.badgeInfo) this.state.badgeInfo = msg.data.badgeInfo;
                }
                this._emit('badge_update', msg.data);
                break;
            case 'player_update':
                this.state.player = msg.data;
                this._emit('player_update', msg.data);
                break;
            case 'catches_update':
                this.state.catches = msg.data;
                this._emit('catches_update', msg.data);
                break;
            case 'wild_update':
                this.state.wildPokemon = msg.data;
                this._emit('wild_update', msg.data);
                break;
            case 'trainer_update':
                this.state.trainerTeam = msg.data.team;
                this.state.trainerName = msg.data.name;
                this.state.trainerReveals = msg.data.reveals || [];
                this._emit('trainer_update', msg.data);
                break;
            case 'battle_update':
                this.state.battle = msg.data;
                this._emit('battle_update', msg.data);
                break;
            case 'lives_update':
                this.state.lives = msg.data;
                this._emit('lives_update', msg.data);
                break;
            case 'overlay_config':
                this.state.overlayConfig = msg.data;
                this._emit('overlay_config', msg.data);
                break;
            default:
                this._emit(msg.type, msg.data);
        }
    }

    /**
     * Listen for an event
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return this; // chainable
    }

    /**
     * Remove a listener
     */
    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Send a message to the server
     * @param {string} type - Message type
     * @param {object} data - Message payload
     */
    send(type, data) {
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }

    _emit(event, data) {
        const cbs = this._listeners[event];
        if (cbs) cbs.forEach(cb => cb(data));
    }

    destroy() {
        this.autoReconnect = false;
        clearTimeout(this._reconnectTimer);
        clearTimeout(this._connectWatchdog);
        if (this.ws) this.ws.close();
    }
}

function redirectLocalOverlayToHttp() {
    if (window.location.protocol !== 'file:') return false;

    const params = new URLSearchParams(window.location.search);
    if (params.get('forceHttpOverlay') !== '1') return false;

    const pathname = window.location.pathname.replace(/\\/g, '/');
    const match = pathname.match(/\/overlays\/([^/]+)\/(?:index\.html|\1\.html)$/i);
    if (!match) return false;

    const wsPort = parseInt(params.get('port'), 10) || 8585;
    const httpPort = parseInt(params.get('httpPort'), 10) || (wsPort + 1);
    const host = params.get('host') || 'localhost';
    const overlayName = match[1];
    const query = window.location.search || '';
    const hash = window.location.hash || '';
    const target = `http://${host}:${httpPort}/overlay/${overlayName}/${query}${hash}`;

    window.location.replace(target);
    return true;
}

/**
 * Parse URL query parameters for overlay config
 * Supports: ?port=8585&host=localhost&theme=dark
 */
function getOverlayParams() {
    if (redirectLocalOverlayToHttp()) {
        return {
            host: 'localhost',
            port: 8585,
            theme: 'default',
            explicitHost: false,
        };
    }

    const params = new URLSearchParams(window.location.search);
    const isFile = window.location.protocol === 'file:';

    if (isFile) {
        const hostParam = params.get('host');
        return {
            host: hostParam || '127.0.0.1',
            port: parseInt(params.get('port'), 10) || 8585,
            theme: params.get('theme') || 'default',
            explicitHost: !!hostParam,
        };
    }

    // Auto-derive WS port: if served from our HTTP server (port = wsPort + 1),
    // the WS port is HTTP port - 1. Explicit ?port= overrides this.
    let port = parseInt(params.get('port'));
    if (!port) {
        const httpPort = parseInt(window.location.port);
        port = httpPort ? httpPort - 1 : 8585;
    }

    const queryHost = params.get('host');
    const runtimeHost = window.location.hostname || '';
    const host = queryHost || ((runtimeHost && runtimeHost !== 'localhost' && runtimeHost !== '127.0.0.1') ? runtimeHost : '');

    return {
        host,
        port,
        theme: params.get('theme') || 'default',
        explicitHost: !!queryHost,
    };
}

/**
 * Inject a visible status banner into the overlay so users can tell
 * whether the WebSocket is connected.  Banner auto-hides once real
 * data (full_state) is received.
 *
 * Call after creating your StreamToolWS instance:
 *   const ws = new StreamToolWS(params);
 *   injectStatusBanner(ws, params.port);
 */
function injectStatusBanner(ws, port) {
    // Disabled by design: this text banner should never appear on stream overlays.
    return;

    // Don't inject if the page already has its own banner (e.g. unified overlay)
    if (document.getElementById('statusBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'statusBanner';
    banner.className = 'ws-status-banner';

    banner.innerHTML =
        '<div class="ws-banner-icon">🔌</div>' +
        '<div>Conectando con EST…</div>' +
        '<div class="ws-banner-detail">Puerto WS: ' + port + '</div>';
    document.body.prepend(banner);

    let dataReceived = false;
    function hide() { banner.classList.add('ws-hidden'); }
    function show(icon, text) {
        if (dataReceived) return;
        banner.querySelector('.ws-banner-icon').textContent = icon;
        banner.querySelectorAll('div')[1].textContent = text;
        banner.classList.remove('ws-hidden');
    }

    // User-facing requirement: once connected, this banner must disappear.
    ws.on('connected', () => hide());
    ws.on('disconnected', () => show('🔌', 'Conectando con EST…'));
    ws.on('full_state', () => { dataReceived = true; hide(); });
    ws.on('team_update', () => { dataReceived = true; hide(); });
    ws.on('badge_update', () => { dataReceived = true; hide(); });
    ws.on('player_update', () => { dataReceived = true; hide(); });
    ws.on('catches_update', () => { dataReceived = true; hide(); });
    ws.on('wild_update', () => { dataReceived = true; hide(); });
    ws.on('trainer_update', () => { dataReceived = true; hide(); });
    ws.on('battle_update', () => { dataReceived = true; hide(); });
    ws.on('lives_update', () => { dataReceived = true; hide(); });
    ws.on('overlay_config', () => { dataReceived = true; hide(); });
}
