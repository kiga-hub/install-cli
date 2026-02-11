# CLI Installer Design (2026-02-09)

## Overview
Build a Node.js + TypeScript CLI that mimics modern installers (e.g., opencode-style) with a single-line dynamic progress bar, colorful emphasis, and clean, structured logs. Steps are JSON-config driven with validation. The CLI runs steps sequentially, showing progress in a compact, beautiful terminal UI.

## Goals
- Single-line dynamic progress bar with readable colors and branding
- JSON-configured steps (id, title, weight, duration/command)
- Sequential execution with logs rendered above the progress line
- Clear error reporting; optional continue-on-error
- Non-TTY and no-color fallbacks

## Non-Goals
- Full TUI framework (no multi-pane UI)
- Plugin system or marketplace
- Parallel task execution

## Architecture
Core modules:
- `src/index.ts`: CLI entry, options parsing, config resolution
- `src/config.ts`: load/merge/validate JSON config (zod)
- `src/runner.ts`: step execution, event emission
- `src/renderer.ts`: single-line bar rendering + log formatting
- `src/types.ts`: shared types
- `src/utils/time.ts`: formatting elapsed/ETA
- `src/utils/tty.ts`: TTY + color detection

Data flow:
1. CLI resolves config path: `--config`, `installer.config.json`, or `config/steps.json`.
2. Config is parsed and validated; defaults are merged.
3. Runner executes steps sequentially and emits lifecycle events.
4. Renderer updates the single-line progress bar via `log-update`.
5. Logs are printed above the progress bar with consistent icons and colors.

## Config Schema (JSON)

```
{
  "theme": {
    "brand": ["#00C2FF", "#00E6A8"],
    "accent": "#F6C177",
    "success": "#2ED573",
    "warn": "#FFA502",
    "error": "#FF4757",
    "barComplete": "#00E6A8",
    "barIncomplete": "#2F3542",
    "spinner": "dots"
  },
  "steps": [
    {
      "id": "prepare",
      "title": "Preparing",
      "weight": 1,
      "durationMs": 900,
      "logs": ["Checking environment", "Warming cache"]
    },
    {
      "id": "deps",
      "title": "Installing dependencies",
      "weight": 4,
      "durationMs": 2200
    },
    {
      "id": "build",
      "title": "Building project",
      "weight": 3,
      "command": "npm run build"
    }
  ]
}
```

## CLI UX
Command: `installer install` (default)

Options:
- `--config <path>`: config file path
- `--dry-run`: validate config and print plan only
- `--verbose`: print extra logs
- `--no-color`: disable ANSI colors
- `--continue-on-error`: keep running steps after failure
- `--speed <factor>`: multiply simulated durations

Progress line format (example):
`[█████░░░░░] 45% • Step 2/6 • Resolving deps 00:12`

Logs print above the line with icons:
- `✓` success, `ℹ` info, `⚠` warn, `✗` error

Non-TTY: no dynamic progress updates; prints summary only.

## Error Handling
- Command failure: stop bar, print error block (exit code + last N lines)
- Optional `--continue-on-error` to proceed
- Schema errors show JSON path and message

## Testing
Unit tests:
- Config validation/default merge
- Progress calculation & time formatting

Integration tests:
- Non-TTY run: ensures plain output and final summary

## Dependencies
Suggested packages:
- `commander`, `chalk`, `log-update`, `cli-progress`, `gradient-string`, `ora`, `zod`
