# CLI Choice Pulse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a subtle pulsing glow animation to hovered/focused choice buttons.

**Architecture:** Extend `createNeonButton` with a per-button pulse timer that toggles glow style while active. Clean up timers on blur/mouseout and on prompt teardown.

**Tech Stack:** Node.js, TypeScript, blessed, vitest

---

### Task 1: Pulse glow on hover/focus

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt pulse", () => {
  it("starts and stops a pulse timer on focus/blur", () => {
    vi.useFakeTimers();
    const prompt = createChoicePrompt({ title: "Step complete" });
    void prompt.open();
    // Expect setInterval called on focus, clearInterval on blur.
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (no pulse timer)

**Step 3: Implement pulse logic**

- Add `pulseTimer` per button.
- On focus/mouseover: start timer, toggle glow style between cyan and brightCyan.
- On blur/mouseout: clear timer, hide glow, reset style.
- Track timers for cleanup in prompt teardown.

**Step 4: Update tests**

- Mock focus/blur event handlers and assert `setInterval`/`clearInterval` calls.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS
