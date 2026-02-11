import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { Choice } from "../src/ui/choicePrompt.js";
import { createStepController } from "../src/controller/stepController.js";

type SpawnOverride =
  | ((...args: Parameters<typeof import("node:child_process").spawn>) =>
      ReturnType<typeof import("node:child_process").spawn>)
  | null;

let spawnOverride: SpawnOverride = null;

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process"
  );
  return {
    ...actual,
    spawn: ((...args: Parameters<typeof actual.spawn>) => {
      if (spawnOverride) {
        return spawnOverride(...args);
      }
      return actual.spawn(...args);
    }) as typeof actual.spawn
  };
});

describe("runner", () => {
  it("emits progress and success for simulated step", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const emitter = new EventEmitter();
    const percents: number[] = [];

    emitter.on("step:progress", (event) => {
      percents.push(event.percent);
    });

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [{ id: "one", title: "Step One", weight: 1, durationMs: 400 }]
    };

    const { runSteps } = await import("../src/runner.js");
    const runPromise = runSteps(
      config,
      { speed: 1, continueOnError: false, verbose: false },
      emitter
    );
    await vi.runAllTimersAsync();
    await runPromise;

    expect(percents.length).toBeGreaterThan(0);
    expect(percents[percents.length - 1]).toBe(100);

    vi.useRealTimers();
  });

  it("rejects non-zero command exit without emitting 100", async () => {
    const emitter = new EventEmitter();
    const percents: number[] = [];

    emitter.on("step:progress", (event) => {
      percents.push(event.percent);
    });

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [{ id: "one", title: "Step One", weight: 1, command: "exit 1" }]
    };

    const { runSteps } = await import("../src/runner.js");
    await expect(
      runSteps(config, { speed: 1, continueOnError: false, verbose: false }, emitter)
    ).rejects.toThrow("Command failed");

    expect(percents).not.toContain(100);
  });

  it("includes signal in error when command closes with signal", async () => {
    const { runSteps } = await import("../src/runner.js");
    spawnOverride = () => {
      const child = new EventEmitter() as unknown as {
        stdout: Readable;
        stderr: Readable;
        on: EventEmitter["on"];
        emit: EventEmitter["emit"];
      };
      child.stdout = new Readable({ read() {} });
      child.stderr = new Readable({ read() {} });
      child.on("error", () => {});
      process.nextTick(() => child.emit("close", null, "SIGTERM"));
      return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
    };

    const emitter = new EventEmitter();
    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [{ id: "one", title: "Step One", weight: 1, command: "nope" }]
    };

    try {
      await expect(
        runSteps(config, { speed: 1, continueOnError: false, verbose: false }, emitter)
      ).rejects.toThrow("SIGTERM");
    } finally {
      spawnOverride = null;
    }
  });

  it("rejects on spawn error", async () => {
    const { runSteps } = await import("../src/runner.js");
    const spawnError = new Error("spawn failure");
    spawnOverride = () => {
      const child = new EventEmitter() as unknown as {
        stdout: Readable;
        stderr: Readable;
        on: EventEmitter["on"];
        emit: EventEmitter["emit"];
      };
      child.stdout = new Readable({ read() {} });
      child.stderr = new Readable({ read() {} });
      child.on("error", () => {});
      process.nextTick(() => child.emit("error", spawnError));
      return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
    };

    const emitter = new EventEmitter();
    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [{ id: "one", title: "Step One", weight: 1, command: "nope" }]
    };

    const runPromise = runSteps(
      config,
      { speed: 1, continueOnError: false, verbose: false },
      emitter
    );

    void runPromise.catch(() => {});

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout waiting for spawn error")), 50)
    );

    try {
      await expect(Promise.race([runPromise, timeout])).rejects.toThrow("spawn failure");
    } finally {
      spawnOverride = null;
    }
  });
});

describe("runner results", () => {
  it("emits step:result when result is empty string", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const emitter = new EventEmitter();
    const results: string[] = [];
    emitter.on("step:result", (event) => results.push(event.result));

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      ui: {
        unicode: true,
        brandLabel: "OpenInstall",
        spinnerFrames: ["⟡"],
        barChars: { full: "█", empty: "░", glow: "▓" },
        separators: { unicode: " • ", ascii: " | " },
        animation: { tickMs: 90, glowWidth: 4 }
      },
      steps: [{ id: "one", title: "Step One", weight: 1, durationMs: 10, result: "" }]
    };

    const { runSteps } = await import("../src/runner.js");
    const runPromise = runSteps(
      config,
      { speed: 1, continueOnError: false, verbose: false },
      emitter
    );
    await vi.runAllTimersAsync();
    await runPromise;

    expect(results).toEqual([""]);

    vi.useRealTimers();
  });
});

describe("step controller", () => {
  it("runs remaining steps without prompting after auto mode", async () => {
    vi.useFakeTimers();

    const emitter = new EventEmitter();
    const successes: string[] = [];
    emitter.on("step:success", (event) => successes.push(event.step.id));

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [
        { id: "one", title: "Step One", weight: 1, durationMs: 10 },
        { id: "two", title: "Step Two", weight: 1, durationMs: 10 },
        { id: "three", title: "Step Three", weight: 1, durationMs: 10 }
      ]
    };

    const prompt = {
      open: vi.fn().mockResolvedValue("auto")
    };

    const { runAll } = createStepController({
      config,
      options: { speed: 1, continueOnError: false, verbose: false },
      emitter,
      prompt,
      renderer: { pause: vi.fn(), resume: vi.fn() }
    });

    const runPromise = runAll();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(prompt.open).toHaveBeenCalledTimes(1);
    expect(successes).toEqual(["one", "two", "three"]);

    vi.useRealTimers();
  });

  it("re-runs previous step when back is selected", async () => {
    vi.useFakeTimers();

    const emitter = new EventEmitter();
    const successes: string[] = [];
    emitter.on("step:success", (event) => successes.push(event.step.id));

    const config = {
      theme: {
        brand: ["#00C2FF", "#00E6A8"],
        accent: "#F6C177",
        success: "#2ED573",
        warn: "#FFA502",
        error: "#FF4757",
        barComplete: "#00E6A8",
        barIncomplete: "#2F3542",
        spinner: "dots"
      },
      steps: [
        { id: "one", title: "Step One", weight: 1, durationMs: 10 },
        { id: "two", title: "Step Two", weight: 1, durationMs: 10 }
      ]
    };

    const choices: Choice[] = ["next", "back", "next", "next"];
    const prompt = {
      open: vi.fn(async () => choices.shift() ?? "next")
    };

    const { runAll } = createStepController({
      config,
      options: { speed: 1, continueOnError: false, verbose: false },
      emitter,
      prompt,
      renderer: { pause: vi.fn(), resume: vi.fn() }
    });

    const runPromise = runAll();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(successes).toEqual(["one", "two", "one", "two"]);
    expect(prompt.open).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
