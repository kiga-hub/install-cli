# CLI Hero Frame Design (2026-02-09)

## Overview
Upgrade the CLI output to a two-line “hero frame” that feels modern and dynamic. Line 1 remains the primary progress bar, now with neon spinner prefix and shimmer glow. Line 2 becomes a live status line that shows “current step + latest log” and temporarily highlights step results. This keeps the output energetic and narrative while staying readable. Non-TTY or `--no-color` falls back to a static two-line layout without animation.

## Goals
- Two-line UI: hero progress line + live status line
- Neon spinner prefix with gradient brand label
- Shimmer/glow band confined to completed segment
- Richer result formatting with a `RESULT |` badge
- Keep Unicode mode and ASCII fallback consistent

## Non-Goals
- Multi-pane full TUI
- Parallel execution visualization
- Complex theming CLI flags

## Layout
Line 1 (hero):
```
⟡ OpenInstall [████▓░░░░░░░░░░░] 46% • Step 4/8 • Installing deps 00:13
```
Line 2 (status):
```
STATUS | Installing deps — Fetching registry metadata
```

Result line (printed above the frame on step completion):
```
✓ RESULT | Built 12 bundles
```

## Data Flow
- Runner emits `step:log` and `step:result`
- Renderer updates `lastLog` and shows a live status line
- When a result arrives, status line shows `RESULT | <message>` for a short duration or until the next log
- `step:success` prints a bold result line above the frame

## Error Handling
- `step:error` prints a red error line and updates status to `ERROR | <step> failed`.
- `--continue-on-error` keeps animation running but logs errors distinctly.

## Testing
- Ensure two-line output contains a newline and correct separators
- Unicode vs ASCII separators and bar chars
- `step:log` updates status line
- `step:result` renders `RESULT |` badge and temporarily overrides status
- Shimmer/glow confined to completed segment
