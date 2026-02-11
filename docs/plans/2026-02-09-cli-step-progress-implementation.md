# CLI Step Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the progress bar to per-step progress while keeping modern UI, status line, and result lines intact.

**Architecture:** Renderer will track a `stepPercent` and reset on `step:start`, use it for bar/label, and show a per-step timer. Runner logic remains unchanged.

**Tech Stack:** Node.js, TypeScript, chalk, gradient-string, log-update, vitest

---

### Task 1: Renderer uses per-step percent

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { createRenderer } from "../src/renderer.js";
import { parseConfig } from "../src/config.js";

describe("renderer step progress", () => {
  it("resets percent to 0 on step start", () => {
    const config = parseConfig({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
    const renderer = createRenderer(config, { noColor: true, isTTY: true, verbose: true });

    const emitter = new EventEmitter();
    renderer.attach(emitter);

    emitter.emit("step:start", { step: config.steps[0], index: 0, completedWeight: 0, totalWeight: 2 });
    emitter.emit("step:progress", { step: config.steps[0], index: 0, total: 2, percent: 80, completedWeight: 0, totalWeight: 2 });
    emitter.emit("step:start", { step: config.steps[1], index: 1, completedWeight: 1, totalWeight: 2 });

    // Expect the progress line to reflect 0% for new step
    // Use log-update mock to inspect last update output.
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (renderer still uses overall progress)

**Step 3: Update `src/renderer.ts`**

- Add `stepPercent` and `stepStartTime` to render state.
- In `step:start`, set `stepPercent = 0` and reset `stepStartTime`.
- In `step:progress`, set `stepPercent = event.percent`.
- Use `stepPercent` in `renderProgressLine` instead of overall percent.
- Update timer to use `Date.now() - stepStartTime`.

**Step 4: Update tests**

- Use log-update mock to capture the rendered line and assert it contains `0%` after step reset.
- Add a test to ensure per-step percent does not carry over between steps.

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

---

### Task 2: Status line shows current step + latest log

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRenderer } from "../src/renderer.js";
import { parseConfig } from "../src/config.js";

describe("renderer status line", () => {
  it("shows STATUS with current step and latest log", () => {
    const config = parseConfig({ steps: [{ id: "a", title: "Prepare" }] });
    const renderer = createRenderer(config, { noColor: true, isTTY: true, verbose: true });
    const emitter = new EventEmitter();
    renderer.attach(emitter);

    emitter.emit("step:start", { step: config.steps[0], index: 0, completedWeight: 0, totalWeight: 1 });
    emitter.emit("step:log", { level: "info", message: "Checking env", step: config.steps[0], index: 0 });

    // Assert rendered output contains: "STATUS | Prepare — Checking env"
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (no status line)

**Step 3: Update `src/renderer.ts`**

- Render a second line under the progress line when `isTTY` is true.
- Add `lastLogMessage` and `lastLogLevel` to render state.
- On `step:log`, update status line content with `STATUS | <step> — <message>`.

**Step 4: Update tests**

- Capture multi-line output from log-update mock and assert status line is present.

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

---

### Task 3: Result line badge and status override

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRenderer } from "../src/renderer.js";
import { parseConfig } from "../src/config.js";

describe("renderer result badge", () => {
  it("prints RESULT badge on step result", () => {
    const config = parseConfig({ steps: [{ id: "a", title: "Build", result: "Built 12 bundles" }] });
    const renderer = createRenderer(config, { noColor: true, isTTY: false, verbose: true });
    const emitter = new EventEmitter();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    renderer.attach(emitter);
    emitter.emit("step:result", { step: config.steps[0], result: "Built 12 bundles" });

    expect(consoleSpy).toHaveBeenCalledWith("✓ RESULT | Built 12 bundles");
    consoleSpy.mockRestore();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (result line not formatted with badge)

**Step 3: Update `src/renderer.ts`**

- Format result log as `RESULT | <message>` with success icon in `printLog` or a dedicated helper.
- When a result arrives, temporarily override the status line to `RESULT | <message>`.

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS
