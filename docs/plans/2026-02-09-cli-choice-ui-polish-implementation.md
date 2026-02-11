# CLI Choice UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the choice prompt UI with neon blue borders, frosted glass panel (dot texture), and hover glow effects.

**Architecture:** Update `createChoicePrompt` to render layered boxes (base, texture, content) and use dual-layer buttons plus a glow box on hover/focus. No changes to controller logic.

**Tech Stack:** Node.js, TypeScript, blessed, chalk

---

### Task 1: Frosted glass panel + dot texture

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt polish", () => {
  it("exposes resolveWith and open", async () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    await expect(prompt.resolveWith("next")).resolves.toBe("next");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (when module changes are in progress)

**Step 3: Implement frosted panel**

- Create a base panel box with dim background.
- Add a texture box that fills the panel interior using a dot pattern string.
- Render content on a top panel box.

**Step 4: Update tests**

- Keep `resolveWith` test as a smoke test.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

---

### Task 2: Neon borders + hover glow

**Files:**
- Modify: `src/ui/choicePrompt.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createChoicePrompt } from "../src/ui/choicePrompt.js";

describe("choice prompt buttons", () => {
  it("still resolves with resolveWith", async () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    await expect(prompt.resolveWith("auto")).resolves.toBe("auto");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL if button wiring breaks

**Step 3: Implement neon borders and glow**

- Use dual-layer button borders (outer cyan, inner bright cyan).
- Add an outer glow box that toggles on focus/hover.
- Increase background brightness on hover.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS
