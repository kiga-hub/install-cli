# Installer CLI

Installer-style CLI with a single-line progress bar, colorful emphasis, and structured logs.

## Quick Start

```bash
npm install
npm run dev -- install --config config/steps.json
```

## Build

```bash
npm run build
node dist/index.js install --config config/steps.json
```

## Config

Use `config/steps.json` by default or pass `--config <path>`.
The default config ships with 8 steps to showcase the progress flow.
Output includes Unicode symbols in the progress and status lines. Use `--no-color` for a plain, no-ANSI fallback, or set `ui.unicode` to false in config for ASCII-only output.

```json
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
    }
  ]
}
```

## Options

- `--config <path>`: config file path
- `--dry-run`: validate config and print plan
- `--verbose`: print extra logs
- `--no-color`: disable ANSI colors
- `--continue-on-error`: keep running after failures
- `--speed <factor>`: speed up or slow down simulated steps
