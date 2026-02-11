import chalk, { Chalk } from "chalk";
import gradient from "gradient-string";
import { createLogUpdate } from "log-update";
import type { EventEmitter } from "node:events";
import type { InstallerConfig, RendererOptions } from "./types.js";
import { formatDuration } from "./utils/time.js";

type RenderState = {
  percent: number;
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  completedWeight: number;
  totalWeight: number;
  startTime: number;
};

const BAR_WIDTH = 22;
export const MARQUEE_WIDTH = 3;

export function renderProgressLine(
  state: {
    percent: number;
    stepTitle: string;
    stepIndex: number;
    totalSteps: number;
    elapsedMs: number;
  },
  theme: InstallerConfig["theme"],
  options: { noColor: boolean; brandLabel: string; ui: InstallerConfig["ui"]; glowOffset?: number }
): string {
  const chalkInstance = new Chalk({ level: options.noColor ? 0 : 3 });
  const safePercent = Number.isFinite(state.percent) ? state.percent : 0;
  const clampedPercent = Math.max(0, Math.min(100, safePercent));
  const percentLabelValue = Math.round(clampedPercent);

  const completeLength = Math.floor((percentLabelValue / 100) * BAR_WIDTH);
  const useUnicode = options.ui.unicode;
  const completeChar = useUnicode ? options.ui.barChars.full : "=";
  const incompleteChar = useUnicode ? options.ui.barChars.empty : "-";
  const glowChar = useUnicode ? options.ui.barChars.glow : "=";
  const glowOffset = Math.max(0, options.glowOffset ?? 0);
  const glowWidth = Math.max(0, options.ui.animation.glowWidth);
  const glowEnd = glowWidth > 0 ? Math.min(completeLength, glowOffset + glowWidth) : 0;
  const complete = Array.from({ length: completeLength }, (_, index) => {
    if (glowWidth > 0 && index >= glowOffset && index < glowEnd) {
      return glowChar;
    }
    return completeChar;
  }).join("");
  const incomplete = incompleteChar.repeat(BAR_WIDTH - completeLength);

  const bar = `[${chalkInstance.hex(theme.barComplete)(complete)}${chalkInstance.hex(
    theme.barIncomplete
  )(incomplete)}]`;
  const percentLabel = chalkInstance.hex(theme.accent)(`${percentLabelValue}%`);
  const stepLabel = chalkInstance.hex(theme.accent)(
    `Step ${state.stepIndex + 1}/${state.totalSteps}`
  );
  const titleLabel = chalkInstance.white(state.stepTitle);
  const timer = chalkInstance.gray(formatDuration(state.elapsedMs));
  const separator = useUnicode ? options.ui.separators.unicode : options.ui.separators.ascii;

  return `${options.brandLabel} ${bar} ${percentLabel}${separator}${stepLabel}${separator}${titleLabel} ${timer}`;
}

export function createRenderer(config: InstallerConfig, options: RendererOptions) {
  const chalkInstance = new Chalk({ level: options.noColor ? 0 : 3 });
  const useUnicode = config.ui.unicode;
  const brandText = config.ui.brandLabel;
  const brandLabel = options.noColor
    ? brandText
    : gradient(...config.theme.brand).multiline(brandText);
  const separators = useUnicode ? config.ui.separators.unicode : config.ui.separators.ascii;
  const baseDot = useUnicode ? "·" : ".";
  const highlightDot = useUnicode ? "•" : "o";
  const baseDotCell = options.noColor ? baseDot : chalkInstance.gray.dim(baseDot);
  const highlightDotCell = options.noColor
    ? highlightDot
    : chalkInstance.hex(config.theme.accent)(highlightDot);
  let frameIndex = 0;

  const update = createLogUpdate(process.stdout, { showCursor: false });
  let hasRendered = false;
  let paused = false;
  let spinnerIndex = 0;
  let glowOffset = 0;
  let animationTimer: ReturnType<typeof setInterval> | null = null;
  let lastLogMessage: string | null = null;
  let lastLogLevel: "info" | "warn" | "error" | "success" = "info";
  let lastStatusLabel: string | null = null;
  const state: RenderState = {
    percent: 0,
    stepTitle: "Starting",
    stepIndex: 0,
    totalSteps: config.steps.length,
    completedWeight: 0,
    totalWeight: config.steps.reduce((sum, step) => sum + step.weight, 0),
    startTime: Date.now()
  };

  const renderMarquee = () => {
    const index = frameIndex % MARQUEE_WIDTH;
    return Array.from({ length: MARQUEE_WIDTH }, (_, i) =>
      i === index ? highlightDotCell : baseDotCell
    ).join("");
  };

  function render() {
    if (!options.isTTY || paused) {
      return;
    }

    const elapsedMs = Date.now() - state.startTime;
    const line = renderProgressLine(
      {
        percent: state.percent,
        stepTitle: state.stepTitle,
        stepIndex: state.stepIndex,
        totalSteps: state.totalSteps,
        elapsedMs
      },
      config.theme,
      { noColor: options.noColor, brandLabel, ui: config.ui, glowOffset }
    );
    const spinner = useUnicode ? config.ui.spinnerFrames[spinnerIndex] ?? "" : "";
    const baseLine = spinner ? `${spinner} ${line}` : line;
    const marquee = renderMarquee();
    const marqueePad = " ".repeat(MARQUEE_WIDTH + 1);
    if (lastLogMessage) {
      const statusColor =
        lastLogLevel === "success"
          ? config.theme.success
          : lastLogLevel === "warn"
            ? config.theme.warn
            : lastLogLevel === "error"
              ? config.theme.error
              : config.theme.accent;
      const labelText = lastStatusLabel ?? "STATUS";
      const statusLabel = options.noColor
        ? labelText
        : chalkInstance.hex(statusColor)(labelText);
      const stepJoiner = useUnicode ? " — " : " - ";
      const statusLine = lastStatusLabel
        ? `${statusLabel} | ${lastLogMessage}`
        : `${statusLabel} | ${state.stepTitle}${stepJoiner}${lastLogMessage}`;
      const progressLine = `${marquee} ${baseLine}`;
      update([progressLine, `${marqueePad}${statusLine}`].join("\n"));
    } else {
      update(`${marquee} ${baseLine}`);
    }
    hasRendered = true;
  }

  function startAnimation() {
    if (!options.isTTY || animationTimer || paused) {
      return;
    }
    const frameTickMs = config.ui.animation.frameTickMs ?? config.ui.animation.tickMs;
    animationTimer = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % config.ui.spinnerFrames.length;
      const safePercent = Number.isFinite(state.percent) ? state.percent : 0;
      const clampedPercent = Math.max(0, Math.min(100, safePercent));
      const percentLabelValue = Math.round(clampedPercent);
      const completeLength = Math.floor((percentLabelValue / 100) * BAR_WIDTH);
      const maxGlowOffset = Math.max(0, completeLength - config.ui.animation.glowWidth);
      glowOffset = maxGlowOffset > 0 ? (glowOffset + 1) % (maxGlowOffset + 1) : 0;
      frameIndex += 1;
      render();
    }, frameTickMs);
  }

  function stopAnimation() {
    if (!animationTimer) {
      return;
    }
    clearInterval(animationTimer);
    animationTimer = null;
  }

  function pause() {
    paused = true;
    stopAnimation();
  }

  function resume() {
    paused = false;
    startAnimation();
    render();
  }

  function printLog(
    level: "info" | "warn" | "error" | "success",
    message: string,
    status?: { label?: string; message?: string }
  ) {
    lastLogMessage = status?.message ?? message;
    lastLogLevel = level;
    lastStatusLabel = status?.label ?? null;
    const icon =
      level === "success"
        ? chalkInstance.hex(config.theme.success)(useUnicode ? "✓" : "+")
        : level === "warn"
          ? chalkInstance.hex(config.theme.warn)(useUnicode ? "⚠" : "!")
          : level === "error"
            ? chalkInstance.hex(config.theme.error)(useUnicode ? "✖" : "x")
            : chalkInstance.hex(config.theme.accent)(useUnicode ? "ℹ" : "i");

    const line = `${icon} ${message}`;

    if (options.isTTY) {
      if (hasRendered) {
        update.clear();
      }
      console.log(line);
      render();
      return;
    }

    console.log(line);
  }

  function attach(emitter: EventEmitter) {
    startAnimation();

    emitter.on("step:start", (event) => {
      state.stepTitle = event.step.title;
      state.stepIndex = event.index;
      state.completedWeight = event.completedWeight;
      state.totalWeight = event.totalWeight;
      state.percent = 0;
      state.startTime = Date.now();
      lastLogMessage = null;
      lastStatusLabel = null;
      render();
    });

    emitter.on("step:progress", (event) => {
      state.stepTitle = event.step.title;
      state.stepIndex = event.index;
      state.completedWeight = event.completedWeight;
      state.totalWeight = event.totalWeight;
      state.percent = event.percent;
      render();
    });

    emitter.on("step:log", (event) => {
      if (options.verbose || event.level !== "info") {
        printLog(event.level, event.message);
      }
    });

    emitter.on("step:success", (event) => {
      printLog("success", `${event.step.title} completed`);
    });

    emitter.on("step:result", (event) => {
      const message = event.result ? `${event.result}` : "";
      if (message.trim().length === 0) {
        return;
      }
      printLog("success", `RESULT | ${message}`, { label: "RESULT", message });
    });

    emitter.on("step:error", (event) => {
      printLog("error", `${event.step.title} failed`);
    });

    emitter.on("run:complete", () => {
      if (options.isTTY) {
        update.done();
      }
      stopAnimation();
    });
  }

  return { attach, pause, resume };
}
