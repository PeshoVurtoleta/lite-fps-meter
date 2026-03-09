# lite-fps-meter

[![npm version](https://img.shields.io/npm/v/lite-fps-meter.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/lite-fps-meter)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/lite-fps-meter?style=for-the-badge)](https://bundlephobia.com/result?p=lite-fps-meter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A lightweight, zero-dependency FPS monitor that renders a real-time graph overlay on a canvas element.

Drop it into any web project during development to spot jank, profile animations, or verify you're hitting your target frame rate. Auto-detects the display refresh rate (60Hz, 120Hz, 144Hz, etc.) and adapts thresholds automatically.

## Features

- **Zero dependencies** — single ES module, no build step required
- **Auto-detects refresh rate** — adapts target from 30Hz to 240Hz displays
- **Canvas-rendered graph** — scrolling history bar chart with color-coded thresholds
- **Compact mode** — text-only readout when `graph: false` (15px tall)
- **EMA smoothing** — configurable exponential moving average for stable readouts
- **Themeable** — override any color (good/ok/bad/bg/mid/detecting)
- **Configurable** — position, dimensions, smoothing factor, mount target
- **Clean teardown** — `destroy()` cancels all rAF frames and removes DOM elements

## Installation

```bash
npm install lite-fps-meter
```

Or drop the file directly into your project — it's a single ES module.

## Quick Start

```javascript
import { FPSMeter } from 'lite-fps-meter';

// Create and start (auto-attaches to document.body)
const meter = new FPSMeter();

// Later: clean up
meter.destroy();
```

A fixed-position overlay appears in the top-left corner showing current FPS, min/max range, and a scrolling bar graph.

## Options

```javascript
const meter = new FPSMeter({
    width: 120,              // Canvas width (px)
    height: 50,              // Canvas height (px) — auto-shrinks to 15 when graph: false
    graph: true,             // Show scrolling bar graph (false = compact text-only)
    graphHeight: 30,         // Graph area height (px)
    textUpdateInterval: 100, // Min ms between text refreshes
    smoothing: 0.1,          // EMA factor (0–1). Lower = smoother, higher = responsive
    position: 'top-left',    // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    target: null,            // Mount target element (default: document.body)
    theme: {                 // Color overrides (merged with defaults)
        good: '#0f0',        // ≥ 80% of target FPS
        ok: '#ff0',          // 50–80% of target
        bad: '#f00',         // < 50% of target
        bg: '#111',          // Background
        mid: '#800',         // 50% target line
        detecting: '#aaa',   // Text during refresh rate detection
    },
});
```

### Compact Mode

For a minimal footprint, disable the graph. The meter shrinks to a 15px-tall text-only readout:

```javascript
const meter = new FPSMeter({ graph: false, position: 'bottom-right' });
```

## API

| Method | Description |
|--------|-------------|
| `new FPSMeter(options?)` | Create meter and start measuring immediately |
| `.pause()` | Pause the measurement loop |
| `.resume()` | Resume after pause (resets timestamp to avoid delta spike) |
| `.reset()` | Clear min/max counters, history graph, and refresh text |
| `.destroy()` | Stop everything, remove DOM elements. Idempotent. |

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `.fps` | `number` | Current smoothed FPS (EMA) |
| `.min` | `number` | Minimum FPS since last reset |
| `.max` | `number` | Maximum FPS since last reset |
| `.targetFPS` | `number` | Detected display refresh rate |
| `.showGraph` | `boolean` | Whether the bar graph is rendered |
| `.smoothing` | `number` | EMA smoothing factor |
| `.theme` | `object` | Active color theme |

## Color Thresholds

The graph and text change color based on current FPS relative to the detected target:

| Color | Condition |
|-------|-----------|
| 🟢 Green | ≥ 80% of target |
| 🟡 Yellow | 50–80% of target |
| 🔴 Red | < 50% of target |

## How It Works

**Refresh rate detection:** On creation, the meter counts `requestAnimationFrame` callbacks over a 250ms window and derives the average frame rate. Background-throttled frames (>100ms) are discarded. The result is clamped to 30–240Hz. Detection survives pause — it resumes timing when the meter restarts.

**FPS calculation:** Each frame computes an instantaneous FPS from the delta, then applies an exponential moving average: `fps = fps + (instant - fps) * smoothing`. Zero and negative deltas (tab resume, first frame) are skipped to prevent Infinity from polluting the average.

**Graph rendering:** A `Uint8Array` ring buffer stores the last N frame heights. On each draw, the buffer is read from the current index (oldest) to produce a left-to-right scrolling chart. Two reference lines mark 100% and 50% of the target FPS. In compact mode, the buffer is never written and the bar loop is skipped entirely.

## TypeScript

Full type definitions included:

```typescript
import { FPSMeter, type FPSMeterOptions, type FPSMeterTheme } from 'lite-fps-meter';

const meter = new FPSMeter({
    position: 'bottom-right',
    theme: { good: '#00ff88' },
});
```

## License

MIT
