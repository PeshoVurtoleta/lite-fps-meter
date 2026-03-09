import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ──────────────────────────────────────────────
//  Canvas mock — jsdom lacks canvas rendering
// ──────────────────────────────────────────────

const canvasCtxMock = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100) })),
    fillStyle: '',
    font: '',
};

HTMLCanvasElement.prototype.getContext = vi.fn(function () {
    return canvasCtxMock;
});

import { FPSMeter } from './FPSMeter.js';

describe('📊 FPSMeter', () => {
    let meter;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();

        let rafId = 1;
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => rafId++);
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

        meter = new FPSMeter({ textUpdateInterval: 100 });
    });

    afterEach(() => {
        meter?.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ── Constructor & Defaults ──

    it('creates a container element in the DOM', () => {
        expect(document.body.contains(meter.container)).toBe(true);
    });

    it('creates a canvas element', () => {
        expect(meter.canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    it('starts running immediately', () => {
        expect(meter._running).toBe(true);
    });

    it('initializes history as Uint8Array', () => {
        expect(meter.history).toBeInstanceOf(Uint8Array);
        expect(meter.history.length).toBe(meter.width);
    });

    it('has sensible defaults', () => {
        expect(meter.width).toBe(120);
        expect(meter.height).toBe(50);
        expect(meter.graphHeight).toBe(30);
        expect(meter.targetFPS).toBe(60);
        expect(meter.smoothing).toBe(0.1);
        expect(meter.showGraph).toBe(true);
    });

    it('accepts custom dimensions', () => {
        const custom = new FPSMeter({ width: 200, height: 80, graphHeight: 50 });
        expect(custom.width).toBe(200);
        expect(custom.height).toBe(80);
        expect(custom.graphHeight).toBe(50);
        custom.destroy();
    });

    it('sets explicit font on canvas context', () => {
        expect(canvasCtxMock.font).toBe('10px monospace');
    });

    it('shows "Detecting..." on init', () => {
        expect(meter._cachedText).toBe('Detecting...');
        expect(meter._cachedColor).toBe(meter.theme.detecting);
    });

    // ── Smoothing option ──

    it('accepts custom smoothing factor', () => {
        const m = new FPSMeter({ smoothing: 0.3 });
        expect(m.smoothing).toBe(0.3);
        m.destroy();
    });

    // ── Theme option ──

    it('has default theme colors', () => {
        expect(meter.theme.good).toBe('#0f0');
        expect(meter.theme.ok).toBe('#ff0');
        expect(meter.theme.bad).toBe('#f00');
        expect(meter.theme.bg).toBe('#111');
        expect(meter.theme.mid).toBe('#800');
        expect(meter.theme.detecting).toBe('#aaa');
    });

    it('merges custom theme with defaults', () => {
        const m = new FPSMeter({ theme: { good: '#00ff00', bg: '#000' } });
        expect(m.theme.good).toBe('#00ff00');
        expect(m.theme.bg).toBe('#000');
        expect(m.theme.ok).toBe('#ff0');   // default preserved
        expect(m.theme.bad).toBe('#f00');   // default preserved
        m.destroy();
    });

    // ── Graph toggle / Compact mode ──

    it('defaults to showing graph', () => {
        expect(meter.showGraph).toBe(true);
        expect(meter.height).toBe(50);
        expect(meter.graphHeight).toBe(30);
    });

    it('compact mode: shrinks height to 15 and graphHeight to 0', () => {
        const m = new FPSMeter({ graph: false });
        expect(m.showGraph).toBe(false);
        expect(m.height).toBe(15);
        expect(m.graphHeight).toBe(0);
        m.destroy();
    });

    it('compact mode: skips history writes in _update', () => {
        const m = new FPSMeter({ graph: false });
        m._isDetecting = false;
        m._lastFrame = 0;

        m._update(16.67);
        // History should remain all zeros — no writes
        const sum = m.history.reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
        m.destroy();
    });

    it('compact mode: _draw skips bar loop and target lines', () => {
        const m = new FPSMeter({ graph: false });
        m.fps = 60;
        m._cachedText = '60.0 FPS (60-60)';
        m._cachedColor = m.theme.good;
        canvasCtxMock.fillRect.mockClear();
        canvasCtxMock.fillText.mockClear();

        m._draw();

        // Only background fillRect + text fillText
        expect(canvasCtxMock.fillText).toHaveBeenCalledTimes(1);
        // 1 background fillRect, no bar rects, no target lines
        expect(canvasCtxMock.fillRect).toHaveBeenCalledTimes(1);
        m.destroy();
    });

    // ── Position option ──

    it('defaults to top-left position', () => {
        expect(meter.container.style.top).toBe('0px');
        expect(meter.container.style.left).toBe('0px');
    });

    it('supports top-right position', () => {
        const m = new FPSMeter({ position: 'top-right' });
        expect(m.container.style.top).toBe('0px');
        expect(m.container.style.right).toBe('0px');
        m.destroy();
    });

    it('supports bottom-left position', () => {
        const m = new FPSMeter({ position: 'bottom-left' });
        expect(m.container.style.bottom).toBe('0px');
        expect(m.container.style.left).toBe('0px');
        m.destroy();
    });

    it('supports bottom-right position', () => {
        const m = new FPSMeter({ position: 'bottom-right' });
        expect(m.container.style.bottom).toBe('0px');
        expect(m.container.style.right).toBe('0px');
        m.destroy();
    });

    // ── Mount target option ──

    it('mounts to custom target element', () => {
        const target = document.createElement('div');
        document.body.appendChild(target);
        const m = new FPSMeter({ target });
        expect(target.contains(m.container)).toBe(true);
        m.destroy();
        target.remove();
    });

    // ── start/pause/resume ──

    it('start() is idempotent (no-op if already running)', () => {
        const callsBefore = requestAnimationFrame.mock.calls.length;
        meter.start();
        expect(requestAnimationFrame.mock.calls.length).toBe(callsBefore);
    });

    it('start() is no-op after destroy', () => {
        meter.destroy();
        meter._running = false;
        meter.start();
        expect(meter._running).toBe(false);
    });

    it('pause() stops the loop', () => {
        meter.pause();
        expect(meter._running).toBe(false);
    });

    it('pause() cancels rAF', () => {
        meter._rafId = 42;
        meter.pause();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
        expect(meter._rafId).toBeNull();
    });

    it('resume() restarts after pause', () => {
        meter.pause();
        meter.resume();
        expect(meter._running).toBe(true);
    });

    it('resume() resets _lastFrame to prevent delta spike', () => {
        meter.pause();
        const before = performance.now();
        meter.resume();
        expect(meter._lastFrame).toBeGreaterThanOrEqual(before);
    });

    it('resume() is no-op if already running', () => {
        const callsBefore = requestAnimationFrame.mock.calls.length;
        meter.resume();
        expect(requestAnimationFrame.mock.calls.length).toBe(callsBefore);
    });

    it('resume() is no-op after destroy', () => {
        meter.destroy();
        meter._running = false;
        meter.resume();
        expect(meter._running).toBe(false);
    });

    // ── reset ──

    it('reset() clears min/max/history', () => {
        meter.min = 10;
        meter.max = 120;
        meter.history[0] = 42;
        meter.reset();
        expect(meter.min).toBe(meter.targetFPS);
        expect(meter.max).toBe(0);
        expect(meter.history[0]).toBe(0);
    });

    it('reset() refreshes text', () => {
        meter._isDetecting = false;
        meter.fps = 55;
        meter.reset();
        expect(meter._cachedText).toContain('FPS');
    });

    it('reset() is no-op after destroy', () => {
        meter.destroy();
        expect(() => meter.reset()).not.toThrow();
    });

    // ── _updateText ──

    it('_updateText shows detecting text during detection', () => {
        meter._isDetecting = true;
        meter._updateText();
        expect(meter._cachedText).toBe('Detecting...');
        expect(meter._cachedColor).toBe(meter.theme.detecting);
    });

    it('_updateText shows FPS after detection', () => {
        meter._isDetecting = false;
        meter.fps = 58.5;
        meter.min = 55;
        meter.max = 62;
        meter._updateText();
        expect(meter._cachedText).toBe('58.5 FPS (55-62)');
    });

    it('_updateText sets green color for high FPS', () => {
        meter._isDetecting = false;
        meter.fps = 55;
        meter.targetFPS = 60;
        meter._updateText();
        expect(meter._cachedColor).toBe(meter.theme.good);
    });

    it('_updateText sets yellow color for medium FPS', () => {
        meter._isDetecting = false;
        meter.fps = 36;
        meter.targetFPS = 60;
        meter._updateText();
        expect(meter._cachedColor).toBe(meter.theme.ok);
    });

    it('_updateText sets red color for low FPS', () => {
        meter._isDetecting = false;
        meter.fps = 20;
        meter.targetFPS = 60;
        meter._updateText();
        expect(meter._cachedColor).toBe(meter.theme.bad);
    });

    it('_updateText is no-op after destroy', () => {
        meter.destroy();
        meter._cachedText = 'before';
        meter._updateText();
        expect(meter._cachedText).toBe('before');
    });

    // ── _update ──

    it('_update calculates FPS from delta', () => {
        meter._lastFrame = 0;
        meter.fps = 0;
        const result = meter._update(16.67);
        expect(result).toBe(true);
        expect(meter.fps).toBeGreaterThan(0);
    });

    it('_update uses smoothing factor for EMA', () => {
        const m = new FPSMeter({ smoothing: 0.5 });
        m._isDetecting = false;
        m._lastFrame = 0;
        m.fps = 60;

        m._update(33.33); // ~30fps instant
        // With α=0.5: fps = 60 + (30 - 60) * 0.5 = 45
        expect(m.fps).toBeCloseTo(45, 0);
        m.destroy();
    });

    it('_update returns false for zero delta', () => {
        meter._lastFrame = 100;
        meter.fps = 60;
        const result = meter._update(100);
        expect(result).toBe(false);
        expect(meter.fps).toBe(60);
    });

    it('_update returns false for negative delta', () => {
        meter._lastFrame = 100;
        meter.fps = 60;
        const result = meter._update(50);
        expect(result).toBe(false);
        expect(meter.fps).toBe(60);
    });

    it('_update tracks min/max when not detecting', () => {
        meter._isDetecting = false;
        meter.min = 60;
        meter.max = 60;
        meter._lastFrame = 0;

        meter._update(33.33); // ~30fps
        expect(meter.min).toBeLessThan(60);
    });

    it('_update does not track min/max during detection', () => {
        meter._isDetecting = true;
        meter.min = Infinity;
        meter.max = 0;
        meter._lastFrame = 0;

        meter._update(16.67);
        expect(meter.min).toBe(Infinity);
        expect(meter.max).toBe(0);
    });

    it('_update wraps history index', () => {
        meter.index = meter.width - 1;
        meter._lastFrame = 0;
        meter._update(16.67);
        expect(meter.index).toBe(0);
    });

    it('_update throttles text updates', () => {
        meter._lastTextUpdate = 0;
        meter._lastFrame = 0;
        meter._isDetecting = false;

        meter._update(50); // 50ms < 100ms interval
        expect(meter._cachedText).toBe('Detecting...'); // unchanged from init
    });

    it('_update refreshes text at interval', () => {
        meter._lastTextUpdate = 0;
        meter._lastFrame = 0;
        meter._isDetecting = false;
        meter.min = 55;
        meter.max = 62;

        meter._update(200); // 200ms > 100ms interval
        expect(meter._cachedText).toContain('FPS');
    });

    // ── _draw ──

    it('_draw renders text and background', () => {
        meter.fps = 60;
        meter._cachedText = '60.0 FPS (55-62)';
        meter._cachedColor = '#0f0';
        canvasCtxMock.fillText.mockClear();

        meter._draw();

        expect(canvasCtxMock.fillText).toHaveBeenCalledWith('60.0 FPS (55-62)', 2, 10);
    });

    it('_draw renders graph bars and target lines when graph enabled', () => {
        meter.fps = 60;
        meter._cachedText = '60 FPS';
        meter._cachedColor = '#0f0';
        canvasCtxMock.fillRect.mockClear();

        meter._draw();

        // background (1) + bars (up to width) + 2 target lines
        expect(canvasCtxMock.fillRect.mock.calls.length).toBeGreaterThan(2);
    });

    // ── _loop ──

    it('_loop calls _update and _draw on valid frame', () => {
        meter._lastFrame = 0;
        meter.fps = 0;
        canvasCtxMock.fillRect.mockClear();

        meter._loop(16.67);

        expect(meter.fps).toBeGreaterThan(0);
        expect(canvasCtxMock.fillRect).toHaveBeenCalled();
    });

    it('_loop skips draw on zero delta', () => {
        meter._lastFrame = 100;
        canvasCtxMock.fillRect.mockClear();

        meter._loop(100);

        expect(canvasCtxMock.fillRect).not.toHaveBeenCalled();
    });

    it('_loop no-ops when not running', () => {
        meter._running = false;
        const fpsBefore = meter.fps;
        meter._loop(16.67);
        expect(meter.fps).toBe(fpsBefore);
    });

    it('_loop no-ops when destroyed', () => {
        meter._destroyed = true;
        const fpsBefore = meter.fps;
        meter._loop(16.67);
        expect(meter.fps).toBe(fpsBefore);
    });

    it('_loop schedules next frame', () => {
        const callsBefore = requestAnimationFrame.mock.calls.length;
        meter._lastFrame = 0;
        meter._loop(16.67);
        expect(requestAnimationFrame.mock.calls.length).toBe(callsBefore + 1);
    });

    // ── Refresh Rate Detection ──

    describe('refresh rate detection', () => {
        let rafCallbacks;
        let rAfSpy;

        beforeEach(() => {
            rafCallbacks = [];
            rAfSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
                rafCallbacks.push(cb);
                return Math.random();
            });
        });

        afterEach(() => {
            rAfSpy.mockRestore();
        });

        it('detects a standard 60Hz refresh rate', () => {
            const m = new FPSMeter();
            expect(m._isDetecting).toBe(true);

            let currentTime = performance.now();

            // Run enough frames to exceed the 250ms detection window
            for (let i = 0; i < 20; i++) {
                currentTime += 16.666;
                const cbs = rafCallbacks;
                rafCallbacks = [];
                cbs.forEach(cb => cb(currentTime));
            }

            expect(m._isDetecting).toBe(false);
            expect(m.targetFPS).toBe(60);
        });

        it('detects a high 120Hz refresh rate', () => {
            const m = new FPSMeter();
            let currentTime = performance.now();

            for (let i = 0; i < 40; i++) {
                currentTime += 8.333;
                const cbs = rafCallbacks;
                rafCallbacks = [];
                cbs.forEach(cb => cb(currentTime));
            }

            expect(m._isDetecting).toBe(false);
            expect(m.targetFPS).toBe(120);
        });

        it('updates text immediately after detection completes', () => {
            const m = new FPSMeter();
            expect(m._cachedText).toBe('Detecting...');

            let currentTime = performance.now();
            for (let i = 0; i < 20; i++) {
                currentTime += 16.666;
                const cbs = rafCallbacks;
                rafCallbacks = [];
                cbs.forEach(cb => cb(currentTime));
            }

            expect(m._cachedText).toContain('FPS');
        });

        it('detection survives pause (resets last timestamp)', () => {
            const m = new FPSMeter();
            m.pause(); // pause but detection rAF still fires

            let currentTime = performance.now();
            for (let i = 0; i < 5; i++) {
                currentTime += 16.666;
                const cbs = rafCallbacks;
                rafCallbacks = [];
                cbs.forEach(cb => cb(currentTime));
            }

            // Detection should still be running (rAF re-requested)
            expect(rafCallbacks.length).toBeGreaterThan(0);
        });

        it('detection stops on destroy', () => {
            const m = new FPSMeter();
            m.destroy();

            const cbs = rafCallbacks;
            rafCallbacks = [];
            cbs.forEach(cb => cb(performance.now() + 16.666));

            expect(rafCallbacks.length).toBe(0);
        });
    });

    // ── Precomputed values ──

    it('precomputes _targetY and _halfTargetY', () => {
        expect(meter._targetY).toBe(meter.height - meter.graphHeight);
        expect(meter._halfTargetY).toBe(meter.height - meter.graphHeight * 0.5);
    });

    it('compact mode sets _targetY to height (no graph offset)', () => {
        const m = new FPSMeter({ graph: false });
        expect(m._targetY).toBe(m.height);
        expect(m._halfTargetY).toBe(m.height);
        m.destroy();
    });

    // ── destroy ──

    it('destroy removes container from DOM', () => {
        meter.destroy();
        expect(document.body.contains(meter.container)).toBe(false);
    });

    it('destroy pauses the loop', () => {
        meter.destroy();
        expect(meter._running).toBe(false);
    });

    it('destroy cancels detection rAF', () => {
        meter._detectionRafId = 42;
        meter.destroy();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    });

    it('destroy is idempotent', () => {
        meter.destroy();
        expect(() => meter.destroy()).not.toThrow();
    });

    it('destroy sets _destroyed flag', () => {
        meter.destroy();
        expect(meter._destroyed).toBe(true);
    });
});
