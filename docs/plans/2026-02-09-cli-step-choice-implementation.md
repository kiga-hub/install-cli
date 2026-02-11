# CLI Step Choice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a clickable post-step choice prompt (Next / Auto / Back) with a frosted-glass panel and bordered buttons, while preserving current logic and rendering.

**Architecture:** Introduce a `StepController` that runs a single step at a time, pauses the renderer, and displays a blessed overlay for selection. Auto mode skips further prompts. Back re-runs the previous step. Renderer and runner logic otherwise remain unchanged.

**Tech Stack:** Node.js, TypeScript, blessed, chalk, gradient-string, log-update, vitest

---

### Task 1: Add blessed dependency and UI prompt module

**Files:**
- Modify: `package.json`
- Create: `src/ui/choicePrompt.ts`
- Create: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt", () => {
  it("returns a selection string", async () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    const result = await prompt.resolveWith("next");
    expect(result).toBe("next");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (missing prompt module)

**Step 3: Implement `createChoicePrompt`**

- Export `createChoicePrompt({ title })` returning an object with `open()` that resolves to `"next" | "auto" | "back"`.
- Use blessed to render:
  - Centered box (frosted-glass effect via dim background and soft border).
  - Three bordered buttons (Next, Auto, Back) with hover and active highlight.
- Enable `mouse: true`, `keys: true`.
- Provide a test-only helper: `resolveWith(choice)` to bypass UI in tests.

**Step 4: Add dependency**

Add to `package.json`:
```
"blessed": "^0.1.81"
```

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

---

### Task 2: Step controller to run one step at a time

**Files:**
- Create: `src/controller/stepController.ts`
- Modify: `src/runner.ts`
- Modify: `tests/runner.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createStepController } from "../src/controller/stepController.js";

describe("step controller", () => {
  it("runs steps one by one and respects auto mode", async () => {
    const controller = createStepController({ autoMode: true });
    const result = await controller.runAll();
    expect(result.completed).toBeGreaterThan(0);
  });
});
```

**Step 2: Update runner**

- Extract a `runSingleStep(config, options, emitter, index)` that runs a single step and emits events.

**Step 3: Implement step controller**

- `runAll()` loops over steps.
- After each step, if not auto: show prompt and handle next/auto/back.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

---

### Task 3: Wire controller into CLI

**Files:**
- Modify: `src/index.ts`
- Modify: `tests/cli.test.ts`

**Step 1: Add tests**

- Mock prompt to return `next` and ensure CLI continues.

**Step 2: Implement wiring**

- Replace direct `runSteps` call with controller.
- On `--auto`, skip prompt and run all steps.

**Step 3: Run tests**

Run: `npm test`
Expected: PASS
