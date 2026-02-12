import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import readline from "node:readline";
import type { InstallerConfig, RunnerOptions, StepConfig, StepLog } from "./types.js";
import { detectOS, getInstallCommand, isPackageInstalled, getOSDisplayName } from "./utils/os.js";

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
    if (step.type === "shell" && step.id === "prepare") {
      await runSystemCheckStep(step, options, emitter, {
        index,
        totalWeight,
        completedWeight,
        total: config.steps.length
      });
    } else if (step.type === "install" && step.package) {
      await runCommandStep(step, options, emitter, {
        index,
        totalWeight,
        completedWeight,
        total: config.steps.length
      });
    } else if (step.command) {
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
    step.logs.forEach((log, idx) => {
      const logMessage = typeof log === "string" ? log : log.message;
      const logLevel = (log as StepLog).level || "info";
      setTimeout(() => {
        emitter.emit("step:log", { level: logLevel, message: logMessage, step, index: context.index });
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

async function runSystemCheckStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  const { execSync, spawn } = await import("node:child_process");

  try {
    const osRelease = execSync("cat /etc/os-release | grep PRETTY_NAME | cut -d'\"' -f2", { encoding: "utf-8" }).trim();
    emitter.emit("step:log", { level: "info", message: `OS: ${osRelease}`, step, index: context.index });
  } catch {
    emitter.emit("step:log", { level: "info", message: `OS: Unknown`, step, index: context.index });
  }

  try {
    const kernel = execSync("uname -r", { encoding: "utf-8" }).trim();
    emitter.emit("step:log", { level: "info", message: `Kernel: ${kernel}`, step, index: context.index });
  } catch {
    emitter.emit("step:log", { level: "info", message: `Kernel: Unknown`, step, index: context.index });
  }

  try {
    const arch = execSync("uname -m", { encoding: "utf-8" }).trim();
    emitter.emit("step:log", { level: "info", message: `Architecture: ${arch}`, step, index: context.index });
  } catch {
    emitter.emit("step:log", { level: "info", message: `Architecture: Unknown`, step, index: context.index });
  }

  const internetCheck = spawn("curl -s --connect-timeout 5 https://www.baidu.com > /dev/null 2>&1 && echo 'online' || echo 'offline'", {
    shell: true
  });

  let internetStatus = "unknown";
  internetCheck.stdout.on("data", (data) => {
    internetStatus = data.toString().trim();
  });
  internetCheck.on("close", (code) => {
    const status = internetStatus === "online" ? "Connected" : "Disconnected";
    emitter.emit("step:log", {
      level: internetStatus === "online" ? "success" : "warn",
      message: `Internet: ${status}`,
      step,
      index: context.index
    });
  });

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 2000);
  });
}

async function runCommandStep(
  step: StepConfig,
  options: RunnerOptions,
  emitter: EventEmitter,
  context: { index: number; total: number; totalWeight: number; completedWeight: number }
): Promise<void> {
  let command = (step.command && step.command.length > 0) ? step.command : "echo ''";
  const os = detectOS();

  if (step.type === "install" && step.package) {
    if (os !== "unknown") {
      command = getInstallCommand(os, step.package);
      emitter.emit("step:log", {
        level: "info",
        message: `Detected ${getOSDisplayName(os)} - installing ${step.package}`,
        step,
        index: context.index
      });
      if (step.logs?.length) {
        step.logs.forEach((log) => {
          const logMessage = typeof log === "string" ? log : log.message;
          const logLevel = (log as StepLog).level || "info";
          emitter.emit("step:log", { level: logLevel, message: logMessage, step, index: context.index });
        });
      }
    } else {
      emitter.emit("step:log", {
        level: "warn",
        message: `Unsupported OS detected. Skipping package installation.`,
        step,
        index: context.index
      });
      return;
    }
  } else if (step.logs?.length) {
    step.logs.forEach((log) => {
      const logMessage = typeof log === "string" ? log : log.message;
      const logLevel = (log as StepLog).level || "info";
      emitter.emit("step:log", { level: logLevel, message: logMessage, step, index: context.index });
    });
  }

  if (step.type === "shell" && step.id === "prepare") {
    console.error("DEBUG: shell prepare detected");
    const { execSync } = await import("node:child_process");
    
    try {
      const osRelease = execSync("cat /etc/os-release | grep PRETTY_NAME | cut -d'\"' -f2", { encoding: "utf-8" }).trim();
      emitter.emit("step:log", { level: "info", message: `OS: ${osRelease}`, step, index: context.index });
      console.error("DEBUG: OS log emitted:", `OS: ${osRelease}`);
    } catch {
      emitter.emit("step:log", { level: "info", message: `OS: Unknown`, step, index: context.index });
    }
    
    try {
      const kernel = execSync("uname -r", { encoding: "utf-8" }).trim();
      emitter.emit("step:log", { level: "info", message: `Kernel: ${kernel}`, step, index: context.index });
    } catch {
      emitter.emit("step:log", { level: "info", message: `Kernel: Unknown`, step, index: context.index });
    }
    
    try {
      const arch = execSync("uname -m", { encoding: "utf-8" }).trim();
      emitter.emit("step:log", { level: "info", message: `Architecture: ${arch}`, step, index: context.index });
    } catch {
      emitter.emit("step:log", { level: "info", message: `Architecture: Unknown`, step, index: context.index });
    }
    
    const internetCheck = spawn("curl -s --connect-timeout 5 https://www.baidu.com > /dev/null 2>&1 && echo 'online' || echo 'offline'", {
      shell: true
    });
    
    let internetStatus = "unknown";
    internetCheck.stdout.on("data", (data) => {
      internetStatus = data.toString().trim();
    });
    internetCheck.on("close", (code) => {
      const status = internetStatus === "online" ? "Connected" : "Disconnected";
      emitter.emit("step:log", {
        level: internetStatus === "online" ? "success" : "warn",
        message: `Internet: ${status}`,
        step,
        index: context.index
      });
    });
    
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
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
      emitter.emit("step:log", { level: "info", message: line, step, index: context.index })
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
    const finishResolve = async () => {
      if (settled) return;
      settled = true;
      cleanup();

      if (step.type === "install" && step.package) {
        const os = detectOS();
        if (os !== "unknown") {
          const verifyCommand = isPackageInstalled(os, step.package);
          try {
            const { spawnSync } = await import("node:child_process");
            const result = spawnSync("sh", ["-c", verifyCommand], { encoding: "utf-8" });
            if (result.status === 0) {
              emitter.emit("step:log", {
                level: "success",
                message: `Verified: ${step.package} is installed`,
                step,
                index: context.index
              });
            } else {
              emitter.emit("step:log", {
                level: "warn",
                message: `Could not verify ${step.package} installation`,
                step,
                index: context.index
              });
            }
            } catch {
            emitter.emit("step:log", {
              level: "warn",
              message: `Could not verify ${step.package} installation`,
              step,
              index: context.index
            });
          }
        }
      }

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
