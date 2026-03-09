/**
 * lite-fps-meter — Lightweight visual FPS monitor
 */

export interface FPSMeterTheme {
    /** Color when FPS ≥ 80% of target. Default: '#0f0' */
    good?: string;
    /** Color when FPS 50–80% of target. Default: '#ff0' */
    ok?: string;
    /** Color when FPS < 50% of target. Default: '#f00' */
    bad?: string;
    /** Background color. Default: '#111' */
    bg?: string;
    /** 50% target line color. Default: '#800' */
    mid?: string;
    /** Text color during refresh rate detection. Default: '#aaa' */
    detecting?: string;
}

export interface FPSMeterOptions {
    /** Minimum interval (ms) between text label updates. Default: 100 */
    textUpdateInterval?: number;
    /** Canvas width in CSS pixels. Default: 120 */
    width?: number;
    /** Canvas height in CSS pixels. Default: 50 (15 when graph is false) */
    height?: number;
    /** Show the scrolling bar graph. When false, renders text-only in compact mode. Default: true */
    graph?: boolean;
    /** Height of the graph area in CSS pixels. Default: 30 */
    graphHeight?: number;
    /** Corner position of the overlay. Default: 'top-left' */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** DOM element to mount the overlay into. Default: document.body */
    target?: HTMLElement | null;
    /** EMA smoothing factor (0–1). Lower = smoother, higher = more responsive. Default: 0.1 */
    smoothing?: number;
    /** Color theme overrides. Merged with defaults. */
    theme?: FPSMeterTheme;
}

export class FPSMeter {
    /** Current smoothed FPS (exponential moving average). */
    readonly fps: number;
    /** Minimum FPS recorded since last reset (excludes detection phase). */
    readonly min: number;
    /** Maximum FPS recorded since last reset (excludes detection phase). */
    readonly max: number;
    /** Detected display refresh rate (30–240 Hz). */
    readonly targetFPS: number;
    /** Whether the graph is rendered (false = compact text-only mode). */
    readonly showGraph: boolean;
    /** Canvas width in CSS pixels. */
    readonly width: number;
    /** Canvas height in CSS pixels (auto-shrinks to 15 in compact mode). */
    readonly height: number;
    /** Graph area height in CSS pixels (0 in compact mode). */
    readonly graphHeight: number;
    /** EMA smoothing factor. */
    readonly smoothing: number;
    /** Active color theme (merged defaults + overrides). */
    readonly theme: Required<FPSMeterTheme>;

    /**
     * Create an FPS meter and immediately start measuring.
     * Auto-detects the display refresh rate over the first ~250ms.
     */
    constructor(options?: FPSMeterOptions);

    /** Start the measurement loop. No-op if already running or destroyed. */
    start(): void;

    /** Pause the measurement loop. Cancels the active rAF. */
    pause(): void;

    /** Resume after pause. Resets the frame timestamp to avoid delta spikes. */
    resume(): void;

    /** Reset min/max counters, clear the history graph, and refresh the text label. */
    reset(): void;

    /**
     * Stop the meter and remove its DOM elements.
     * Cancels all pending rAF frames (including detection).
     * Idempotent — safe to call multiple times.
     */
    destroy(): void;
}

export default FPSMeter;
