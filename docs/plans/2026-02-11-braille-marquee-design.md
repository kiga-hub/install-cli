# Braille Marquee Indicator Design

## Goal
Replace the current multi-dot marquee with a single braille character that represents a 2x4 dot matrix (2 columns, 4 rows) on a single terminal line. The indicator should animate clockwise and stay compact.

## Behavior
- In Unicode mode, render a single braille character (U+2800 block) that lights one dot at a time, moving clockwise around the 2x4 perimeter.
- In ASCII mode, fall back to a two-character marquee (e.g., "o." / ".o") to simulate movement without braille.
- The indicator appears inline before the progress line and should not add extra rows.
- The highlight dot uses the theme accent color; the base indicator uses a dim gray tone (respecting `noColor`).
- Animation speed uses `ui.animation.frameTickMs` with fallback to `tickMs`.

## Braille Mapping
Braille dot positions (Unicode standard):

```
1 4
2 5
3 6
7 8
```

We will animate a single lit dot on the perimeter in this order:
`1 -> 4 -> 5 -> 6 -> 8 -> 7 -> 3 -> 2 -> repeat`.

Implementation detail:
- `BRAILLE_BASE = 0x2800`
- `char = String.fromCodePoint(BRAILLE_BASE + mask)`
- Masks use the standard bit flags: 1,2,4,8,16,32,64,128.

## Rendering Approach
- Replace the current `MARQUEE_WIDTH` dots with a single braille cell in Unicode mode.
- Prefix the progress line with `${marquee} `.
- Prefix the status line with padding equal to the marquee display width + 1.
- Keep the output height at 1 line (or 2 when status is shown).

## Fallback (ASCII)
- When `ui.unicode` is false, render a two-character marquee (`"o."`, `".o"`) cycling left-to-right.
- Set marquee display width dynamically (`1` for Unicode braille, `2` for ASCII).

## Testing
- Update renderer tests to assert one-line marquee prefix for Unicode braille.
- Add tests for ASCII fallback width and prefix.
- Ensure output remains <= 2 lines in TTY mode.

## Non-Goals
- No multi-row frames.
- No full-screen buffers.
- No changes to progress bar layout besides the new prefix.
