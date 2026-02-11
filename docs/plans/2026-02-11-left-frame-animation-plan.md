# Left Frame Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a left-side dotted rectangular frame animation that loops during installer runs without overlapping the inline prompt.

**Architecture:** Integrate a small frame renderer into `src/renderer.ts` so the frame is emitted alongside progress/status lines via `log-update`. The frame is built as a fixed-height block with a moving highlight along its perimeter; height scales with terminal rows and clamps to a min/max.

**Tech Stack:** Node.js, TypeScript, log-update, Vitest

---

### Task 1: Write failing tests for the left frame renderer

**Files:**
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing test**

Add tests that assert a left frame is prefixed to the progress output in TTY mode, and that height clamps correctly. Suggested tests (adjust for existing helpers):

```ts
it("renders a left frame in TTY mode", () => {
  const output = renderWith({ isTTY: true, rows: 24 });
  expect(output.lines[0]).toMatch(/^\.+\s/);
  expect(output.lines[1]).toMatch(/^\.+\s/);
});

it("clamps frame height", () => {
  const small = renderWith({ isTTY: true, rows: 6 });
  const large = renderWith({ isTTY: true, rows: 60 });
  expect(small.frameHeight).toBe(6);
  expect(large.frameHeight).toBe(12);
});

it("skips frame when not TTY", () => {
  const output = renderWith({ isTTY: false, rows: 24 });
  expect(output.lines[0]).not.toMatch(/^\.+\s/);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: FAIL because the frame is not implemented yet.

**Step 3: Commit**

```bash
git add tests/renderer.test.ts
git commit -m "test: cover left frame animation"
```

---

### Task 2: Implement left frame rendering

**Files:**
- Modify: `src/renderer.ts`

**Step 1: Write minimal implementation**

Add helpers inside `createRenderer`:

```ts
const FRAME_WIDTH = 4;
const FRAME_MIN_HEIGHT = 6;
const FRAME_MAX_HEIGHT = 12;
let frameIndex = 0;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const computeFrameHeight = (rows: number) =>
  clamp(Math.floor(rows * 0.5), FRAME_MIN_HEIGHT, FRAME_MAX_HEIGHT);

const buildPerimeter = (height: number) => {
  const width = FRAME_WIDTH;
  const coords: Array<[number, number]> = [];
  for (let x = 0; x < width; x += 1) coords.push([0, x]);
  for (let y = 1; y < height - 1; y += 1) coords.push([y, width - 1]);
  if (height > 1) {
    for (let x = width - 1; x >= 0; x -= 1) coords.push([height - 1, x]);
  }
  for (let y = height - 2; y >= 1; y -= 1) coords.push([y, 0]);
  return coords;
};

const renderFrameLines = (rows: number) => {
  const height = computeFrameHeight(rows);
  const perimeter = buildPerimeter(height);
  const highlight = perimeter[frameIndex % perimeter.length];
  const lines = Array.from({ length: height }, (_, row) => {
    const cells = Array.from({ length: FRAME_WIDTH }, () => ".");
    const hit = highlight && highlight[0] === row ? highlight[1] : -1;
    if (hit >= 0) cells[hit] = "•";
    return cells.join("");
  });
  return { height, lines };
};
```

In `render()`, if `options.isTTY`, prepend `frameLines[0]` and `frameLines[1]` to the progress/status lines and output remaining `frameLines` below. When not TTY, render as today.

Advance `frameIndex` in the existing animation timer (where spinner/glow update happens). Reset/clamp `frameIndex` on resize or when height changes.

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: add left frame animation"
```

---

### Task 3: Full verification

**Step 1: Run full tests**

Run: `npm test`

Expected: PASS

**Step 2: Run build**

Run: `npm run build`

Expected: PASS

**Step 3: Commit (optional)**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "refactor: stabilize left frame animation"
```

---

Plan complete and saved to `docs/plans/2026-02-11-left-frame-animation-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
