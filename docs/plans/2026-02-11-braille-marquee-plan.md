# Braille Marquee Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dot marquee with a single braille character indicator (2x4 dot matrix) that animates clockwise in one terminal cell.

**Architecture:** Use a braille mask sequence to produce one character per frame in Unicode mode. Prefix the progress line with that character and keep status alignment by padding. Use ASCII fallback for non-unicode terminals. Animation timing continues to use `frameTickMs` with `tickMs` fallback.

**Tech Stack:** Node.js, TypeScript, log-update, Vitest

---

### Task 1: Add failing tests for braille marquee

**Files:**
- Modify: `tests/renderer.test.ts`

**Step 1: Write the failing test**

Add tests that assert the marquee prefix is a single braille character in unicode mode and two characters in ASCII mode.

```ts
it("renders a braille marquee prefix in unicode mode", () => {
  const output = renderTtyOutput({ rows: 24 });
  const progressLine = output.lines[0] ?? "";
  expect(progressLine).toMatch(/^\p{Braille}\s/u);
});

it("renders a two-char marquee in ascii mode", () => {
  const config = parseConfig({ steps: [{ id: "one", title: "One" }] });
  const { emitter, update, restoreRows } = setupTtyRenderer({
    rows: 24,
    config: { ...config, ui: { ...config.ui, unicode: false } }
  });
  emitter.emit("step:progress", {
    step: config.steps[0],
    index: 0,
    completedWeight: 0,
    totalWeight: 1,
    percent: 0
  });
  const output = stripAnsi(String(update.mock.calls.slice(-1)[0]?.[0] ?? ""));
  expect(output).toMatch(/^[\.o]{2}\s/);
  emitter.emit("run:complete");
  restoreRows();
});
```

**Step 2: Run tests to verify failure**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: FAIL because the renderer still uses dot marquee.

**Step 3: Commit**

```bash
git add tests/renderer.test.ts
git commit -m "test: cover braille marquee"
```

---

### Task 2: Implement braille marquee rendering

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`

**Step 1: Write minimal implementation**

Add braille mask sequence and rendering helper:

```ts
const BRAILLE_BASE = 0x2800;
const BRAILLE_SEQUENCE = [1, 8, 16, 32, 128, 64, 4, 2];

const renderMarquee = () => {
  if (useUnicode) {
    const mask = BRAILLE_SEQUENCE[frameIndex % BRAILLE_SEQUENCE.length];
    const cell = String.fromCodePoint(BRAILLE_BASE + mask);
    return options.noColor ? cell : chalkInstance.hex(config.theme.accent)(cell);
  }
  const ascii = frameIndex % 2 === 0 ? "o." : ".o";
  return options.noColor ? ascii : chalkInstance.hex(config.theme.accent)(ascii);
};

const marqueeWidth = useUnicode ? 1 : 2;
const marqueePad = " ".repeat(marqueeWidth + 1);
```

Then update `render()` to prefix with `renderMarquee()` and pad the status line.

Remove the old `MARQUEE_WIDTH` dot logic and any unused constants.

**Step 2: Run tests to verify pass**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: switch to braille marquee"
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
git commit -m "refactor: stabilize braille marquee"
```

---

Plan complete and saved to `docs/plans/2026-02-11-braille-marquee-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
