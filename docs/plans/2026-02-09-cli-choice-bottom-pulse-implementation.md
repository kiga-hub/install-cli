# CLI Choice Bottom Pulse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the choice UI to the bottom, shrink its size, and add configurable pulse + flicker with edge-diffused glow.

**Architecture:** Update `createChoicePrompt` to use bottom-docked layout and add two timers per button (pulse + flicker). Replace glow with multi-layer outer boxes to simulate edge diffusion.

**Tech Stack:** Node.js, TypeScript, blessed, vitest

---

### Task 1: Bottom layout + smaller panel

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt layout", () => {
  it("uses bottom-docked panel", () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    void prompt.open();
    // assert panel options include bottom: 0 and width: "100%"
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (layout still centered)

**Step 3: Implement layout change**

- Set panel options to `bottom: 0`, `left: 0`, `width: "100%"`, `height: 7`.
- Adjust button positions to fit smaller panel.

**Step 4: Update tests**

- Assert `bottom: 0` and `width: "100%"` in mocked box options.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

---

### Task 2: Edge-diffused glow + pulse/flicker timers

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt pulse", () => {
  it("starts pulse and flicker timers on focus", () => {
    vi.useFakeTimers();
    const prompt = createChoicePrompt({ title: "Step complete" });
    void prompt.open();
    // assert setInterval called twice (pulse + flicker)
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (no flicker timer)

**Step 3: Implement glow + timers**

- Replace single glow with 2–3 outer glow boxes (diffused edge).
- Add `pulseMs` and `flickerMs` (default 320/140).
- Pulse toggles glow border intensity; flicker toggles text fg/bold.
- Stop and clear both timers on blur/mouseout and teardown.

**Step 4: Update tests**

- Assert two timers start/stop, and glow boxes are created.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS
