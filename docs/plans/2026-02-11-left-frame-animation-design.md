# Left-Side Dot Frame Animation Design

## Goal
Add a subtle, looping dotted rectangle animation on the left side of the terminal during installer runs, similar to the openclaw install effect. The animation must not overlap the inline prompt or corrupt log output.

## Behavior
- Render a vertical rectangular frame of dots at the left margin.
- A single "lit" dot moves around the frame perimeter in a continuous loop (top -> right -> bottom -> left -> repeat).
- Dots are dim by default; the lit dot uses a brighter accent color.
- Frame height scales with terminal size, clamped to a small range (e.g., 6 to 12 rows). Width stays narrow (3 to 4 columns).
- Animation runs only in TTY mode and stops cleanly on completion.
- On resize, recompute dimensions and continue the loop with a valid index.

## Rendering Strategy
- Integrate the frame into the existing renderer (`src/renderer.ts`) so it is emitted via the same `log-update` call.
- Each render tick builds a block of `frameHeight` lines:
  - Line 1: `<frameLine[0]> <progressLine>`
  - Line 2 (if status line exists): `<frameLine[1]> <statusLine>`
  - Remaining lines: `<frameLine[i]>` only
- This keeps the frame stable and avoids cursor fights. The inline prompt already pauses the renderer, so it will not conflict.
- Cleanup renders once without the frame (or with blank frame lines) to leave the terminal clean.

## Data Flow
- On renderer init: compute frame dimensions and perimeter list.
- On each animation tick: advance `highlightIndex` and call `render()`.
- On resize: recompute dimensions and clamp `highlightIndex` to the new perimeter length.
- On completion: stop animation and clear frame block.

## Testing
- Add renderer tests to validate:
  - Frame height clamps to min/max and scales with terminal rows.
  - Render output prefixes frame lines and uses only frame height lines.
  - Non-TTY mode skips frame output.

## Non-Goals
- No full-screen buffers or alternate screen usage.
- No impact on step prompt interaction or log output formatting beyond the left margin.
