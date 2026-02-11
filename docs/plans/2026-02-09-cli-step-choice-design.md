# CLI Step Choice Design (2026-02-09)

## Overview
Add an interactive choice prompt after each step completes: **Next**, **Auto**, **Back**. The prompt is clickable with the mouse, shows bordered buttons with highlight states, and simulates a frosted-glass panel. The existing logic and rendering remain intact; this feature is layered on top via a controller that runs one step at a time.

## Goals
- Mouse-clickable options after each step
- Three choices: Next step, Auto-run all remaining, Back to previous step (re-run)
- Visual style: bordered buttons, highlight on selection, frosted-glass effect (simulated)
- Preserve current renderer behavior and logs

## Non-Goals
- Full-screen TUI replacement
- Persistent multi-pane layout
- Parallel step execution

## Architecture
- Introduce a `StepController` that executes **one step at a time**.
- Add a prompt layer using **blessed** for mouse + bordered buttons.
- Keep the renderer for progress + status lines; pause it while the prompt is visible.

## Interaction Flow
1. Run step `i`.
2. On success (or error with `--continue-on-error`), show the choice prompt.
3. User picks:
   - **Next**: run step `i+1`.
   - **Auto**: set `autoMode = true`, run all remaining steps without prompts.
   - **Back**: run step `i-1` (clamped at 0).

## Error Handling
- If a step fails and `continueOnError` is false: stop and exit (no prompt).
- If `continueOnError` is true: prompt still appears so the user can decide.

## UI Details
- Use `blessed` box with `border: 'line'`.
- Buttons are clickable and keyboard-focusable.
- Selected button uses bright border and accent glow (simulated via colors).
- “Frosted glass” effect simulated with dim background and soft border color.

## Testing
- Controller logic tests with mocked prompt (no blessed in tests).
- Auto-mode skips prompts.
- Back re-runs previous step.
- Pause/resume renderer behavior verified.
