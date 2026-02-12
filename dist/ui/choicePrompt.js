import terminalKit from "terminal-kit";
import chalk from "chalk";
const terminal = terminalKit.terminal;
const buttons = [
    { id: "back", label: " Back " },
    { id: "auto", label: " Auto " },
    { id: "next", label: " Next " }
];
const fullLabels = ["Back", "Auto", "Next"];
const shortLabels = ["Bk", "Au", "Nx"];
const buildVariant = (row, options) => {
    const prefixText = options.prefix ? "Continue: " : "";
    const labels = options.short ? shortLabels : fullLabels;
    const pillText = labels.map((label) => options.padded ? `[ ${label} ]` : `[${label}]`);
    const gapText = " ".repeat(options.gap);
    const line = prefixText + pillText.join(gapText);
    let x = 1 + prefixText.length;
    const pills = pillText.map((text, index) => {
        const left = x;
        const right = x + text.length - 1;
        x = right + 1 + (index === pillText.length - 1 ? 0 : options.gap);
        return { id: buttons[index].id, left, right, text };
    });
    return { row, line, pills };
};
export const computeInlineLayout = (cols, rows) => {
    const safeCols = Number.isFinite(cols) && cols > 0 ? cols : 80;
    const safeRows = Number.isFinite(rows) && rows > 0 ? rows : 24;
    const row = Math.max(1, safeRows - 1);
    const variants = [
        { prefix: true, short: false, gap: 2, padded: true },
        { prefix: false, short: false, gap: 2, padded: true },
        { prefix: true, short: true, gap: 1, padded: false },
        { prefix: false, short: true, gap: 1, padded: false }
    ];
    for (const variant of variants) {
        const layout = buildVariant(row, variant);
        if (layout.line.length <= safeCols) {
            return layout;
        }
    }
    return buildVariant(row, { prefix: false, short: true, gap: 1, padded: false });
};
const RESET = "\x1b[0m";
const SOFT_YELLOW = "\x1b[38;5;223m";
const rainbowColors = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#8b00ff"];
const colorize = (text, index, hoverIndex, noColor) => {
    if (noColor) {
        return text;
    }
    if (index === hoverIndex && hoverIndex >= 0) {
        const chars = text.split("");
        const colored = chars.map((char, i) => {
            if (char === " ")
                return " ";
            const colorIndex = Math.floor((i / chars.length) * rainbowColors.length) % rainbowColors.length;
            return chalk.hex(rainbowColors[colorIndex])(char);
        }).join("");
        return colored;
    }
    return `${SOFT_YELLOW}${text}${RESET}`;
};
const hitTest = (layouts, x, y, row) => y === row
    ? layouts.find((layout) => x >= layout.left && x <= layout.left + layout.width - 1)
    : undefined;
export function createChoicePrompt({ title }, noColor = false) {
    let resolveChoice = null;
    let rejectChoice = null;
    let active = false;
    let focusedIndex = 0;
    let hoverIndex = -1;
    let isMouseOverButtons = false;
    let layouts = [];
    let pulseInterval = null;
    let flickerInterval = null;
    let isHovering = false;
    let hasFocus = false;
    let lastRow = null;
    const cleanup = () => {
        if (pulseInterval) {
            clearInterval(pulseInterval);
            pulseInterval = null;
        }
        if (flickerInterval) {
            clearInterval(flickerInterval);
            flickerInterval = null;
        }
        isHovering = false;
        hasFocus = false;
        hoverIndex = -1;
        isMouseOverButtons = false;
        if (lastRow !== null) {
            terminal.saveCursor();
            terminal.moveTo(1, lastRow);
            terminal.eraseLine();
            terminal.moveTo(1, lastRow + 1);
            terminal.eraseLine();
            terminal.restoreCursor();
        }
        terminal.grabInput(false);
        terminal.hideCursor(false);
        active = false;
        lastRow = null;
    };
    const startTimers = () => {
        if (!active || pulseInterval || flickerInterval) {
            return;
        }
        pulseInterval = setInterval(() => {
            if (active) {
                render();
            }
        }, 550);
        flickerInterval = setInterval(() => {
            if (active) {
                render();
            }
        }, 1250);
    };
    const stopTimers = () => {
        if (pulseInterval) {
            clearInterval(pulseInterval);
            pulseInterval = null;
        }
        if (flickerInterval) {
            clearInterval(flickerInterval);
            flickerInterval = null;
        }
    };
    const updateTimerState = () => {
        if (active && (isHovering || hasFocus)) {
            startTimers();
            return;
        }
        stopTimers();
    };
    const render = () => {
        const cols = terminal.width;
        const rows = terminal.height;
        if (!Number.isFinite(cols) || cols <= 0 || !Number.isFinite(rows) || rows <= 0) {
            return;
        }
        const layout = computeInlineLayout(cols, rows);
        layouts = layout.pills.map((pill) => ({
            id: pill.id,
            left: pill.left,
            width: pill.right - pill.left + 1
        }));
        lastRow = layout.row;
        terminal.saveCursor();
        terminal.moveTo(1, layout.row);
        terminal.eraseLine();
        terminal.gray();
        let cursor = 1;
        layout.pills.forEach((pill, index) => {
            const prefixLength = Math.max(0, pill.left - cursor);
            if (prefixLength > 0) {
                terminal.noFormat(layout.line.slice(cursor - 1, cursor - 1 + prefixLength));
                cursor += prefixLength;
            }
            const coloredText = colorize(pill.text, index, hoverIndex, noColor);
            terminal.noFormat(coloredText);
            cursor += pill.text.length;
            terminal.gray();
        });
        if (cursor <= layout.line.length) {
            terminal.noFormat(layout.line.slice(cursor - 1));
        }
        terminal.restoreCursor();
        terminal.saveCursor();
        terminal.moveTo(1, layout.row + 1);
        terminal.eraseLine();
        if (!noColor) {
            terminal.noFormat("\x1b[90m");
        }
        terminal.noFormat("  Use TAB / Arrow keys to navigate, ENTER to select  ");
        terminal.restoreCursor();
    };
    const resolveAndCleanup = (choice) => {
        if (!active) {
            return;
        }
        active = false;
        cleanup();
        resolveChoice?.(choice);
    };
    const onMouse = (name, data) => {
        if (!active) {
            return;
        }
        const isButtonPress = name === "MOUSE_LEFT_BUTTON_PRESSED" || name === "MOUSE_LEFT_BUTTON_RELEASED";
        if (!isButtonPress) {
            const targetRow = lastRow ?? terminal.height;
            const hovered = hitTest(layouts, data.x, data.y, targetRow);
            if (hovered) {
                const index = layouts.findIndex((item) => item.id === hovered.id);
                if (index >= 0 && hoverIndex !== index) {
                    hoverIndex = index;
                    isMouseOverButtons = true;
                    render();
                }
                if (!isMouseOverButtons) {
                    isMouseOverButtons = true;
                }
            }
            else {
                if (isMouseOverButtons) {
                    isMouseOverButtons = false;
                }
                if (hoverIndex !== -1) {
                    hoverIndex = -1;
                    render();
                }
            }
            return;
        }
        const layout = hitTest(layouts, data.x, data.y, lastRow ?? terminal.height);
        if (!layout) {
            return;
        }
        const index = layouts.findIndex((item) => item.id === layout.id);
        if (index >= 0) {
            focusedIndex = index;
            hoverIndex = -1;
            isMouseOverButtons = false;
            resolveAndCleanup(layout.id);
        }
    };
    const onResize = () => {
        if (!active) {
            return;
        }
        render();
    };
    const open = () => new Promise((resolve, reject) => {
        // Check if we're in a TTY environment
        const isInTTY = process.stdin.isTTY && process.stdout.isTTY;
        if (!isInTTY) {
            // In non-TTY environment, automatically continue with "auto"
            resolve("auto");
            return;
        }
        resolveChoice = resolve;
        rejectChoice = reject;
        active = true;
        terminal.hideCursor();
        terminal.grabInput({ mouse: "motion" });
        const keyHandler = (name) => {
            if (!active)
                return;
            if (name === "TAB") {
                focusedIndex = (focusedIndex + 1) % buttons.length;
                hoverIndex = focusedIndex;
                isMouseOverButtons = false;
                render();
                return;
            }
            if (name === "SHIFT_TAB") {
                focusedIndex = (focusedIndex - 1 + buttons.length) % buttons.length;
                hoverIndex = focusedIndex;
                isMouseOverButtons = false;
                render();
                return;
            }
            if (name === "LEFT" || name === "ArrowLeft") {
                focusedIndex = (focusedIndex - 1 + buttons.length) % buttons.length;
                hoverIndex = focusedIndex;
                isMouseOverButtons = false;
                render();
                return;
            }
            if (name === "RIGHT" || name === "ArrowRight") {
                focusedIndex = (focusedIndex + 1) % buttons.length;
                hoverIndex = focusedIndex;
                isMouseOverButtons = false;
                render();
                return;
            }
            if (name === "ENTER" || name === "RETURN") {
                resolveAndCleanup(buttons[focusedIndex].id);
                return;
            }
            if (name === "ESCAPE" || name === "q" || name === "Q") {
                resolveAndCleanup("back");
                return;
            }
            if (name === "CTRL_C") {
                active = false;
                cleanup();
                rejectChoice?.(new Error("choicePrompt cancelled"));
            }
        };
        terminal.on("key", keyHandler);
        terminal.on("mouse", onMouse);
        terminal.on("resize", onResize);
        render();
    }).finally(() => {
        terminal.off("key", () => { });
        terminal.off("mouse", onMouse);
        terminal.off("resize", onResize);
        cleanup();
    });
    const resolveWith = async (choice) => {
        resolveAndCleanup(choice);
        return choice;
    };
    return { open, resolveWith };
}
