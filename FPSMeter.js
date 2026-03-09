/**
 * lite-fps-meter — Lightweight visual FPS monitor
 *
 * Renders a real-time FPS graph on a fixed-position canvas overlay.
 * Auto-detects display refresh rate (60Hz, 120Hz, etc.) and adapts
 * the target line and color thresholds accordingly.
 */

export class FPSMeter {
    constructor({
        textUpdateInterval = 100,
        width = 120,
        height = 50,
        graph = true,
        graphHeight = 30,
        position = 'top-left',
        target = null,
        smoothing = 0.1,
        theme = {}
    } = {}) {
        this.showGraph = graph;
        this.width = width;
        // Auto-shrink height for compact mode
        this.height = this.showGraph ? height : 15; 
        this.graphHeight = this.showGraph ? graphHeight : 0;
        this.textUpdateInterval = textUpdateInterval;
        this.smoothing = smoothing;
        
        // Safely merge user theme with defaults
        this.theme = { 
            good: '#0f0', 
            ok: '#ff0', 
            bad: '#f00', 
            bg: '#111', 
            mid: '#800', 
            detecting: '#aaa', 
            ...theme 
        };

        // Precomputed static render values
        this._targetY = this.height - this.graphHeight;
        this._halfTargetY = this.height - this.graphHeight * 0.5;

        // State
        this.fps = 0;
        this.min = Infinity;
        this.max = 0;
        this.targetFPS = 60;
        
        // Ring buffer for graph
        this.history = new Uint8Array(this.width);
        this.index = 0;

        // Timing & Presentation
        this._lastFrame = 0;
        this._lastTextUpdate = 0;
        this._cachedText = '';
        this._cachedColor = this.theme.good;
        this._running = false;
        
        // Lifecycle Tracking
        this._rafId = null;
        this._detectionRafId = null;
        this._destroyed = false;

        // Bind once
        this._loop = this._loop.bind(this);

        // Detection
        this._isDetecting = true;

        this._initUI(position, target);
        this._updateText();
        this._detectRefreshRate();
        this.start();
    }

    _initUI(position, target) {
        const dpr = window.devicePixelRatio || 1;

        const positions = {
            'top-left':     { top: '0', left: '0' },
            'top-right':    { top: '0', right: '0' },
            'bottom-left':  { bottom: '0', left: '0' },
            'bottom-right': { bottom: '0', right: '0' },
        };
        const pos = positions[position] || positions['top-left'];

        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position: 'fixed', zIndex: '9999',
            padding: '2px', background: '#000', pointerEvents: 'none',
            opacity: '0.9', fontFamily: 'monospace', fontSize: '10px',
            color: this.theme.good, width: `${this.width}px`,
            ...pos,
        });

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        Object.assign(this.canvas.style, {
            width: '100%', height: `${this.height}px`, imageRendering: 'pixelated',
        });

        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.ctx.scale(dpr, dpr);
        this.ctx.font = '10px monospace';

        this.container.appendChild(this.canvas);
        (target || document.body).appendChild(this.container);
    }

    _detectRefreshRate() {
        const start = performance.now();
        let last = start;
        let frames = 0;

        const sample = (now) => {
            if (this._destroyed) return;

            // Pausing pauses the detection window time
            if (!this._running) {
                last = performance.now(); 
                this._detectionRafId = requestAnimationFrame(sample);
                return;
            }

            const delta = now - last;
            last = now;

            if (delta > 0 && delta < 100) frames++;

            if (now - start < 250) {
                this._detectionRafId = requestAnimationFrame(sample);
            } else {
                const elapsed = now - start;
                const avgFPS = (frames / elapsed) * 1000;
                
                this.targetFPS = Math.max(30, Math.min(240, Math.round(avgFPS))) || 60;
                this.min = this.targetFPS;
                this._isDetecting = false;
                this._detectionRafId = null;
                this._updateText();
            }
        };
        this._detectionRafId = requestAnimationFrame(sample);
    }

    start() {
        if (this._running || this._destroyed) return;
        this._running = true;
        this._lastFrame = performance.now();
        this._rafId = requestAnimationFrame(this._loop);
    }

    pause() {
        this._running = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    resume() {
        if (this._destroyed || this._running) return;
        this._running = true;
        this._lastFrame = performance.now();
        this._rafId = requestAnimationFrame(this._loop);
    }

    reset() {
        if (this._destroyed) return;
        this.min = this.targetFPS;
        this.max = 0;
        this.history.fill(0);
        this._updateText();
    }

    _updateText() {
        if (this._destroyed) return;

        if (this._isDetecting) {
            this._cachedText = 'Detecting...';
            this._cachedColor = this.theme.detecting;
            return;
        }

        this._cachedText = `${this.fps.toFixed(1)} FPS (${this.min.toFixed(0)}-${this.max.toFixed(0)})`;
        const ratio = this.fps / this.targetFPS;
        this._cachedColor = ratio >= 0.8 ? this.theme.good : ratio >= 0.5 ? this.theme.ok : this.theme.bad;
    }

    _update(now) {
        const delta = now - this._lastFrame;
        this._lastFrame = now;

        if (delta <= 0) return false;

        const instant = 1000 / delta;
        
        this.fps = this.fps === 0 
            ? instant 
            : this.fps + (instant - this.fps) * this.smoothing;

        if (!this._isDetecting) {
            if (this.fps < this.min) this.min = this.fps;
            if (this.fps > this.max) this.max = this.fps;
        }

        if (this.showGraph) {
            this.history[this.index] = Math.min(
                this.graphHeight,
                (this.fps / this.targetFPS) * this.graphHeight
            );
            this.index = (this.index + 1) % this.width;
        }

        if (now - this._lastTextUpdate >= this.textUpdateInterval) {
            this._updateText();
            this._lastTextUpdate = now;
        }

        return true;
    }

    _draw() {
        const { ctx, width, height, theme, showGraph } = this;

        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = this._cachedColor;
        ctx.fillText(this._cachedText, 2, showGraph ? 10 : 11);

        if (showGraph) {
            for (let i = 0; i < width; i++) {
                const h = this.history[(this.index + i) % width];
                if (h > 0) ctx.fillRect(i, height - h, 1, h);
            }

            ctx.fillStyle = theme.bad;
            ctx.fillRect(0, this._targetY, width, 1);
            ctx.fillStyle = theme.mid;
            ctx.fillRect(0, this._halfTargetY, width, 1);
        }
    }

    _loop(now) {
        if (this._destroyed || !this._running) return;
        
        const shouldDraw = this._update(now);
        if (shouldDraw) this._draw();
        
        this._rafId = requestAnimationFrame(this._loop);
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this.pause();

        if (this._detectionRafId) {
            cancelAnimationFrame(this._detectionRafId);
            this._detectionRafId = null;
        }

        this.container.remove();
    }
}

export default FPSMeter;
