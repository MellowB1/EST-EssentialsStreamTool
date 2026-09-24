/**
 * Overlay Sprite Animator
 * 
 * Handles animated Pokemon spritesheets in overlay HTML pages.
 * Uses a single shared requestAnimationFrame loop for all sprites.
 *
 * Detection logic (DBK convention for Pokemon Essentials):
 *   - If image width > height × 2 → horizontal spritesheet
 *   - Each frame is square (height × height)
 *   - frameCount = ceil(width / height)
 *
 * The server enriches Pokemon data with:
 *   spritePath     — HTTP URL to the sprite image
 *   spriteFrames   — number of animation frames (1 = static)
 *   spriteFrameW   — width of one frame in pixels
 *   spriteFrameH   — height of one frame in pixels
 *
 * Usage:
 *   <script src="../shared/sprite-animator.js"></script>
 *   SpriteAnimator.fromPokemon(containerEl, poke, { displaySize: 40 });
 */

const SpriteAnimator = (() => {
    // ─── Constants ──────────────────────────────────────────────
    const DEFAULT_FPS = 16;
    const SPRITESHEET_WIDTH_RATIO = 2;

    // ─── Shared rAF animation loop ──────────────────────────
    const _entries = new Map();   // container → { el, frameCount, cssW, frame, frameDuration, lastTime }
    const _containerGen = new WeakMap();
    let _rafId = null;

    function _nextGen(container) {
        const next = (_containerGen.get(container) || 0) + 1;
        _containerGen.set(container, next);
        return next;
    }

    function _currentGen(container) {
        return _containerGen.get(container) || 0;
    }

    function _tick(now) {
        for (const [, e] of _entries) {
            const elapsed = now - e.lastTime;
            if (elapsed >= e.frameDuration) {
                e.frame = (e.frame + 1) % e.frameCount;
                if (e.fitOffsetX !== undefined) {
                    // autoFit mode: custom per-frame offset to keep content centered
                    const x = e.fitOffsetX - e.frame * e.frameStepX;
                    e.el.style.backgroundPosition = `${x}px ${e.fitOffsetY}px`;
                } else {
                    e.el.style.backgroundPosition = `${-(e.frame * e.cssW)}px 0`;
                }
                e.lastTime = now - (elapsed % e.frameDuration);
            }
        }
        if (_entries.size > 0) {
            _rafId = requestAnimationFrame(_tick);
        } else {
            _rafId = null;
        }
    }

    function _startLoop() {
        if (_rafId === null && _entries.size > 0) {
            _rafId = requestAnimationFrame(_tick);
        }
    }

    function _register(container, entry) {
        _entries.set(container, entry);
        _startLoop();
    }

    function _unregister(container) {
        _entries.delete(container);
        if (_entries.size === 0 && _rafId !== null) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
    }

    /**
     * Animate a spritesheet into a container element.
     */
    function animate(container, src, opts = {}) {
        if (!container) return;
        const gen = _nextGen(container);
        _unregister(container);

        if (!src) {
            if (_currentGen(container) !== gen || !container.isConnected) return;
            container.innerHTML = '';
            return;
        }

        const fps = opts.fps || DEFAULT_FPS;
        const className = opts.className || 'sprite';
        const displaySize = opts.displaySize || null;
        const autoFit = !!(opts.autoFit && displaySize);

        const hasFrameInfo = !!(opts.frameCount && opts.frameCount > 1 && opts.frameW && opts.frameH);

        // Fast path: server provides frame info and no content-fit analysis needed
        if (hasFrameInfo && !autoFit) {
            if (_currentGen(container) !== gen || !container.isConnected) return;
            _createAnimated(container, src, opts.frameCount, opts.frameW, opts.frameH, fps, className, displaySize);
            return;
        }

        // Load image for auto-detection or autoFit pixel analysis
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => {
            if (_currentGen(container) !== gen || !container.isConnected) return;
            const w = probe.naturalWidth;
            const h = probe.naturalHeight;

            let frameCount, frameW, frameH, isAnimated;

            if (hasFrameInfo) {
                frameCount = opts.frameCount;
                frameW = opts.frameW;
                frameH = opts.frameH;
                isAnimated = true;
            } else if (h > 0 && w > h * SPRITESHEET_WIDTH_RATIO) {
                frameCount = Math.ceil(w / h);
                frameW = h;
                frameH = h;
                isAnimated = true;
            } else {
                frameCount = 1;
                frameW = w;
                frameH = h;
                isAnimated = false;
            }

            if (autoFit) {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(probe, 0, 0);
                let imageData;
                try {
                    imageData = ctx.getImageData(0, 0, w, h);
                } catch (_e) {
                    // Tainted canvas (CORS) — fall back to standard rendering
                    if (isAnimated) _createAnimated(container, src, frameCount, frameW, frameH, fps, className, displaySize);
                    else _createStatic(container, src, className, displaySize);
                    return;
                }

                const bounds = _analyzeContentBounds(imageData, 0, 0, frameW, frameH);
                if (bounds && bounds.w > 0 && bounds.h > 0) {
                    const fitSize = displaySize * 0.9;
                    if (isAnimated) _createAnimatedFitted(container, src, frameCount, frameW, frameH, fps, className, displaySize, bounds, fitSize);
                    else _createStaticFitted(container, src, className, displaySize, bounds, w, h, fitSize);
                } else {
                    if (isAnimated) _createAnimated(container, src, frameCount, frameW, frameH, fps, className, displaySize);
                    else _createStatic(container, src, className, displaySize);
                }
            } else {
                if (isAnimated) _createAnimated(container, src, frameCount, frameW, frameH, fps, className, displaySize);
                else _createStatic(container, src, className, displaySize);
            }
        };
        probe.onerror = () => {
            if (_currentGen(container) !== gen) return;
            _unregister(container);
            if (container.isConnected) container.innerHTML = '';
            if (typeof opts.onError === 'function') opts.onError();
        };
        probe.src = src;
    }

    /**
     * Display a static (single-frame) sprite.
     */
    function setStatic(container, src, opts = {}) {
        if (!container) return;
        stop(container);
        const className = opts.className || 'sprite';
        const displaySize = opts.displaySize || null;
        _createStatic(container, src, className, displaySize);
    }

    /**
     * Stop animation on a container.
     */
    function stop(container) {
        if (!container) return;
        _nextGen(container);
        _unregister(container);
    }

    // ─── Internal ─────────────────────────────────────────

    function _createAnimated(container, src, frameCount, frameW, frameH, fps, className, displaySize) {
        const el = document.createElement('div');
        el.className = className + ' sprite-animated';

        const cssW = displaySize || frameW;
        const cssH = displaySize || frameH;
        const sheetW = cssW * frameCount;
        const sheetH = cssH;

        el.style.width = cssW + 'px';
        el.style.height = cssH + 'px';
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundSize = `${sheetW}px ${sheetH}px`;
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = '0 0';
        el.style.imageRendering = 'pixelated';
        el.style.display = 'inline-block';

        container.innerHTML = '';
        container.appendChild(el);

        _register(container, {
            el,
            frameCount,
            cssW,
            frame: 0,
            frameDuration: Math.round(1000 / fps),
            lastTime: performance.now(),
        });
    }

    function _createStatic(container, src, className, displaySize) {
        const img = document.createElement('img');
        img.className = className;
        img.src = src || '';
        img.alt = '';
        img.style.imageRendering = 'pixelated';
        if (displaySize) {
            img.style.width = displaySize + 'px';
            img.style.height = displaySize + 'px';
        }
        img.onerror = () => { img.style.display = 'none'; };
        container.innerHTML = '';
        container.appendChild(img);
    }

    /**
     * Scan ImageData for the bounding box of non-transparent pixels within a frame region.
     * Returns { x, y, w, h } in frame-local coords, or null if frame is fully transparent.
     */
    function _analyzeContentBounds(imageData, x0, y0, frameW, frameH) {
        const { data, width } = imageData;
        let minX = frameW, maxX = -1, minY = frameH, maxY = -1;
        const ALPHA_THRESHOLD = 20;

        for (let row = 0; row < frameH; row++) {
            for (let col = 0; col < frameW; col++) {
                const idx = ((y0 + row) * width + (x0 + col)) * 4;
                if (data[idx + 3] > ALPHA_THRESHOLD) {
                    if (col < minX) minX = col;
                    if (col > maxX) maxX = col;
                    if (row < minY) minY = row;
                    if (row > maxY) maxY = row;
                }
            }
        }

        if (maxX < 0) return null;
        return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    /**
     * Render a static sprite scaled so its content fills fitSize inside a displaySize box.
     * Uses background-image for consistent clipping behaviour with the animated variant.
     */
    function _createStaticFitted(container, src, className, displaySize, bounds, naturalW, naturalH, fitSize) {
        const el = document.createElement('div');
        el.className = className;
        el.style.width = displaySize + 'px';
        el.style.height = displaySize + 'px';
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundRepeat = 'no-repeat';
        el.style.imageRendering = 'pixelated';
        el.style.display = 'inline-block';

        const scale = fitSize / Math.max(bounds.w, bounds.h);
        el.style.backgroundSize = `${naturalW * scale}px ${naturalH * scale}px`;

        const offsetX = displaySize / 2 - (bounds.x + bounds.w / 2) * scale;
        const offsetY = displaySize / 2 - (bounds.y + bounds.h / 2) * scale;
        el.style.backgroundPosition = `${offsetX}px ${offsetY}px`;

        container.innerHTML = '';
        container.appendChild(el);
    }

    /**
     * Render an animated spritesheet scaled so its content fills fitSize inside a displaySize box.
     * Outer = displaySize layout box (overflow visible so bob/jump is not clipped).
     * Inner = exactly one scaled frame with overflow hidden so adjacent spritesheet frames
     * never leak into the sides of the box.
     */
    function _createAnimatedFitted(container, src, frameCount, frameW, frameH, fps, className, displaySize, bounds, fitSize) {
        const scale = fitSize / Math.max(bounds.w, bounds.h);
        const frameStepX = frameW * scale;
        const frameStepY = frameH * scale;

        const outer = document.createElement('div');
        outer.className = className + ' sprite-animated';
        outer.style.width = displaySize + 'px';
        outer.style.height = displaySize + 'px';
        outer.style.position = 'relative';
        outer.style.overflow = 'visible';
        outer.style.display = 'inline-block';
        outer.style.imageRendering = 'pixelated';

        const inner = document.createElement('div');
        inner.style.position = 'absolute';
        inner.style.overflow = 'hidden';
        inner.style.width = frameStepX + 'px';
        inner.style.height = frameStepY + 'px';
        inner.style.backgroundImage = `url("${src}")`;
        inner.style.backgroundRepeat = 'no-repeat';
        inner.style.backgroundSize = `${frameStepX * frameCount}px ${frameStepY}px`;
        inner.style.backgroundPosition = '0 0';
        inner.style.imageRendering = 'pixelated';
        // Center content (not the raw frame) inside the display box
        inner.style.left = (displaySize / 2 - (bounds.x + bounds.w / 2) * scale) + 'px';
        inner.style.top = (displaySize / 2 - (bounds.y + bounds.h / 2) * scale) + 'px';

        outer.appendChild(inner);
        container.innerHTML = '';
        container.appendChild(outer);

        // Register inner for standard frame stepping (no fitOffset — offsets are left/top)
        _register(container, {
            el: inner,
            frameCount,
            cssW: frameStepX,
            frame: 0,
            frameDuration: Math.round(1000 / fps),
            lastTime: performance.now(),
        });
    }

    /**
     * Convenience: create an animated sprite from a Pokemon data object.
     */
    function fromPokemon(container, poke, opts = {}) {
        if (!container) return;
        if (!poke || !poke.spritePath) {
            stop(container);
            container.innerHTML = '';
            return;
        }
        animate(container, poke.spritePath, {
            frameCount: poke.spriteFrames || 1,
            frameW: poke.spriteFrameW || 0,
            frameH: poke.spriteFrameH || 0,
            ...opts,
        });
    }

    return { animate, setStatic, stop, fromPokemon, DEFAULT_FPS };
})();
