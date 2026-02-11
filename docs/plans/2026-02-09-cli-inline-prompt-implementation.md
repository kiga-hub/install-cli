# CLI Inline Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full-screen prompt with an inline, bottom-only prompt using terminal-kit to avoid full terminal refresh.

**Architecture:** Swap `choicePrompt` to terminal-kit, draw only the bottom panel, and handle mouse/keyboard selection with local redraws.

**Tech Stack:** Node.js, TypeScript, terminal-kit, vitest

---

### Task 1: Add terminal-kit dependency and new prompt module

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Replace: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("inline choice prompt", () => {
  it("exposes resolveWith and open", async () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    await expect(prompt.resolveWith("next")).resolves.toBe("next");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (module replaced)

**Step 3: Implement inline prompt**

- Use `terminal-kit` to draw a bottom panel (height 6–7).
- Draw neon bordered buttons with glow layers in bottom lines only.
- Capture mouse events and keyboard navigation.
- Provide `resolveWith` helper for tests.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

---

### Task 2: Hover pulse + flicker in inline prompt

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("inline pulse", () => {
  it("starts pulse + flicker timers on hover", () => {
    vi.useFakeTimers();
    const prompt = createChoicePrompt({ title: "Step complete" });
    void prompt.open();
    // assert two intervals start on hover
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL

**Step 3: Implement pulse/flicker**

- Start two timers on hover/focus.
- Clear both on blur/mouseout and teardown.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS
