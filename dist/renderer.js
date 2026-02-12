import chalk from "chalk";
import gradient from "gradient-string";
import { formatDuration } from "./utils/time.js";
const BAR_WIDTH = 22;
const SPINNER_FRAMES = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧"
];
export function renderProgressLine(state, theme, options) {
    const safePercent = Number.isFinite(state.percent) ? state.percent : 0;
    const clampedPercent = Math.max(0, Math.min(100, safePercent));
    const percentLabelValue = Math.round(clampedPercent);
    const completeLength = Math.floor((percentLabelValue / 100) * BAR_WIDTH);
    const useUnicode = options.ui.unicode;
    const completeChar = useUnicode ? options.ui.barChars.full : "=";
    const incompleteChar = useUnicode ? options.ui.barChars.empty : "-";
    const complete = completeChar.repeat(completeLength);
    const incomplete = incompleteChar.repeat(BAR_WIDTH - completeLength);
    const bar = `[${complete}${incomplete}]`;
    const percentLabel = `${percentLabelValue}%`;
    const stepLabel = `Step ${state.stepIndex + 1}/${state.totalSteps}`;
    const titleLabel = state.stepTitle;
    const timer = formatDuration(state.elapsedMs);
    const separator = useUnicode ? options.ui.separators.unicode : options.ui.separators.ascii;
    if (options.noColor) {
        return `${options.brandLabel} ${bar} ${percentLabel}${separator}${stepLabel}${separator}${titleLabel} ${timer}`;
    }
    const coloredBar = `[${chalk.hex(theme.barComplete)(complete)}${chalk.hex(theme.barIncomplete)(incomplete)}]`;
    const coloredPercent = chalk.hex(theme.accent)(percentLabel);
    const coloredStep = chalk.hex(theme.accent)(stepLabel);
    const coloredTitle = chalk.white(titleLabel);
    const coloredTimer = chalk.gray.dim(timer);
    return `${options.brandLabel} ${coloredBar} ${coloredPercent}${separator}${coloredStep}${separator}${coloredTitle} ${coloredTimer}`;
}
export function createRenderer(config, options) {
    const useUnicode = config.ui.unicode;
    const brandText = config.ui.brandLabel;
    const brandLabel = options.noColor
        ? brandText
        : gradient(...config.theme.brand).multiline(brandText);
    const separators = useUnicode ? config.ui.separators.unicode : config.ui.separators.ascii;
    let spinner = null;
    let progressInterval = null;
    let currentFrameIndex = 0;
    let isRunning = false;
    let state = {
        percent: 0,
        stepTitle: "Starting",
        stepIndex: 0,
        totalSteps: config.steps.length,
        completedWeight: 0,
        totalWeight: config.steps.reduce((sum, step) => sum + step.weight, 0),
        startTime: Date.now(),
        stepStatus: new Array(config.steps.length).fill("pending")
    };
    function renderProgressToStdout() {
        if (!isRunning)
            return;
        const elapsedMs = Date.now() - state.startTime;
        const line = renderProgressLine({
            percent: state.percent,
            stepTitle: state.stepTitle,
            stepIndex: state.stepIndex,
            totalSteps: state.totalSteps,
            elapsedMs
        }, config.theme, { noColor: options.noColor, brandLabel, ui: config.ui });
        const frame = SPINNER_FRAMES[currentFrameIndex % SPINNER_FRAMES.length];
        if (options.isTTY) {
            process.stdout.write(`\r${frame} ${line}`);
        }
        else {
            console.log(`${frame} ${line}`);
        }
    }
    function startSpinner() {
        if (isRunning)
            return;
        isRunning = true;
        currentFrameIndex = 0;
        progressInterval = setInterval(() => {
            currentFrameIndex++;
            renderProgressToStdout();
        }, config.ui.animation.tickMs);
        if (!options.isTTY) {
            console.log("");
        }
        renderProgressToStdout();
    }
    function updateSpinner() {
        if (!isRunning)
            return;
        renderProgressToStdout();
    }
    function clearProgressLine() {
        if (options.isTTY && isRunning) {
            process.stdout.write("\r" + " ".repeat(process.stdout.columns || 100) + "\r");
        }
    }
    function stopSpinner() {
        isRunning = false;
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        clearProgressLine();
    }
    function pause() {
        isRunning = false;
    }
    function resume() {
        isRunning = true;
        currentFrameIndex = 0;
        renderProgressToStdout();
        progressInterval = setInterval(() => {
            currentFrameIndex++;
            renderProgressToStdout();
        }, config.ui.animation.tickMs);
    }
    function printLog(level, message, status) {
        const getIcon = () => {
            if (options.noColor) {
                return level === "success" ? "[+]" : level === "warn" ? "[!]" : level === "error" ? "[x]" : "[i]";
            }
            const color = level === "success" ? config.theme.success
                : level === "warn" ? config.theme.warn
                    : level === "error" ? config.theme.error
                        : config.theme.accent;
            const symbol = useUnicode
                ? (level === "success" ? "✓" : level === "warn" ? "⚠" : level === "error" ? "✖" : "ℹ")
                : (level === "success" ? "+" : level === "warn" ? "!" : level === "error" ? "x" : "i");
            return chalk.hex(color)(symbol);
        };
        const icon = getIcon();
        if (options.noColor) {
            if (options.isTTY && isRunning) {
                clearProgressLine();
                console.log(`${icon} ${message}`);
                updateSpinner();
            }
            else {
                console.log(`${icon} ${message}`);
            }
            return;
        }
        const messageColor = level === "success" ? chalk.white(message)
            : level === "warn" ? chalk.yellow(message)
                : level === "error" ? chalk.red(message)
                    : chalk.cyan(message);
        if (options.isTTY && isRunning) {
            clearProgressLine();
            console.log(`${icon} ${messageColor}`);
            updateSpinner();
        }
        else {
            console.log(`${icon} ${messageColor}`);
        }
    }
    function attach(emitter) {
        emitter.on("step:start", (event) => {
            state.stepTitle = event.step.title;
            state.stepIndex = event.index;
            state.completedWeight = event.completedWeight;
            state.totalWeight = event.totalWeight;
            state.percent = 0;
            state.startTime = Date.now();
            if (isRunning) {
                stopSpinner();
            }
            startSpinner();
        });
        emitter.on("step:progress", (event) => {
            if (!isRunning)
                return;
            state.stepTitle = event.step.title;
            state.stepIndex = event.index;
            state.completedWeight = event.completedWeight;
            state.totalWeight = event.totalWeight;
            state.percent = event.percent;
            updateSpinner();
        });
        emitter.on("step:log", (event) => {
            printLog(event.level, event.message);
        });
        emitter.on("step:result", (event) => {
            if (options.isTTY && isRunning) {
                clearProgressLine();
            }
            if (options.noColor) {
                console.log(`  → ${event.result}`);
            }
            else {
                console.log(chalk.hex(config.theme.success).dim(`  → ${event.result}`));
            }
            if (options.isTTY && isRunning) {
                updateSpinner();
            }
        });
        emitter.on("step:success", (event) => {
            if (isRunning) {
                stopSpinner();
            }
            state.stepStatus[event.index] = "success";
            printLog("success", `${event.step.title} completed`);
        });
        emitter.on("step:error", (event) => {
            state.stepStatus[event.index] = "error";
            printLog("error", `${event.step.title} failed`);
        });
        function renderStepTimeline() {
            const totalMs = Date.now() - state.startTime;
            const hasErrors = state.stepStatus.some(s => s === "error");
            const successCount = state.stepStatus.filter(s => s === "success").length;
            if (options.noColor) {
                console.log("\n-- Installation Complete --\n");
                state.stepStatus.forEach((s, i) => {
                    const name = config.steps[i].title;
                    const status = s === "success" ? "[OK]" : s === "error" ? "[FAIL]" : "[..]";
                    console.log(`  ${status}  ${name}`);
                });
                console.log(`\n  ${successCount}/${state.totalSteps} steps  -  ${Math.round(totalMs / 1000)}s\n`);
                return;
            }
            console.log(`\n${chalk.hex(config.theme.brand[0])(chalk.bold("━".repeat(50)))}`);
            console.log(chalk.cyan("  ") + chalk.bold.white("Installation Complete") + chalk.cyan("  "));
            console.log(chalk.hex(config.theme.brand[0])(chalk.bold("━".repeat(50))));
            const maxNameLen = Math.max(...config.steps.map(step => step.title.length));
            const stepLines = state.stepStatus.map((s, i) => {
                const name = config.steps[i].title;
                const paddedName = name.padEnd(maxNameLen, " ");
                if (s === "success") {
                    return chalk.cyan("  ✓") + "  " + chalk.gray(paddedName);
                }
                if (s === "error") {
                    return chalk.red("  ✗") + "  " + chalk.red(paddedName);
                }
                return chalk.dim("  ○") + "  " + chalk.dim(paddedName);
            });
            console.log("");
            stepLines.forEach(line => console.log(line));
            console.log("");
            console.log(chalk.gray("  ┌") + "─".repeat(40) + chalk.gray("┐"));
            const statsLine = chalk.white(`  │  ${successCount}/${state.totalSteps} steps  •  ${Math.round(totalMs / 1000)}s`);
            console.log(statsLine + " ".repeat(40 - (statsLine.length - 4)) + chalk.gray("│"));
            console.log(chalk.gray("  └") + "─".repeat(40) + chalk.gray("┘"));
            console.log("");
        }
        function renderSuccessAnimation(callback) {
            if (options.noColor) {
                callback();
                return;
            }
            const isPiped = !process.stdout.isTTY;
            if (isPiped) {
                callback();
                return;
            }
            let frameIndex = 0;
            const totalFrames = 16;
            let lastOutput = "";
            const frames = ["▓░░░░░░░░░░░░░░░", "▓▓░░░░░░░░░░░░░░", "▓▓▓░░░░░░░░░░░░░", "▓▓▓▓░░░░░░░░░░░░", "▓▓▓▓▓░░░░░░░░░░", "▓▓▓▓▓▓░░░░░░░░░", "▓▓▓▓▓▓▓░░░░░░░░", "▓▓▓▓▓▓▓▓░░░░░░░", "▓▓▓▓▓▓▓▓▓░░░░░░", "▓▓▓▓▓▓▓▓▓▓░░░░░", "▓▓▓▓▓▓▓▓▓▓▓░░░░", "▓▓▓▓▓▓▓▓▓▓▓▓░░░", "▓▓▓▓▓▓▓▓▓▓▓▓▓░░", "▓▓▓▓▓▓▓▓▓▓▓▓▓▓░", "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓"];
            const animate = () => {
                const bar = frames[frameIndex];
                const line = `\r  ${chalk.green("✓")} ${chalk.white(bar)} ${Math.round((frameIndex / totalFrames) * 100)}%`;
                if (lastOutput) {
                    process.stdout.write(`\r${" ".repeat(lastOutput.length)}\r`);
                }
                process.stdout.write(line);
                lastOutput = line;
                frameIndex++;
                if (frameIndex <= totalFrames) {
                    setTimeout(animate, 25);
                }
                else {
                    process.stdout.write(`\r${" ".repeat(lastOutput.length)}\r`);
                    process.stdout.write("\n");
                    setTimeout(callback, 100);
                }
            };
            animate();
        }
        emitter.on("run:complete", () => {
            if (spinner) {
                spinner.stop();
                spinner = null;
            }
            renderSuccessAnimation(() => {
                renderStepTimeline();
            });
        });
    }
    return { attach, pause, resume };
}
