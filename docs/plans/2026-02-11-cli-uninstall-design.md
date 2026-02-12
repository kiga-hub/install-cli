# CLI Uninstall Command Design (2026-02-11)

## Overview
Add an `uninstall` subcommand to the installer CLI that reuses the existing install pipeline and executes the configured steps in reverse order. The uninstall command shares the same rendering, prompt, and error-handling flow as `install` to keep behavior consistent and avoid schema changes. The reversed plan is computed in memory so the existing config schema remains unchanged.

## Goals
- Provide a first-class `uninstall` command alongside `install`.
- Reuse existing runner, renderer, and step controller logic.
- Reverse the configured steps at runtime without adding new schema fields.
- Support existing options: config path, dry-run, verbose, no-color, continue-on-error, auto, speed.

## Non-Goals
- No new config fields such as `uninstallSteps`.
- No uninstall-specific output strings or status labels.
- No custom theme or UI differences for uninstall.
- No new execution modes beyond reversing order.

## CLI UX
Command: `installer uninstall`

Options (same as `install`):
- `--config <path>`: config file path
- `--dry-run`: validate config and print plan only
- `--verbose`: print extra logs
- `--no-color`: disable ANSI colors
- `--continue-on-error`: keep running steps after failure
- `--auto`: run without step prompts
- `--speed <factor>`: multiply simulated durations

## Behavior
- Resolve config the same way as `install`.
- Load and parse config via the existing schema.
- Reverse the steps array in memory before running.
- For `--dry-run`, print the reversed plan and exit without execution.
- For execution, reuse renderer and controller with the reversed steps config.

## Data Flow
1. `src/index.ts` adds `uninstall` command with the same options.
2. Resolve config path using `resolveConfigPath` and load with `loadConfigFromFile`.
3. Build `uninstallConfig = { ...config, steps: [...config.steps].reverse() }`.
4. If `--dry-run`, call `printPlan(uninstallConfig)` and exit.
5. Otherwise, create renderer and step controller using `uninstallConfig` and run.

## Error Handling
- Follow the same error semantics as `install`.
- If a step fails and `continueOnError` is false, emit `run:error` and stop.
- If `continueOnError` is true, proceed through the remaining reversed steps.

## Testing
- Add CLI tests to verify `uninstall` exists and accepts the same options.
- Verify `--dry-run` prints steps in reversed order.
- Add an execution-order test to confirm reversed sequencing during run.

## Future Work
- Optional uninstall-specific labels or icons.
- Optional `uninstallSteps` config field if customization is needed.
