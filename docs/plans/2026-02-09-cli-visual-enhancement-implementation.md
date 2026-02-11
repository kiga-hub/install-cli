# CLI Visual Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the CLI output to a modern neon style with animated Unicode progress, richer example steps, and result lines per step.

**Architecture:** Extend config schema with a `ui` block and richer step fields, add a `step:result` event, and enhance the renderer with animation loop, shimmer, and Unicode/ASCII fallback.

**Tech Stack:** Node.js, TypeScript, zod, chalk, gradient-string, log-update, vitest

---

### Task 1: Expand config schema and defaults

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Modify: `config/steps.json`
- Modify: `tests/config.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config.js";

describe("config ui", () => {
  it("applies ui defaults", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    expect(config.ui.unicode).toBe(true);
    expect(Array.isArray(config.ui.spinnerFrames)).toBe(true);
  });

  it("normalizes string logs to objects", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", logs: ["Hello"] }]
    });
    expect(config.steps[0].logs?.[0]).toEqual({ level: "info", message: "Hello" });
  });

  it("accepts result strings", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", result: "Done" }]
    });
    expect(config.steps[0].result).toBe("Done");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (missing `ui` defaults / log normalization)

**Step 3: Update `src/types.ts`**

```ts
export type UiConfig = {
  unicode: boolean;
  brandLabel: string;
  spinnerFrames: string[];
  barChars: { full: string; empty: string; glow: string };
  separators: { unicode: string; ascii: string };
  animation: { tickMs: number; glowWidth: number };
};

export type StepLog = { level: "info" | "warn" | "error" | "success"; message: string };

export type StepConfig = {
  id: string;
  title: string;
  weight: number;
  durationMs?: number;
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
  logs?: StepLog[];
  result?: string;
};

export type InstallerConfig = {
  theme: ThemeConfig;
  ui: UiConfig;
  steps: StepConfig[];
};
```

**Step 4: Update `src/config.ts`**

```ts
const UiSchema = z.object({
  unicode: z.boolean().default(true),
  brandLabel: z.string().default("OpenInstall"),
  spinnerFrames: z.array(z.string()).default(["⟡", "⟢", "⟣", "⟤"]),
  barChars: z
    .object({ full: z.string().default("█"), empty: z.string().default("░"), glow: z.string().default("▓") })
    .default({ full: "█", empty: "░", glow: "▓" }),
  separators: z
    .object({ unicode: z.string().default(" • "), ascii: z.string().default(" | ") })
    .default({ unicode: " • ", ascii: " | " }),
  animation: z
    .object({ tickMs: z.number().int().positive().default(90), glowWidth: z.number().int().positive().default(4) })
    .default({ tickMs: 90, glowWidth: 4 })
});

const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  weight: z.number().positive().default(1),
  durationMs: z.number().int().positive().optional(),
  command: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string()).optional(),
  logs: z
    .array(
      z.union([
        z.string().transform((message) => ({ level: "info", message })),
        z.object({
          level: z.enum(["info", "warn", "error", "success"]),
          message: z.string()
        })
      ])
    )
    .optional(),
  result: z.string().optional()
});

const ConfigSchema = z.object({
  theme: ThemeSchema,
  ui: UiSchema,
  steps: z.array(StepSchema).min(1)
});
```

**Step 5: Update `config/steps.json` (8–10 steps)**

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
  "ui": {
    "unicode": true,
    "brandLabel": "OpenInstall",
    "spinnerFrames": ["⟡", "⟢", "⟣", "⟤"],
    "barChars": { "full": "█", "empty": "░", "glow": "▓" },
    "separators": { "unicode": " • ", "ascii": " | " },
    "animation": { "tickMs": 90, "glowWidth": 4 }
  },
  "steps": [
    { "id": "prepare", "title": "Preparing", "weight": 1, "durationMs": 800, "result": "Env ready", "logs": ["Checking environment"] },
    { "id": "fetch", "title": "Fetching packages", "weight": 2, "durationMs": 1200, "result": "Fetched 32 packages" },
    { "id": "cache", "title": "Caching", "weight": 2, "durationMs": 900, "result": "Cached 118MB" },
    { "id": "deps", "title": "Installing dependencies", "weight": 3, "durationMs": 2200, "result": "Installed 214 modules" },
    { "id": "audit", "title": "Verifying integrity", "weight": 1, "durationMs": 700, "result": "Integrity OK" },
    { "id": "build", "title": "Building project", "weight": 3, "command": "npm run build", "result": "Built 12 bundles" },
    { "id": "opt", "title": "Optimizing", "weight": 1, "durationMs": 900, "result": "Optimized output" },
    { "id": "final", "title": "Finalizing", "weight": 1, "durationMs": 800, "result": "Ready to launch" }
  ]
}
```

**Step 6: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
```

---

### Task 2: Add step result event in runner

**Files:**
- Modify: `src/runner.ts`
- Modify: `tests/runner.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { runSteps } from "../src/runner.js";

describe("runner results", () => {
  it("emits step:result on success", async () => {
    const emitter = new EventEmitter();
    const results: string[] = [];
    emitter.on("step:result", (event) => results.push(event.result));

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      ui: {
        unicode: true,
        brandLabel: "OpenInstall",
        spinnerFrames: ["⟡"],
        barChars: { full: "█", empty: "░", glow: "▓" },
        separators: { unicode: " • ", ascii: " | " },
        animation: { tickMs: 90, glowWidth: 4 }
      },
      steps: [{ id: "one", title: "Step One", weight: 1, durationMs: 10, result: "OK" }]
    };

    await runSteps(config, { speed: 1, continueOnError: false, verbose: false }, emitter);
    expect(results).toEqual(["OK"]);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (missing `step:result`)

**Step 3: Update `src/runner.ts`**

```ts
      if (step.result) {
        emitter.emit("step:result", {
          step,
          index,
          total: config.steps.length,
          result: step.result
        });
      }
```

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
```

---

### Task 3: Renderer animation + Unicode mode

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderProgressLine } from "../src/renderer.js";
import { parseConfig } from "../src/config.js";

describe("renderer unicode", () => {
  it("uses unicode bar characters when enabled", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const line = renderProgressLine(
      { percent: 50, stepTitle: "X", stepIndex: 0, totalSteps: 1, elapsedMs: 0 },
      config.theme,
      { noColor: true, brandLabel: "OpenInstall", ui: config.ui }
    );
    expect(line).toContain("█");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (renderProgressLine does not accept ui)

**Step 3: Update `src/renderer.ts`**

- Accept `ui` in `renderProgressLine` options.
- Use `ui.separators` and `ui.barChars` based on unicode/ascii mode.
- Add shimmer band overlay in render (simple glow index).
- Add animation loop in `createRenderer` that updates spinner/glow offset every `ui.animation.tickMs` when TTY.
- Emit result lines on `step:result` with success color and icon.

**Step 4: Update tests**

- Add tests for ASCII fallback in no-color mode.
- Add test for `step:result` rendering output (mock update + console).

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
```

---

### Task 4: Update README usage hints

**Files:**
- Modify: `README.md`

**Step 1: Update README**

- Note that the default config now includes 8–10 steps.
- Mention Unicode output and `--no-color` fallback.

**Step 2: Commit**

```bash
```
