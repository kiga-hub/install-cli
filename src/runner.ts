import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import readline from "node:readline";
import type { InstallerConfig, RunnerOptions, StepConfig } from "./types.js";

type StepEvent = {
  step: StepConfig;
  index: number;
  total: number;
  percent: number;
  completedWeight: number;
  totalWeight: number;
};

export async function runSteps(
  config: InstallerConfig,
  options: RunnerOptions,
  emitter: EventEmitter
): Promise<void> {
  emitter.emit("run:start", { total: config.steps.length });

  for (let index = 0; index < config.steps.length; index += 1) {
    try {
      await runSingleStep(config, options, emitter, index);
    } catch (error) {
      if (!options.continueOnError) {
        emitter.emit("run:error", { error });
        throw error;
      }
    }
  }

  emitter.emit("run:complete", { total: config.steps.length });
}

export async function runSingleStep(
  config: InstallerConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  index: number
): Promise<void> {
  const step = config.steps[index];
  const totalWeight = config.steps.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = config.steps
    .slice(0, index)
    .reduce((sum, item) => sum + item.weight, 0);

  emitter.emit("step:start", {
    step,
    index,
    total: config.steps.length,
    completedWeight,
    totalWeight
  });

  try {
    if (step.command) {
      await runCommandStep(step, options, emitter, {
        index,
        totalWeight,
        completedWeight,
        total: config.steps.length
      });
    } else {
      await runSimulatedStep(step, options, emitter, {
        index,
        totalWeight,
        completedWeight,
        total: config.steps.length
      });
    }

    const updatedWeight = completedWeight + step.weight;
    if (step.result !== undefined) {
      emitter.emit("step:result", {
        step,
        index,
        total: config.steps.length,
        result: step.result
      });
    }
    emitter.emit("step:success", {
      step,
      index,
      total: config.steps.length,
      completedWeight: updatedWeight,
      totalWeight
    });
  } catch (error) {
    emitter.emit("step:error", {
      step,
      index,
      total: config.steps.length,
      error,
      completedWeight,
      totalWeight
    });
    throw error;
  }
}

async function runSimulatedStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  const duration = Math.max(200, (step.durationMs ?? 800) / Math.max(0.1, options.speed));
  const tickMs = 80;
  const start = Date.now();

  if (step.logs?.length) {
    const spacing = duration / (step.logs.length + 1);
    step.logs.forEach((message, idx) => {
      setTimeout(() => {
        emitter.emit("step:log", { level: "info", message, step, index: context.index });
      }, spacing * (idx + 1));
    });
  }

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.min(100, Math.round((elapsed / duration) * 100));

      const event: StepEvent = {
        step,
        index: context.index,
        total: context.total,
        percent,
        completedWeight: context.completedWeight,
        totalWeight: context.totalWeight
      };

      emitter.emit("step:progress", event);

      if (percent >= 100) {
        clearInterval(interval);
        resolve();
      }
    }, tickMs);
  });
}

async function runCommandStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command as string, {
      shell: true,
      cwd: step.cwd ?? process.cwd(),
      env: { ...process.env, ...step.env }
    });

    const stdout = child.stdout
      ? readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
      : null;
    const stderr = child.stderr
      ? readline.createInterface({ input: child.stderr, crlfDelay: Infinity })
      : null;

    stdout?.on("line", (line) =>
      emitter.emit("step:log", { level: "info", message: line, step, index: context.index })
    );
    stderr?.on("line", (line) =>
      emitter.emit("step:log", { level: "error", message: line, step, index: context.index })
    );

    let percent = 0;
    const tick = setInterval(() => {
      percent = Math.min(90, percent + 3);

      const event: StepEvent = {
        step,
        index: context.index,
        total: context.total,
        percent,
        completedWeight: context.completedWeight,
        totalWeight: context.totalWeight
      };

      emitter.emit("step:progress", event);
    }, 200);

    let settled = false;
    const cleanup = () => {
      clearInterval(tick);
      stdout?.close();
      stderr?.close();
    };
    const finishResolve = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    child.on("error", (error) => {
      finishReject(error instanceof Error ? error : new Error(String(error)));
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        const event: StepEvent = {
          step,
          index: context.index,
          total: context.total,
          percent: 100,
          completedWeight: context.completedWeight,
          totalWeight: context.totalWeight
        };

        emitter.emit("step:progress", event);
        finishResolve();
      } else if (signal) {
        finishReject(new Error(`Command failed: ${step.command} (signal ${signal})`));
      } else {
        finishReject(new Error(`Command failed: ${step.command} (exit ${code})`));
      }
    });
  });
}
