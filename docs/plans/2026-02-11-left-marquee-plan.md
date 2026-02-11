# Left Marquee Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the tall left-side frame with a single-line marquee indicator that stays within one terminal row.

**Architecture:** Render a fixed-width dot marquee prefix only on the first output line. The highlight dot advances left-to-right and wraps, using the existing animation timer with `ui.animation.frameTickMs` (fallback to `tickMs`). The status line is padded with spaces equal to the marquee width so alignment stays consistent.

**Tech Stack:** Node.js, TypeScript, log-update, Vitest

---

### Task 1: Add failing tests for single-line marquee

**Files:**
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing test**

Add tests that verify the renderer emits at most two lines (progress + status) in TTY mode and that the progress line starts with a fixed-width marquee. Use a named constant for the marquee width.

```ts
const MARQUEE_WIDTH = 3;

it("renders a one-line marquee prefix", () => {
  const output = renderWith({ isTTY: true, rows: 24 });
  const progressLine = output.lines[0] ?? "";
  expect(progressLine).toMatch(new RegExp(`^[\\.o\\u00b7\\u2022]{${MARQUEE_WIDTH}}\\s`));
});

it("does not exceed two lines in TTY mode", () => {
  const config = parseConfig({ steps: [{ id: "prepare", title: "Prepare" }] });
  const renderer = createRenderer(config, { noColor: true, isTTY: true, verbose: true });
  const emitter = new EventEmitter();
  renderer.attach(emitter);
  emitter.emit("step:log", {
    step: config.steps[0],
    index: 0,
    completedWeight: 0,
    totalWeight: 1,
    percent: 0,
    level: "info",
    message: "Checking env"
  });
  const update = vi.mocked(createLogUpdate).mock.results[0]?.value;
  const output = stripAnsi(String(update?.mock.calls.slice(-1)[0]?.[0] ?? ""));
  const lines = output.split("\n");
  expect(lines.length).toBeLessThanOrEqual(2);
  emitter.emit("run:complete");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: FAIL because the renderer still outputs multi-line frame blocks.

**Step 3: Commit**

```bash
git add tests/renderer.test.ts
git commit -m "test: cover one-line marquee"
```

---

### Task 2: Implement the one-line marquee

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write minimal implementation**

Replace the frame block with a single-line marquee prefix:

```ts
const MARQUEE_WIDTH = 3;
const baseDot = useUnicode ? "\u00b7" : ".";
const highlightDot = useUnicode ? "\u2022" : "o";
const baseDotCell = options.noColor ? baseDot : chalkInstance.gray.dim(baseDot);
const highlightDotCell = options.noColor
  ? highlightDot
  : chalkInstance.hex(config.theme.accent)(highlightDot);

const renderMarquee = () => {
  const index = frameIndex % MARQUEE_WIDTH;
  return Array.from({ length: MARQUEE_WIDTH }, (_, i) =>
    i === index ? highlightDotCell : baseDotCell
  ).join("");
};
```

In `render()`:

```ts
const marquee = renderMarquee();
const marqueePad = " ".repeat(MARQUEE_WIDTH + 1);
const baseLine = spinner ? `${spinner} ${line}` : line;
const progressLine = `${marquee} ${baseLine}`;
const statusLine = lastLogMessage ? `${marqueePad}${status}` : undefined;
update([progressLine, statusLine].filter(Boolean).join("\n"));
```

Remove the multi-line frame helpers (`computeFrameHeight`, `buildPerimeter`, `renderFrameLines`) and any height constants that are no longer used.

Use `ui.animation.frameTickMs ?? ui.animation.tickMs` as the interval in `startAnimation` (keep existing fallback).

**Step 2: Run test to verify it passes**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: switch to one-line marquee"
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
git commit -m "refactor: stabilize marquee output"
```

---

Plan complete and saved to `docs/plans/2026-02-11-left-marquee-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
