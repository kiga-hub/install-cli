# CLI Step Progress Design (2026-02-09)

## Overview
Switch the progress bar from global/overall progress to a per-step progress model. Each step owns an independent progress bar that resets to 0% on step start and reaches 100% on step completion. The UI keeps the modern neon look, shows `Step n/N`, and preserves the two-line hero frame (progress line + status line). Other logic remains unchanged.

## Goals
- Progress bar reflects **current step only** (not total/weighted progress)
- `Step n/N` and step title remain visible
- Step timer reflects **current step duration**
- Two-line hero frame remains (line 1: progress, line 2: status/log)
- Result lines still shown on step completion
- Unicode/ASCII behavior unchanged (controlled by `ui.unicode`)

## Layout
Line 1 (hero):
```
⟡ OpenInstall [██▓░░░░░░░░░░░░] 42% • Step 3/8 • Installing deps 00:07
```
Line 2 (status):
```
STATUS | Installing deps — Fetching registry metadata
```

Result line (printed above the frame):
```
✓ RESULT | Built 12 bundles
```

## Data Flow
- `step:start`: reset `stepPercent = 0`, set `stepStartTime = now`, update status line to `Starting...`.
- `step:progress`: update `stepPercent = event.percent`; bar and label use this value.
- `step:log`: update status line to latest log while keeping step title.
- `step:result`: print `RESULT | <message>` and temporarily show it in the status line.
- `step:success`: print `✓ <step> completed` as before.
- `step:error`: stop animation, print error line, set status to `ERROR | <step> failed`.

## Error Handling
- Errors remain per-step; `--continue-on-error` continues to next step.
- Progress resets on each `step:start`, regardless of prior errors.

## Testing
- Renderer tests assert per-step percent rendering and step timer reset.
- Renderer tests verify `stepPercent` does not carry between steps.
- Status line tests confirm log and result messages update line 2 correctly.
- Unicode/ASCII rendering tests remain intact.
