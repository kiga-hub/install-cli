# CLI Inline Prompt Design (2026-02-09)

## Overview
Replace the full-screen blessed prompt with a bottom-inline prompt that only redraws the last few terminal lines. The UI remains neon + frosted, with bordered buttons and hover glow, but does not refresh the entire terminal.

## Goals
- Bottom-only rendering (no full-screen refresh)
- Mouse clickable buttons with highlight
- Neon/frosted style preserved
- Pulse/flicker effects only redraw button regions

## Architecture
- Swap prompt implementation to terminal-kit.
- Keep controller and renderer logic intact.
- Prompt uses cursor positioning to draw only bottom rows.

## Interaction
- Mouse click selects button
- Keyboard navigation (tab/left/right, enter)
- Auto skips prompts after selection

## Rendering
- Bottom panel height ~6–7 rows
- Draw panel background, dot texture
- Render buttons as bordered boxes
- Hover updates only affected button region

## Testing
- `resolveWith` still works
- `open()` resolves when mock click is injected
- Tests mock terminal-kit drawing calls
