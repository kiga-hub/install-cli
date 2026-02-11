# CLI Visual Enhancement Design (2026-02-09)

## Overview
Enhance the installer-style CLI with a more modern, dynamic terminal experience and richer example steps. The output should feel “cyber/neon,” with animated progress, shimmering accents, and distinct result lines per step. The single-line progress bar remains the primary UI, but it gains motion and visual depth when running in an interactive TTY. Non-TTY output falls back to plain, readable logs without animation.

## Goals
- Modern neon aesthetic with Unicode bar characters, shimmer/glow, and spinner frames
- Richer default step examples (8–10 steps) with meaningful “result” lines
- Clear, layered log output with success/warn/error emphasis
- Maintain ASCII fallback and no-color compatibility
- Keep single-line progress as the main UI surface

## Non-Goals
- Full multi-pane TUI
- Parallel execution or complex orchestration
- Extensive theming CLI surface beyond config-driven defaults

## Architecture
We extend config and rendering while keeping the runner largely unchanged. The config schema gains a `ui` block (brand label, spinner frames, bar characters, separators, animation settings, Unicode toggle). Steps support optional `result` text and richer `logs` entries, which can be strings or `{ level, message }` objects. The runner keeps its sequential execution and emits a `step:result` event after success when a `result` exists. The renderer subscribes to events and manages an internal animation loop (tick ~80–120ms) to keep motion in the progress line even when progress percent is static. TTY output uses Unicode by default; non-TTY and `--no-color` disable animation and switch to ASCII-friendly rendering.

## Data Flow
1. Config is parsed and validated (zod), normalizing `logs` to `{ level: "info" }` objects and applying `ui` defaults.
2. Runner executes steps sequentially and emits lifecycle events (`step:start`, `step:progress`, `step:log`, `step:success`, `step:result`, `step:error`).
3. Renderer listens to events, calculates overall percent, and renders the single-line bar.
4. Animation loop drives spinner + shimmer band; updates are throttled for stability.
5. Logs and result lines are printed above the progress line with distinct color accents.

## UI & Rendering Details
- **Progress bar:** Unicode blocks (e.g., `█░`) with a moving “glow” band across the bar.
- **Brand label:** Gradient “OpenInstall” label with a rotating spinner glyph.
- **Separators:** Use `•` in Unicode mode; fallback to `|` in ASCII.
- **Result lines:** On step success, print a highlighted line (e.g., `✔ Cached 118MB`) using success color.
- **Non-TTY fallback:** Disable animation; emit static progress snapshots and plain logs.

## Example Config Extensions

```json
{
  "ui": {
    "unicode": true,
    "brandLabel": "OpenInstall",
    "spinnerFrames": ["⟡", "⟢", "⟣", "⟤"],
    "barChars": { "full": "█", "empty": "░", "glow": "▓" },
    "separators": { "unicode": " • ", "ascii": " | " },
    "animation": { "tickMs": 90, "glowWidth": 4 }
  },
  "steps": [
    { "id": "prepare", "title": "Preparing", "weight": 1, "durationMs": 900, "result": "Env ready", "logs": ["Checking environment"] },
    { "id": "fetch", "title": "Fetching packages", "weight": 2, "durationMs": 1300, "result": "Fetched 32 packages" },
    { "id": "cache", "title": "Caching", "weight": 2, "durationMs": 900, "result": "Cached 118MB" },
    { "id": "deps", "title": "Installing dependencies", "weight": 3, "durationMs": 2200, "result": "Installed 214 modules" },
    { "id": "audit", "title": "Verifying integrity", "weight": 1, "durationMs": 700, "result": "Integrity OK" },
    { "id": "build", "title": "Building project", "weight": 3, "command": "npm run build", "result": "Built 12 bundles" },
    { "id": "opt", "title": "Optimizing", "weight": 1, "durationMs": 900, "result": "Optimized output" },
    { "id": "final", "title": "Finalizing", "weight": 1, "durationMs": 800, "result": "Ready to launch" }
  ]
}
```

## Error Handling
- Config validation errors show clear, user-facing messages.
- Command failure stops animation and prints a red error line with exit code or signal.
- Optional `--continue-on-error` preserves progress and logs for remaining steps.

## Testing
- Config tests: validate `ui` defaults, log normalization, and step `result` parsing.
- Renderer tests: Unicode vs ASCII output, shimmer glyph usage, non-TTY disabling animation, and result-line formatting.
- Runner tests: ensure `step:result` emits after success and not on failure.
