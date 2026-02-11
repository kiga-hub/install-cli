# CLI Choice UI Polish Design (2026-02-09)

## Overview
Polish the step-choice UI with a neon blue border, frosted glass panel (simulated), and hover glow. Keep the existing flow and logic intact; only enhance the visual layer in `choicePrompt`.

## Goals
- Neon blue bordered buttons with simulated gradient
- Frosted glass panel using layered boxes and dot pattern
- Hover/focus glow around buttons

## Non-Goals
- Full-screen TUI rewrite
- Changes to controller/runner logic

## Visual Structure
1) Base panel: dim background and soft border (glass base)
2) Texture layer: dotted pattern with low contrast
3) Content panel: title + buttons
4) Buttons: dual-layer border for neon gradient feel
5) Glow: an outer border box shown on hover/focus

## Interaction
- Mouse + keyboard stay enabled
- Hover and focus both trigger glow and brightness increase

## Testing
- Keep existing `resolveWith` tests
- Add light structure checks (panel/texture existence)
