import terminalKit from "terminal-kit";

type Choice = "next" | "auto" | "back";

type ChoicePrompt = {
  open: () => Promise<Choice>;
  resolveWith: (choice: Choice) => Promise<Choice>;
};

type ChoicePromptOptions = {
  title: string;
};

type Button = {
  id: Choice;
  label: string;
};

type ButtonLayout = {
  id: Choice;
  left: number;
  width: number;
};

const terminal = terminalKit.terminal;
const buttons: Button[] = [
  { id: "back", label: " Back " },
  { id: "auto", label: " Auto " },
  { id: "next", label: " Next " }
];

type InlineLayout = {
  row: number;
  line: string;
  pills: { id: Choice; left: number; right: number; text: string }[];
};

const fullLabels = ["Back", "Auto", "Next"] as const;
const shortLabels = ["Bk", "Au", "Nx"] as const;

const buildVariant = (
  row: number,
  options: { prefix: boolean; short: boolean; gap: number; padded: boolean }
): InlineLayout => {
  const prefixText = options.prefix ? "Continue: " : "";
  const labels = options.short ? shortLabels : fullLabels;
  const pillText = labels.map((label) =>
    options.padded ? `[ ${label} ]` : `[${label}]`
  );
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

export const computeInlineLayout = (cols: number, rows: number): InlineLayout => {
  const safeCols = Number.isFinite(cols) && cols > 0 ? cols : 80;
  const safeRows = Number.isFinite(rows) && rows > 0 ? rows : 24;
  const row = Math.max(1, safeRows);

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

const applyNeon = (focused: boolean) => {
  if (focused) {
    terminal.brightCyan();
    terminal.bold();
  } else {
    terminal.cyan();
  }
};

const hitTest = (layouts: ButtonLayout[], x: number, y: number, row: number) =>
  y === row
    ? layouts.find((layout) => x >= layout.left && x <= layout.left + layout.width - 1)
    : undefined;

export function createChoicePrompt({ title }: ChoicePromptOptions): ChoicePrompt {
  let resolveChoice: ((choice: Choice) => void) | null = null;
  let rejectChoice: ((error: Error) => void) | null = null;
  let active = false;
  let focusedIndex = 0;
  let layouts: ButtonLayout[] = [];
  let pulseInterval: ReturnType<typeof setInterval> | null = null;
  let flickerInterval: ReturnType<typeof setInterval> | null = null;
  let isHovering = false;
  let hasFocus = false;
  let lastRow: number | null = null;

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
    if (lastRow !== null) {
      terminal.saveCursor();
      terminal.moveTo(1, lastRow);
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

      applyNeon(index === focusedIndex);
      terminal.noFormat(pill.text);
      cursor += pill.text.length;

      terminal.gray();
    });

    if (cursor <= layout.line.length) {
      terminal.noFormat(layout.line.slice(cursor - 1));
    }

    terminal.restoreCursor();
  };

  const resolveAndCleanup = (choice: Choice) => {
    if (!active) {
      return;
    }
    active = false;
    cleanup();
    resolveChoice?.(choice);
  };

  const onKey = (name: string) => {
    if (!active) {
      return;
    }
    if (name === "TAB" || name === "RIGHT") {
      focusedIndex = (focusedIndex + 1) % buttons.length;
      render();
      hasFocus = true;
      updateTimerState();
      return;
    }
    if (name === "SHIFT_TAB" || name === "LEFT") {
      focusedIndex = (focusedIndex - 1 + buttons.length) % buttons.length;
      render();
      hasFocus = true;
      updateTimerState();
      return;
    }
    if (name === "ENTER") {
      resolveAndCleanup(buttons[focusedIndex].id);
      return;
    }
    if (name === "BACKSPACE") {
      if (hasFocus) {
        hasFocus = false;
        updateTimerState();
      }
      return;
    }
    if (name === "ESCAPE" || name === "Q") {
      resolveAndCleanup("back");
      return;
    }
    if (name === "CTRL_C") {
      active = false;
      cleanup();
      rejectChoice?.(new Error("choicePrompt cancelled"));
    }
  };

  const onMouse = (name: string, data: { x: number; y: number }) => {
    if (!active) {
      return;
    }
    if (name !== "MOUSE_LEFT_BUTTON_PRESSED" && name !== "MOUSE_LEFT_BUTTON_RELEASED") {
      if (name === "MOUSE_MOTION") {
        const hovered = hitTest(layouts, data.x, data.y, lastRow ?? terminal.height);
        if (hovered) {
          const index = layouts.findIndex((item) => item.id === hovered.id);
          if (index >= 0 && focusedIndex !== index) {
            focusedIndex = index;
            render();
          }
          if (!isHovering) {
            isHovering = true;
          }
          updateTimerState();
        } else {
          if (isHovering) {
            isHovering = false;
            updateTimerState();
          }
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
      resolveAndCleanup(layout.id);
    }
  };

  const onResize = () => {
    if (!active) {
      return;
    }
    render();
  };

  const open = () =>
    new Promise<Choice>((resolve, reject) => {
      resolveChoice = resolve;
      rejectChoice = reject;
      active = true;
      terminal.hideCursor();
      terminal.grabInput({ mouse: "motion" });
      terminal.on("key", onKey);
      terminal.on("mouse", onMouse);
      terminal.on("resize", onResize);
      render();
    }).finally(() => {
      terminal.off("key", onKey);
      terminal.off("mouse", onMouse);
      terminal.off("resize", onResize);
      cleanup();
    });

  const resolveWith = async (choice: Choice) => {
    resolveAndCleanup(choice);
    return choice;
  };

  return { open, resolveWith };
}

export type { Choice, ChoicePrompt, ChoicePromptOptions };
