# Left Frame Dots Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the left-side frame animation to be slimmer, use smaller dots, add color styling, and allow a dedicated animation speed.

**Architecture:** Extend UI config to include `frameTickMs` and use it in `createRenderer` for the frame loop. Render a 3-column dotted frame with a bright highlight dot and dim base dots. Keep frame height clamped and never exceeding terminal rows.

**Tech Stack:** Node.js, TypeScript, log-update, Vitest

---

### Task 1: Add failing tests for new UI animation setting

**Files:**
- Modify: `tests/config.test.ts`

**Step 1: Write the failing test**

Add a test that asserts the new `frameTickMs` default exists and is copied per parse:

```ts
it("applies default frame tick ms", () => {
  const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
  expect(config.ui.animation.frameTickMs).toBe(140);
});

it("does not share frame tick ms between parses", () => {
  const first = parseConfig({ steps: [{ id: "x", title: "X" }] });
  const second = parseConfig({ steps: [{ id: "y", title: "Y" }] });
  first.ui.animation.frameTickMs = 200;
  expect(second.ui.animation.frameTickMs).toBe(140);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/config.test.ts`

Expected: FAIL because `frameTickMs` does not exist yet.

**Step 3: Commit**

```bash
git add tests/config.test.ts
git commit -m "test: cover frame tick ui defaults"
```

---

### Task 2: Add frameTickMs to config schema

**Files:**
- Modify: `src/config.ts`

**Step 1: Write minimal implementation**

Add `frameTickMs` under `ui.animation` with a default of `140`:

```ts
animation: z
  .object({
    tickMs: z.number().int().positive().default(() => 90),
    glowWidth: z.number().int().positive().default(() => 4),
    frameTickMs: z.number().int().positive().default(() => 140)
  })
  .default(() => ({ tickMs: 90, glowWidth: 4, frameTickMs: 140 }))
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run tests/config.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add frame animation tick config"
```

---

### Task 3: Update frame visuals and speed

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing test**

Add a renderer test to assert the frame uses a 3-column width and that `frameTickMs` drives the animation timer (or that it falls back to `tickMs` when missing). Example:

```ts
it("uses frameTickMs for animation timing", () => {
  const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
  config.ui.animation.frameTickMs = 140;
  const renderer = createRenderer(config, { noColor: true, isTTY: true, verbose: true });
  // expect setInterval to be called with 140 (mock timers) or verify timer interval in a spy
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: FAIL because frameTickMs not used yet.

**Step 3: Write minimal implementation**

- Set `FRAME_WIDTH = 3`.
- Use `baseDot = useUnicode ? "·" : "."` and `highlightDot = useUnicode ? "•" : "o"`.
- Apply colors: dim gray for base dots, accent/brand for highlight (respect `noColor`).
- Replace the frame animation timer interval to `config.ui.animation.frameTickMs ?? config.ui.animation.tickMs`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: refine left frame dots"
```

---

### Task 4: Full verification

**Step 1: Run full tests**

Run: `npm test`

Expected: PASS

**Step 2: Run build**

Run: `npm run build`

Expected: PASS

**Step 3: Commit (optional)**

```bash
git add src/config.ts src/renderer.ts tests/config.test.ts tests/renderer.test.ts
git commit -m "refactor: stabilize frame animation styling"
```

---

Plan complete and saved to `docs/plans/2026-02-11-left-frame-dots-style-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
