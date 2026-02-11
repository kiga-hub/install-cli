# Inline Pill Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the large multi-line choice panel with a compact, single-line OpenCode-style pill prompt that does not overlap prior output.

**Architecture:** Add a pure layout helper in `src/ui/choicePrompt.ts` that computes a single-line prompt string and pill hitboxes based on terminal width. Render only on the last terminal row using `eraseLine()` and per-segment styling; update hit testing to use pill bounds. Cleanup clears that same row before resuming the main renderer.

**Tech Stack:** Node.js, TypeScript, terminal-kit, Vitest

---

### Task 1: Add layout helper tests (TDD)

**Files:**
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

Add tests that assert the inline layout picks the right variant and bounds. Use a new exported helper from `src/ui/choicePrompt.ts` named `computeInlineLayout` (test-first; it will be missing and fail).

```ts
import { createChoicePrompt, computeInlineLayout } from "../src/ui/choicePrompt.js";

it("computes a full inline layout with prefix", () => {
  const layout = computeInlineLayout(80, 24);
  expect(layout.row).toBe(24);
  expect(layout.line).toBe("Continue: [ Back ]  [ Auto ]  [ Next ]");
  expect(layout.pills[0]).toMatchObject({ id: "back", left: 11, right: 18, text: "[ Back ]" });
  expect(layout.pills[2]).toMatchObject({ id: "next", text: "[ Next ]" });
});

it("drops prefix and abbreviates when narrow", () => {
  const layout = computeInlineLayout(20, 10);
  expect(layout.row).toBe(10);
  expect(layout.line).toBe("[Bk] [Au] [Nx]");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: FAIL because `computeInlineLayout` is not exported and layout doesn’t exist yet.

**Step 3: Write minimal implementation**

In `src/ui/choicePrompt.ts`, add a pure helper and export it:

```ts
type InlineLayout = {
  row: number;
  line: string;
  pills: { id: Choice; left: number; right: number; text: string }[];
};

const fullLabels = ["Back", "Auto", "Next"] as const;
const shortLabels = ["Bk", "Au", "Nx"] as const;

const buildVariant = (
  cols: number,
  row: number,
  options: { prefix: boolean; short: boolean; gap: number; padded: boolean }
): InlineLayout => {
  const prefixText = options.prefix ? "Continue: " : "";
  const labels = options.short ? shortLabels : fullLabels;
  const pillText = labels.map((label) =>
    options.padded ? `[ ${label} ]` : `[${label}]`
  );
  const gapText = " ".repeat(options.gap);
  const line = prefixText + pillText.join(gapText);

  let x = 1 + prefixText.length;
  const pills = pillText.map((text, index) => {
    const left = x;
    const right = x + text.length - 1;
    x = right + 1 + (index === pillText.length - 1 ? 0 : options.gap);
    return { id: buttons[index].id, left, right, text };
  });

  return { row, line, pills };
};

export const computeInlineLayout = (cols: number, rows: number): InlineLayout => {
  const safeCols = Number.isFinite(cols) && cols > 0 ? cols : 80;
  const safeRows = Number.isFinite(rows) && rows > 0 ? rows : 24;
  const row = Math.max(1, safeRows);

  const variants = [
    { prefix: true, short: false, gap: 2, padded: true },
    { prefix: false, short: false, gap: 2, padded: true },
    { prefix: true, short: true, gap: 1, padded: false },
    { prefix: false, short: true, gap: 1, padded: false }
  ];

  for (const variant of variants) {
    const layout = buildVariant(safeCols, row, variant);
    if (layout.line.length <= safeCols) {
      return layout;
    }
  }

  return buildVariant(safeCols, row, { prefix: false, short: true, gap: 1, padded: false });
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: PASS for the new layout tests.

**Step 5: Commit**

```bash
git add tests/choicePrompt.test.ts src/ui/choicePrompt.ts
git commit -m "test: cover inline choice layout"
```

---

### Task 2: Render a single-line pill prompt

**Files:**
- Modify: `src/ui/choicePrompt.ts`

**Step 1: Write the failing test**

Add a test that ensures rendering only targets the last row and does not use multi-line clearing:

```ts
it("renders only on the bottom row", () => {
  const prompt = createChoicePrompt({ title: "Step complete" });
  prompt.open();

  const rows = terminalMock.height;
  const moveCalls = terminalMock.moveTo.mock.calls;
  expect(moveCalls.length).toBeGreaterThan(0);
  expect(moveCalls.every(([, y]) => y === rows)).toBe(true);
  expect(terminalMock.eraseArea).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: FAIL because the current renderer uses multiple rows and `eraseArea()`.

**Step 3: Write minimal implementation**

Replace the panel/pill drawing with single-line rendering:

```ts
let lastRow: number | null = null;

const render = () => {
  const cols = terminal.width;
  const rows = terminal.height;
  if (!Number.isFinite(cols) || cols <= 0 || !Number.isFinite(rows) || rows <= 0) {
    return;
  }
  const layout = computeInlineLayout(cols, rows);
  layouts = layout.pills.map((pill) => ({
    id: pill.id,
    left: pill.left,
    top: 1,
    width: pill.right - pill.left + 1,
    height: 1
  }));
  lastRow = layout.row;

  terminal.saveCursor();
  terminal.moveTo(1, layout.row);
  terminal.eraseLine();
  terminal.gray();
  terminal.noFormat(layout.line.slice(0, 0));

  let cursor = 1;
  const prefixLength = layout.line.length - layout.pills.reduce((sum, pill) => sum + pill.text.length, 0);
  if (prefixLength > 0) {
    const prefixText = layout.line.slice(0, prefixLength);
    terminal.noFormat(prefixText);
    cursor += prefixText.length;
  }

  layout.pills.forEach((pill, index) => {
    const focused = index === focusedIndex;
    applyNeon(focused);
    terminal.noFormat(pill.text);
    cursor += pill.text.length;
    if (index < layout.pills.length - 1) {
      terminal.gray();
      terminal.noFormat(" ".repeat(pill.left + pill.text.length <= pill.right ? 0 : 1));
    }
  });
  terminal.restoreCursor();
};
```

Then remove `drawPanel`, `drawFrostedTexture`, `drawButton`, `computePanelHeight`, and any unused constants tied to the multi-line panel.

Update `cleanup()` to clear the last rendered row:

```ts
if (lastRow) {
  terminal.saveCursor();
  terminal.moveTo(1, lastRow);
  terminal.eraseLine();
  terminal.restoreCursor();
}
terminal.grabInput(false);
terminal.hideCursor(false);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: PASS for the new single-line render test.

**Step 5: Commit**

```bash
git add src/ui/choicePrompt.ts tests/choicePrompt.test.ts
git commit -m "feat: render inline pill prompt"
```

---

### Task 3: Update mouse hit-testing for single line

**Files:**
- Modify: `src/ui/choicePrompt.ts`
- Modify: `tests/choicePrompt.test.ts`

**Step 1: Write the failing test**

Replace hard-coded mouse coordinates with values computed from the layout helper:

```ts
const layout = computeInlineLayout(terminalMock.width, terminalMock.height);
const first = layout.pills[0];
const x = Math.floor((first.left + first.right) / 2);
const y = layout.row;
mouseHandler("MOUSE_MOTION", { x, y });
```

Add a click test using the same `x/y` and assert the prompt resolves to `back`.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: FAIL because hit testing still expects panel coordinates.

**Step 3: Write minimal implementation**

Update `hitTest` to only accept hits on the bottom row and within pill bounds:

```ts
const hitTest = (layouts: ButtonLayout[], x: number, y: number, row: number) =>
  y === row ? layouts.find((layout) => x >= layout.left && x <= layout.left + layout.width - 1) : undefined;
```

Use `lastRow ?? terminal.height` when calling `hitTest` in mouse handlers.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/choicePrompt.test.ts`

Expected: PASS for hover and click tests.

**Step 5: Commit**

```bash
git add src/ui/choicePrompt.ts tests/choicePrompt.test.ts
git commit -m "fix: inline hit testing for pill prompt"
```

---

### Task 4: Full verification

**Files:**
- None (verification only)

**Step 1: Run full tests**

Run: `npm test`

Expected: PASS

**Step 2: Run build**

Run: `npm run build`

Expected: PASS

**Step 3: Commit (if desired)**

```bash
git add src/ui/choicePrompt.ts tests/choicePrompt.test.ts
git commit -m "refactor: compact inline prompt"
```

---

Plan complete and saved to `docs/plans/2026-02-10-inline-pill-prompt.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
