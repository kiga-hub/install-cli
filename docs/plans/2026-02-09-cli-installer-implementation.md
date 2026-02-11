# CLI Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a JSON-configured installer-style CLI with a single-line colored progress bar and structured logs.

**Architecture:** A Node.js + TypeScript CLI reads a validated JSON config, runs steps sequentially, emits events, and renders a dynamic progress line with color and logs. Non-TTY falls back to plain output.

**Tech Stack:** Node.js, TypeScript, commander, chalk, gradient-string, log-update, ora, zod, vitest

---

### Task 1: Scaffold the toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Create `package.json`**

```json
{
  "name": "installer-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "installer": "dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "gradient-string": "^2.0.2",
    "log-update": "^5.0.1",
    "ora": "^7.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "tsx": "^4.7.0",
    "typescript": "^5.4.2",
    "vitest": "^1.3.1"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "preserveShebang": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

**Step 4: Create `.gitignore`**

```
node_modules
dist
coverage
.DS_Store
.env
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: installs all dependencies successfully

**Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold cli toolchain"
```

---

### Task 2: Config schema, types, and sample config

**Files:**
- Create: `src/types.ts`
- Create: `src/config.ts`
- Create: `config/steps.json`
- Create: `tests/config.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseConfig, defaultTheme } from "../src/config.js";

const baseConfig = {
  steps: [{ id: "prepare", title: "Preparing", durationMs: 500 }]
};

describe("config", () => {
  it("fills theme defaults", () => {
    const config = parseConfig(baseConfig);
    expect(config.theme.accent).toBe(defaultTheme.accent);
  });

  it("defaults weight to 1", () => {
    const config = parseConfig(baseConfig);
    expect(config.steps[0].weight).toBe(1);
  });

  it("rejects missing title", () => {
    expect(() => parseConfig({ steps: [{ id: "x" }] })).toThrow(/title/i);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing `src/config.ts`

**Step 3: Create `src/types.ts`**

```ts
export type ThemeConfig = {
  brand: [string, string];
  accent: string;
  success: string;
  warn: string;
  error: string;
  barComplete: string;
  barIncomplete: string;
  spinner: string;
};

export type StepConfig = {
  id: string;
  title: string;
  weight: number;
  durationMs?: number;
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
  logs?: string[];
};

export type InstallerConfig = {
  theme: ThemeConfig;
  steps: StepConfig[];
};

export type RunnerOptions = {
  speed: number;
  continueOnError: boolean;
  verbose: boolean;
};

export type RendererOptions = {
  noColor: boolean;
  isTTY: boolean;
  verbose: boolean;
};
```

**Step 4: Create `src/config.ts`**

```ts
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { InstallerConfig, ThemeConfig } from "./types.js";

export const defaultTheme: ThemeConfig = {
  brand: ["#00C2FF", "#00E6A8"],
  accent: "#F6C177",
  success: "#2ED573",
  warn: "#FFA502",
  error: "#FF4757",
  barComplete: "#00E6A8",
  barIncomplete: "#2F3542",
  spinner: "dots"
};

const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  weight: z.number().positive().default(1),
  durationMs: z.number().int().positive().optional(),
  command: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string()).optional(),
  logs: z.array(z.string()).optional()
});

const ThemeSchema = z
  .object({
    brand: z.array(z.string()).length(2).default(defaultTheme.brand),
    accent: z.string().default(defaultTheme.accent),
    success: z.string().default(defaultTheme.success),
    warn: z.string().default(defaultTheme.warn),
    error: z.string().default(defaultTheme.error),
    barComplete: z.string().default(defaultTheme.barComplete),
    barIncomplete: z.string().default(defaultTheme.barIncomplete),
    spinner: z.string().default(defaultTheme.spinner)
  })
  .default(defaultTheme);

const ConfigSchema = z.object({
  theme: ThemeSchema,
  steps: z.array(StepSchema).min(1)
});

export type ParsedConfig = z.infer<typeof ConfigSchema>;

export function parseConfig(input: unknown): InstallerConfig {
  return ConfigSchema.parse(input);
}

export async function loadConfigFromFile(filePath: string): Promise<InstallerConfig> {
  const raw = await readFile(filePath, "utf8");
  return parseConfig(JSON.parse(raw));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConfigPath(cliPath?: string): Promise<string> {
  if (cliPath) {
    return path.resolve(cliPath);
  }

  const candidates = [
    path.resolve("installer.config.json"),
    path.resolve("config/steps.json")
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error("No config file found. Use --config <path>.");
}
```

**Step 5: Create `config/steps.json`**

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

**Step 6: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/types.ts src/config.ts config/steps.json tests/config.test.ts
git commit -m "feat: add config schema and defaults"
```

---

### Task 3: Time and progress utilities

**Files:**
- Create: `src/utils/time.ts`
- Create: `src/utils/progress.ts`
- Create: `tests/utils.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { formatDuration } from "../src/utils/time.js";
import { computeOverallPercent } from "../src/utils/progress.js";

describe("utils", () => {
  it("formats mm:ss", () => {
    expect(formatDuration(61000)).toBe("01:01");
  });

  it("computes weighted percent", () => {
    expect(computeOverallPercent(10, 3, 2, 50)).toBe(40);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing utils

**Step 3: Create `src/utils/time.ts`**

```ts
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
```

**Step 4: Create `src/utils/progress.ts`**

```ts
export function computeOverallPercent(
  totalWeight: number,
  completedWeight: number,
  currentWeight: number,
  stepPercent: number
): number {
  if (totalWeight <= 0) {
    return 0;
  }

  const clamped = Math.min(100, Math.max(0, stepPercent));
  const progressWeight = (currentWeight * clamped) / 100;
  const overall = ((completedWeight + progressWeight) / totalWeight) * 100;
  return Math.min(100, Math.max(0, Math.round(overall)));
}
```

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/utils/time.ts src/utils/progress.ts tests/utils.test.ts
git commit -m "feat: add time and progress helpers"
```

---

### Task 4: Step runner with events

**Files:**
- Create: `src/runner.ts`
- Create: `tests/runner.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { runSteps } from "../src/runner.js";

describe("runner", () => {
  it("emits progress and success for simulated step", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const emitter = new EventEmitter();
    const percents: number[] = [];

    emitter.on("step:progress", (event) => {
      percents.push(event.percent);
    });

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
      steps: [{ id: "one", title: "Step One", weight: 1, durationMs: 400 }]
    };

    const runPromise = runSteps(config, { speed: 1, continueOnError: false, verbose: false }, emitter);
    await vi.runAllTimersAsync();
    await runPromise;

    expect(percents.length).toBeGreaterThan(0);
    expect(percents[percents.length - 1]).toBe(100);

    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing `src/runner.ts`

**Step 3: Create `src/runner.ts`**

```ts
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import readline from "node:readline";
import type { InstallerConfig, RunnerOptions, StepConfig } from "./types.js";

type StepEvent = {
  step: StepConfig;
  index: number;
  total: number;
  percent: number;
  completedWeight: number;
  totalWeight: number;
};

export async function runSteps(
  config: InstallerConfig,
  options: RunnerOptions,
  emitter: EventEmitter
): Promise<void> {
  const totalWeight = config.steps.reduce((sum, step) => sum + step.weight, 0);
  let completedWeight = 0;

  emitter.emit("run:start", { total: config.steps.length });

  for (let index = 0; index < config.steps.length; index += 1) {
    const step = config.steps[index];
    emitter.emit("step:start", { step, index, total: config.steps.length, completedWeight, totalWeight });

    try {
      if (step.command) {
        await runCommandStep(step, options, emitter, { index, totalWeight, completedWeight, total: config.steps.length });
      } else {
        await runSimulatedStep(step, options, emitter, { index, totalWeight, completedWeight, total: config.steps.length });
      }

      completedWeight += step.weight;
      emitter.emit("step:success", { step, index, total: config.steps.length, completedWeight, totalWeight });
    } catch (error) {
      emitter.emit("step:error", { step, index, total: config.steps.length, error, completedWeight, totalWeight });

      if (!options.continueOnError) {
        emitter.emit("run:error", { error });
        throw error;
      }
    }
  }

  emitter.emit("run:complete", { total: config.steps.length });
}

async function runSimulatedStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  const duration = Math.max(200, (step.durationMs ?? 800) / Math.max(0.1, options.speed));
  const tickMs = 80;
  const start = Date.now();

  if (step.logs?.length) {
    const spacing = duration / (step.logs.length + 1);
    step.logs.forEach((message, idx) => {
      setTimeout(() => {
        emitter.emit("step:log", { level: "info", message, step, index: context.index });
      }, spacing * (idx + 1));
    });
  }

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.min(100, Math.round((elapsed / duration) * 100));

      const event: StepEvent = {
        step,
        index: context.index,
        total: context.total,
        percent,
        completedWeight: context.completedWeight,
        totalWeight: context.totalWeight
      };

      emitter.emit("step:progress", event);

      if (percent >= 100) {
        clearInterval(interval);
        resolve();
      }
    }, tickMs);
  });
}

async function runCommandStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command as string, {
      shell: true,
      cwd: step.cwd ?? process.cwd(),
      env: { ...process.env, ...step.env }
    });

    const stdout = readline.createInterface({ input: child.stdout });
    const stderr = readline.createInterface({ input: child.stderr });

    stdout.on("line", (line) => emitter.emit("step:log", { level: "info", message: line, step, index: context.index }));
    stderr.on("line", (line) => emitter.emit("step:log", { level: "error", message: line, step, index: context.index }));

    let percent = 0;
    const tick = setInterval(() => {
      percent = Math.min(90, percent + 3);

      const event: StepEvent = {
        step,
        index: context.index,
        total: context.total,
        percent,
        completedWeight: context.completedWeight,
        totalWeight: context.totalWeight
      };

      emitter.emit("step:progress", event);
    }, 200);

    child.on("close", (code) => {
      clearInterval(tick);

      const event: StepEvent = {
        step,
        index: context.index,
        total: context.total,
        percent: 100,
        completedWeight: context.completedWeight,
        totalWeight: context.totalWeight
      };

      emitter.emit("step:progress", event);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${step.command} (exit ${code})`));
      }
    });
  });
}
```

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runner.ts tests/runner.test.ts
git commit -m "feat: add sequential step runner"
```

---

### Task 5: Renderer and progress line

**Files:**
- Create: `src/renderer.ts`
- Create: `tests/renderer.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderProgressLine } from "../src/renderer.js";
import { defaultTheme } from "../src/config.js";

describe("renderer", () => {
  it("renders percent and step info", () => {
    const line = renderProgressLine(
      {
        percent: 45,
        stepTitle: "Installing dependencies",
        stepIndex: 1,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall" }
    );

    expect(line).toContain("45%");
    expect(line).toContain("Step 2/3");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing `src/renderer.ts`

**Step 3: Create `src/renderer.ts`**

```ts
import chalk from "chalk";
import gradient from "gradient-string";
import logUpdate from "log-update";
import type { EventEmitter } from "node:events";
import type { InstallerConfig, RendererOptions } from "./types.js";
import { computeOverallPercent } from "./utils/progress.js";
import { formatDuration } from "./utils/time.js";

type RenderState = {
  percent: number;
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  completedWeight: number;
  totalWeight: number;
  startTime: number;
};

const BAR_WIDTH = 22;

export function renderProgressLine(
  state: {
    percent: number;
    stepTitle: string;
    stepIndex: number;
    totalSteps: number;
    elapsedMs: number;
  },
  theme: InstallerConfig["theme"],
  options: { noColor: boolean; brandLabel: string }
): string {
  const chalkInstance = new chalk.Instance({ level: options.noColor ? 0 : 3 });

  const completeLength = Math.round((Math.max(0, Math.min(100, state.percent)) / 100) * BAR_WIDTH);
  const complete = "█".repeat(completeLength);
  const incomplete = "░".repeat(BAR_WIDTH - completeLength);

  const bar = `[${chalkInstance.hex(theme.barComplete)(complete)}${chalkInstance.hex(theme.barIncomplete)(incomplete)}]`;
  const percentLabel = chalkInstance.hex(theme.accent)(`${state.percent}%`);
  const stepLabel = chalkInstance.hex(theme.accent)(`Step ${state.stepIndex + 1}/${state.totalSteps}`);
  const titleLabel = chalkInstance.white(state.stepTitle);
  const timer = chalkInstance.gray(formatDuration(state.elapsedMs));

  return `${options.brandLabel} ${bar} ${percentLabel} • ${stepLabel} • ${titleLabel} ${timer}`;
}

export function createRenderer(config: InstallerConfig, options: RendererOptions) {
  const chalkInstance = new chalk.Instance({ level: options.noColor ? 0 : 3 });
  const brandLabel = options.noColor
    ? "OpenInstall"
    : gradient(config.theme.brand).multiline("OpenInstall");

  const update = logUpdate.create(process.stdout, { showCursor: false });
  const state: RenderState = {
    percent: 0,
    stepTitle: "Starting",
    stepIndex: 0,
    totalSteps: config.steps.length,
    completedWeight: 0,
    totalWeight: config.steps.reduce((sum, step) => sum + step.weight, 0),
    startTime: Date.now()
  };

  function render() {
    if (!options.isTTY) {
      return;
    }

    const elapsedMs = Date.now() - state.startTime;
    const line = renderProgressLine(
      {
        percent: state.percent,
        stepTitle: state.stepTitle,
        stepIndex: state.stepIndex,
        totalSteps: state.totalSteps,
        elapsedMs
      },
      config.theme,
      { noColor: options.noColor, brandLabel }
    );

    update(line);
  }

  function printLog(level: "info" | "warn" | "error" | "success", message: string) {
    const icon =
      level === "success"
        ? chalkInstance.hex(config.theme.success)("✓")
        : level === "warn"
          ? chalkInstance.hex(config.theme.warn)("⚠")
          : level === "error"
            ? chalkInstance.hex(config.theme.error)("✗")
            : chalkInstance.hex(config.theme.accent)("ℹ");

    const line = `${icon} ${message}`;

    if (options.isTTY) {
      update.clear();
      console.log(line);
      render();
      return;
    }

    console.log(line);
  }

  function attach(emitter: EventEmitter) {
    emitter.on("step:start", (event) => {
      state.stepTitle = event.step.title;
      state.stepIndex = event.index;
      state.completedWeight = event.completedWeight;
      state.totalWeight = event.totalWeight;
      state.percent = computeOverallPercent(state.totalWeight, state.completedWeight, event.step.weight, 0);
      render();
    });

    emitter.on("step:progress", (event) => {
      state.stepTitle = event.step.title;
      state.stepIndex = event.index;
      state.completedWeight = event.completedWeight;
      state.totalWeight = event.totalWeight;
      state.percent = computeOverallPercent(state.totalWeight, state.completedWeight, event.step.weight, event.percent);
      render();
    });

    emitter.on("step:log", (event) => {
      if (options.verbose || event.level !== "info") {
        printLog(event.level, event.message);
      }
    });

    emitter.on("step:success", (event) => {
      printLog("success", `${event.step.title} completed`);
    });

    emitter.on("step:error", (event) => {
      printLog("error", `${event.step.title} failed`);
    });

    emitter.on("run:complete", () => {
      if (options.isTTY) {
        update.done();
      }
    });
  }

  return { attach };
}
```

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: add progress renderer"
```

---

### Task 6: CLI entry and TTY utilities

**Files:**
- Create: `src/utils/tty.ts`
- Create: `src/index.ts`
- Create: `tests/cli.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

describe("cli", () => {
  it("prints plan on dry run", () => {
    const entry = path.resolve("src/index.ts");
    const result = spawnSync(
      "node",
      ["--loader", "tsx", entry, "install", "--dry-run", "--config", "config/steps.json"],
      {
        env: { ...process.env, FORCE_COLOR: "0" },
        encoding: "utf8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run");
    expect(result.stdout).toContain("Preparing");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing `src/index.ts`

**Step 3: Create `src/utils/tty.ts`**

```ts
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}
```

**Step 4: Create `src/index.ts`**

```ts
#!/usr/bin/env node

import { Command } from "commander";
import { EventEmitter } from "node:events";
import { loadConfigFromFile, resolveConfigPath } from "./config.js";
import { createRenderer } from "./renderer.js";
import { runSteps } from "./runner.js";
import { isTTY } from "./utils/tty.js";

type CliOptions = {
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  continueOnError?: boolean;
  speed?: string;
};

const program = new Command();

program
  .name("installer")
  .description("Installer-style CLI with progress bar and logs")
  .version("0.1.0");

program
  .command("install", { isDefault: true })
  .option("--config <path>", "path to config file")
  .option("--dry-run", "validate config and print plan")
  .option("--verbose", "print extra logs")
  .option("--no-color", "disable ANSI colors")
  .option("--continue-on-error", "continue after step failure")
  .option("--speed <factor>", "speed factor for simulated steps", "1")
  .action(async (options: CliOptions) => {
    const configPath = await resolveConfigPath(options.config);
    const config = await loadConfigFromFile(configPath);

    if (options.dryRun) {
      printPlan(config);
      return;
    }

    const emitter = new EventEmitter();
    const renderer = createRenderer(config, {
      noColor: Boolean(options.noColor),
      isTTY: isTTY(),
      verbose: Boolean(options.verbose)
    });

    renderer.attach(emitter);

    await runSteps(
      config,
      {
        speed: Number(options.speed ?? 1),
        continueOnError: Boolean(options.continueOnError),
        verbose: Boolean(options.verbose)
      },
      emitter
    );
  });

program.parse();

function printPlan(config: { steps: { title: string; weight: number }[] }) {
  console.log("Dry run: no steps executed.");
  console.log("Plan:");
  config.steps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.title} (weight ${step.weight})`);
  });
}
```

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/index.ts src/utils/tty.ts tests/cli.test.ts
git commit -m "feat: add cli entrypoint"
```

---

### Task 7: README

**Files:**
- Create: `README.md`

**Step 1: Create `README.md`**

```md
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
node dist/index.js install
```

## Config

Use `config/steps.json` or pass `--config <path>`.

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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add usage and config"
```

---

## Execution Notes
- If the Node version rejects `--loader tsx`, replace the CLI test with `npx tsx src/index.ts ...`.
- If you need to publish, remove `"private": true` in `package.json`.
