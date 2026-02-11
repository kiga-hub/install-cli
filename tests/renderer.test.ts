import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { createLogUpdate } from "log-update";
import { createRenderer, renderProgressLine } from "../src/renderer.js";
import { defaultTheme, parseConfig } from "../src/config.js";

const baseUi = parseConfig({ steps: [{ id: "base", title: "Base" }] }).ui;
const BELOW_ZERO = -5;
const ABOVE_HUNDRED = 120;
const ROUND_LABEL_UP = 33.6; // Rounds to 34 for label rounding coverage.
const ROUND_BAR_DOWN = 2.3; // Rounds to 2 for bar-length rounding coverage.
const ROUND_LABEL_DOWN_BELOW_FULL = 99.4; // Rounds to 99 so bar remains below full.
const ROUND_LABEL_UP_TO_FULL = 99.6; // Rounds to 100 so bar reaches full.
const TEN_PERCENT = 10;
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const getBarContent = (line: string) => {
  const barMatch = stripAnsi(line).match(/\[([^\]]*)\]/);
  if (!barMatch) {
    throw new Error("Expected progress bar brackets in output");
  }
  return barMatch[1];
};
const setRows = (rows: number) => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "rows");
  Object.defineProperty(process.stdout, "rows", { value: rows, configurable: true });
  return () => {
    if (descriptor) {
      Object.defineProperty(process.stdout, "rows", descriptor);
    } else {
      delete (process.stdout as { rows?: number }).rows;
    }
  };
};

const renderWith = ({ isTTY, rows }: { isTTY: boolean; rows: number }) => {
  const config = parseConfig({ steps: [{ id: "one", title: "One" }] });
  const restoreRows = setRows(rows);
  const renderer = createRenderer(config, { noColor: true, isTTY, verbose: true });
  const emitter = new EventEmitter();
  renderer.attach(emitter);

  if (!isTTY) {
    const output = stripAnsi(
      renderProgressLine(
        {
          percent: 0,
          stepTitle: "One",
          stepIndex: 0,
          totalSteps: 1,
          elapsedMs: 0
        },
        config.theme,
        { noColor: true, brandLabel: config.ui.brandLabel, ui: config.ui }
      )
    );
    restoreRows();
    return { output, lines: output.split("\n") };
  }

  const update = vi.mocked(createLogUpdate).mock.results.slice(-1)[0]?.value;
  if (!update) {
    restoreRows();
    throw new Error("log-update mock was not initialized");
  }

  emitter.emit("step:progress", {
    step: config.steps[0],
    index: 0,
    completedWeight: 0,
    totalWeight: 1,
    percent: 0
  });

  const calls = update.mock.calls;
  const output = stripAnsi(String(calls[calls.length - 1]?.[0] ?? ""));
  emitter.emit("run:complete");
  restoreRows();
  return { output, lines: output.split("\n") };
};

vi.mock("log-update", () => {
  return {
    createLogUpdate: vi.fn(() => {
      const update = vi.fn();
      update.clear = vi.fn();
      update.done = vi.fn();
      return update;
    })
  };
});

describe("renderer", () => {
  beforeEach(() => {
    vi.mocked(createLogUpdate).mockClear();
  });

  it("renders bar and separators", () => {
    const line = renderProgressLine(
      {
        percent: 45,
        stepTitle: "Installing dependencies",
        stepIndex: 1,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    expect(line).toContain("[");
    expect(line).toContain("]");
    expect(line).toContain("█");
    expect(line).toContain(" • ");
  });

  it("clamps and rounds percent label", () => {
    const percentRoundsUp = ROUND_LABEL_UP;
    const line = renderProgressLine(
      {
        percent: percentRoundsUp,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    expect(line).toContain("34%");
  });

  it("clamps percent label to bounds", () => {
    const negativeLine = renderProgressLine(
      {
        percent: BELOW_ZERO,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );
    const overLine = renderProgressLine(
      {
        percent: ABOVE_HUNDRED,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    expect(negativeLine).toContain("0%");
    expect(overLine).toContain("100%");
  });

  it("uses rounded percent for bar length", () => {
    const percentRoundsDown = ROUND_BAR_DOWN;
    const baseLine = renderProgressLine(
      {
        percent: 0,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );
    const baseBarWidth = getBarContent(baseLine).length;
    const line = renderProgressLine(
      {
        percent: percentRoundsDown,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    const barContent = getBarContent(line);
    expect(barContent.length).toBe(baseBarWidth);
    expect(barContent).not.toContain(baseUi.barChars.full);
  });

  it("rounds label to 99 percent while bar stays below full", () => {
    const percentRoundsDownBelowFull = ROUND_LABEL_DOWN_BELOW_FULL;
    const line = renderProgressLine(
      {
        percent: percentRoundsDownBelowFull,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    expect(line).toContain("99%");
    const barContent = getBarContent(line);
    const barWidth = barContent.length;

    expect(barContent).not.toBe(baseUi.barChars.full.repeat(barWidth));
  });

  it("shows incomplete segment for 99.4 percent without glow", () => {
    const ui = { ...baseUi, animation: { ...baseUi.animation, glowWidth: 0 } };
    const percentRoundsDownBelowFull = ROUND_LABEL_DOWN_BELOW_FULL;
    const line = renderProgressLine(
      {
        percent: percentRoundsDownBelowFull,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui }
    );

    const barContent = getBarContent(line);
    const incompleteChar = ui.unicode ? ui.barChars.empty : "-";

    expect(barContent).toContain(incompleteChar);
  });

  it("fills bar when label rounds to 100 percent without glow", () => {
    const ui = { ...baseUi, animation: { ...baseUi.animation, glowWidth: 0 } };
    const percentRoundsUpToFull = ROUND_LABEL_UP_TO_FULL;
    const line = renderProgressLine(
      {
        percent: percentRoundsUpToFull,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui }
    );

    expect(line).toContain("100%");
    const barContent = getBarContent(line);
    const incompleteChar = ui.unicode ? ui.barChars.empty : "-";

    expect(barContent).not.toContain(incompleteChar);
  });

  it("renders non-finite percent as 0 without throwing", () => {
    const line = renderProgressLine(
      {
        percent: Number.NaN,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui: baseUi }
    );

    expect(line).toContain("0%");
  });

  it("confines glow band to completed segment", () => {
    const ui = {
      ...baseUi,
      unicode: true,
      animation: { ...baseUi.animation, glowWidth: 4 }
    };
    const baseLine = renderProgressLine(
      {
        percent: 0,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui, glowOffset: 0 }
    );
    const barWidth = getBarContent(baseLine).length;
    const line = renderProgressLine(
      {
        percent: TEN_PERCENT,
        stepTitle: "Installing dependencies",
        stepIndex: 0,
        totalSteps: 3,
        elapsedMs: 12000
      },
      defaultTheme,
      { noColor: true, brandLabel: "OpenInstall", ui, glowOffset: 0 }
    );

    const barContent = getBarContent(line);
    const completeLength = Math.round((TEN_PERCENT / 100) * barWidth);

    const glowChar = ui.barChars.glow;
    expect(barContent.slice(0, completeLength)).toContain(glowChar);
    expect(barContent.slice(completeLength)).not.toContain(glowChar);
  });

  it("resets percent and timer on step start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));

    const config = parseConfig({
      steps: [
        { id: "one", title: "One", weight: 1 },
        { id: "two", title: "Two", weight: 1 }
      ]
    });
    const renderer = createRenderer(config, {
      noColor: true,
      isTTY: true,
      verbose: true
    });
    const emitter = new EventEmitter();
    renderer.attach(emitter);

    const updateResults = vi.mocked(createLogUpdate).mock.results;
    const update = updateResults[updateResults.length - 1]?.value;
    if (!update) {
      throw new Error("log-update mock was not initialized");
    }

    vi.setSystemTime(new Date("2020-01-01T00:00:20Z"));
    emitter.emit("step:progress", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 2,
      percent: 100
    });

    const firstCalls = update.mock.calls;
    expect(firstCalls.length).toBeGreaterThan(0);
    const firstOutput = stripAnsi(String(firstCalls[firstCalls.length - 1][0]));
    expect(firstOutput).toContain("100%");
    expect(firstOutput).toContain("00:20");

    vi.setSystemTime(new Date("2020-01-01T00:00:40Z"));
    emitter.emit("step:start", {
      step: config.steps[1],
      index: 1,
      completedWeight: 1,
      totalWeight: 2
    });

    const secondCalls = update.mock.calls;
    expect(secondCalls.length).toBeGreaterThan(0);
    const secondOutput = stripAnsi(String(secondCalls[secondCalls.length - 1][0]));
    expect(secondOutput).toContain("0%");
    expect(secondOutput).toContain("00:00");

    emitter.emit("run:complete");
    vi.useRealTimers();
  });

  it("renders status line under progress after log event", () => {
    const restoreRows = setRows(24);
    const config = parseConfig({
      steps: [{ id: "prepare", title: "Prepare", weight: 1 }]
    });
    const renderer = createRenderer(config, {
      noColor: true,
      isTTY: true,
      verbose: true
    });
    const emitter = new EventEmitter();
    renderer.attach(emitter);

    const update = vi.mocked(createLogUpdate).mock.results[0]?.value;
    if (!update) {
      throw new Error("log-update mock was not initialized");
    }

    emitter.emit("step:start", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 1
    });

    emitter.emit("step:log", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 1,
      percent: 0,
      level: "info",
      message: "Checking env"
    });

    const calls = update.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const output = stripAnsi(String(calls[calls.length - 1][0]));
    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(lines[1]).toContain("STATUS | Prepare — Checking env");
    emitter.emit("run:complete");
    restoreRows();
  });

  it("uses ascii joiner when unicode is disabled", () => {
    const restoreRows = setRows(24);
    const config = parseConfig({
      steps: [{ id: "prepare", title: "Prepare", weight: 1 }]
    });
    const renderer = createRenderer(
      { ...config, ui: { ...config.ui, unicode: false } },
      { noColor: true, isTTY: true, verbose: true }
    );
    const emitter = new EventEmitter();
    renderer.attach(emitter);

    const update = vi.mocked(createLogUpdate).mock.results[0]?.value;
    if (!update) {
      throw new Error("log-update mock was not initialized");
    }

    emitter.emit("step:start", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 1
    });

    emitter.emit("step:log", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 1,
      percent: 0,
      level: "info",
      message: "Checking env"
    });

    const calls = update.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const output = stripAnsi(String(calls[calls.length - 1][0]));
    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(lines[1]).toContain("STATUS | Prepare - Checking env");
    emitter.emit("run:complete");
    restoreRows();
  });

  it("renders a left frame in TTY mode", () => {
    const output = renderWith({ isTTY: true, rows: 24 });

    const progressLine = output.lines[0] ?? "";
    expect(progressLine).toMatch(/^[.o•]{4}\s/);
  });

  it("clamps frame height", () => {
    const minRows = 6;
    const oversizedRows = 60;
    const small = renderWith({ isTTY: true, rows: minRows });
    const large = renderWith({ isTTY: true, rows: oversizedRows });

    expect(small.lines.length).toBeGreaterThanOrEqual(6);
    expect(small.lines.length).toBeLessThanOrEqual(minRows);
    expect(large.lines.length).toBeGreaterThanOrEqual(6);
    expect(large.lines.length).toBeLessThanOrEqual(12);
  });

  it("caps frame height at terminal rows", () => {
    const rows = 4;
    const output = renderWith({ isTTY: true, rows });

    expect(output.lines.length).toBeLessThanOrEqual(rows);
  });

  it("skips frame when not TTY", () => {
    const output = renderWith({ isTTY: false, rows: 24 });

    expect(output.lines[0]).not.toMatch(/^\.+\s/);
  });
});

describe("renderer unicode", () => {
  it("uses unicode bar characters when enabled", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const line = renderProgressLine(
      { percent: 50, stepTitle: "X", stepIndex: 0, totalSteps: 1, elapsedMs: 0 },
      config.theme,
      { noColor: false, brandLabel: "OpenInstall", ui: config.ui }
    );
    expect(line).toContain("█");
  });

  it("uses unicode separators when noColor is true", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const line = renderProgressLine(
      { percent: 50, stepTitle: "X", stepIndex: 0, totalSteps: 1, elapsedMs: 0 },
      config.theme,
      { noColor: true, brandLabel: "OpenInstall", ui: config.ui }
    );

    expect(line).toContain(" • ");
    expect(line).toContain("█");
  });

  it("uses ascii separators and bars when unicode is disabled", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const ui = { ...config.ui, unicode: false };
    const line = renderProgressLine(
      { percent: 50, stepTitle: "X", stepIndex: 0, totalSteps: 1, elapsedMs: 0 },
      config.theme,
      { noColor: true, brandLabel: "OpenInstall", ui }
    );

    expect(line).toContain(" | ");
    const barContent = getBarContent(line);
    expect(barContent).toContain("=");
    expect(barContent).toContain("-");
    expect(barContent).not.toContain("█");
  });

  it("keeps unicode characters when noColor is true", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const line = renderProgressLine(
      { percent: 50, stepTitle: "X", stepIndex: 0, totalSteps: 1, elapsedMs: 0 },
      config.theme,
      { noColor: true, brandLabel: "OpenInstall", ui: config.ui }
    );

    expect(line).toContain("█");
    expect(line).toContain(" • ");
  });
});

describe("renderer results", () => {
  it("prints step result with success icon", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", result: "Done" }]
    });
    const renderer = createRenderer(config, {
      noColor: true,
      isTTY: false,
      verbose: true
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const emitter = new EventEmitter();
    renderer.attach(emitter);

    emitter.emit("step:start", {
      step: config.steps[0],
      index: 0,
      completedWeight: 0,
      totalWeight: 1
    });

    emitter.emit("step:result", { step: config.steps[0], result: "Done" });

    expect(consoleSpy).toHaveBeenCalledWith("✓ RESULT | Done");

    consoleSpy.mockRestore();
  });

  it("formats result output with badge", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", result: "Built 12 bundles" }]
    });
    const renderer = createRenderer(config, {
      noColor: true,
      isTTY: false,
      verbose: true
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const emitter = new EventEmitter();
    renderer.attach(emitter);

    emitter.emit("step:result", { step: config.steps[0], result: "Built 12 bundles" });

    expect(consoleSpy).toHaveBeenCalledWith("✓ RESULT | Built 12 bundles");

    consoleSpy.mockRestore();
  });

  it("skips logging when step result is empty", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", result: "" }]
    });
    const renderer = createRenderer(config, {
      noColor: true,
      isTTY: false,
      verbose: true
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const emitter = new EventEmitter();
    renderer.attach(emitter);

    emitter.emit("step:result", { step: config.steps[0], result: "" });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
