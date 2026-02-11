import { describe, it, expect, vi, beforeEach } from "vitest";

const { terminalMock } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const terminal = Object.assign(vi.fn(), {
    width: 80,
    height: 24,
    grabInput: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (handlers.get(event) === handler) {
        handlers.delete(event);
      }
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (handlers.get(event) === handler) {
        handlers.delete(event);
      }
    }),
    hideCursor: vi.fn(),
    showCursor: vi.fn(),
    moveTo: vi.fn(),
    eraseLine: vi.fn(),
    eraseArea: vi.fn(),
    saveCursor: vi.fn(),
    restoreCursor: vi.fn(),
    styleReset: vi.fn(),
    bgGray: vi.fn(),
    gray: vi.fn(),
    brightCyan: vi.fn(),
    cyan: vi.fn(),
    white: vi.fn(),
    bold: vi.fn(),
    noFormat: vi.fn(),
    __handlers: handlers
  });

  return { terminalMock: terminal };
});

vi.mock("terminal-kit", () => ({
  default: { terminal: terminalMock }
}), { virtual: true });

import {
  createChoicePrompt,
  computeInlineLayout
} from "../src/ui/choicePrompt.js";

describe("choicePrompt", () => {
  const getButtonPoint = (id: "back" | "auto" | "next") => {
    const layout = computeInlineLayout(terminalMock.width, terminalMock.height);
    const target = layout.pills.find((pill) => pill.id === id) ?? layout.pills[0];
    const x = Math.floor((target.left + target.right) / 2);
    const y = layout.row;
    const maxRight = Math.max(...layout.pills.map((pill) => pill.right));
    return {
      x,
      y,
      outsideX: maxRight + 2,
      outsideY: y
    };
  };
  beforeEach(() => {
    terminalMock.width = 80;
    terminalMock.height = 24;
    terminalMock.mockReset();
    terminalMock.grabInput.mockReset();
    terminalMock.on.mockReset();
    terminalMock.off.mockReset();
    terminalMock.removeListener.mockReset();
    terminalMock.hideCursor.mockReset();
    terminalMock.showCursor.mockReset();
    terminalMock.moveTo.mockReset();
    terminalMock.eraseLine.mockReset();
    terminalMock.eraseArea.mockReset();
    terminalMock.saveCursor.mockReset();
    terminalMock.restoreCursor.mockReset();
    terminalMock.styleReset.mockReset();
    terminalMock.bgGray.mockReset();
    terminalMock.gray.mockReset();
    terminalMock.brightCyan.mockReset();
    terminalMock.cyan.mockReset();
    terminalMock.white.mockReset();
    terminalMock.bold.mockReset();
    terminalMock.noFormat.mockReset();
    terminalMock.__handlers.clear();
    terminalMock.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      terminalMock.__handlers.set(event, handler);
    });
    terminalMock.off.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (terminalMock.__handlers.get(event) === handler) {
        terminalMock.__handlers.delete(event);
      }
    });
    terminalMock.removeListener.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (terminalMock.__handlers.get(event) === handler) {
        terminalMock.__handlers.delete(event);
      }
    });
  });

  it("registers and removes terminal handlers on resolve", async () => {
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    expect(terminalMock.on).toHaveBeenCalledTimes(3);
    expect(terminalMock.on).toHaveBeenCalledWith("key", expect.any(Function));
    expect(terminalMock.on).toHaveBeenCalledWith("mouse", expect.any(Function));
    expect(terminalMock.on).toHaveBeenCalledWith("resize", expect.any(Function));

    await prompt.resolveWith("auto");
    await expect(openPromise).resolves.toBe("auto");

    expect(terminalMock.off).toHaveBeenCalledTimes(3);
    expect(terminalMock.off).toHaveBeenCalledWith("key", expect.any(Function));
    expect(terminalMock.off).toHaveBeenCalledWith("mouse", expect.any(Function));
    expect(terminalMock.off).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(terminalMock.__handlers.size).toBe(0);
  });

  it("restores the cursor on cleanup", async () => {
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();
    await prompt.resolveWith("auto");

    await expect(openPromise).resolves.toBe("auto");
    expect(terminalMock.hideCursor).toHaveBeenCalledWith(false);
  });

  it("clears the last row on cleanup when rendered on row one", async () => {
    terminalMock.height = 1;
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();
    const eraseCallsAfterOpen = terminalMock.eraseLine.mock.calls.length;

    await prompt.resolveWith("auto");

    await expect(openPromise).resolves.toBe("auto");
    expect(terminalMock.eraseLine.mock.calls.length).toBe(eraseCallsAfterOpen + 1);
  });

  it("resolves open when resolveWith is called", async () => {
    vi.useFakeTimers();
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();
    await prompt.resolveWith("auto");

    const resultPromise = Promise.race([
      openPromise,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 1))
    ]);

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("auto");

    vi.useRealTimers();
  });

  it("starts pulse and flicker intervals on hover and clears on mouseout", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    expect(setIntervalSpy).not.toHaveBeenCalled();

    const mouseHandler = terminalMock.__handlers.get("mouse") as (name: string, data: { x: number; y: number }) => void;
    const { x: hoverX, y: hoverY, outsideX, outsideY } = getButtonPoint("back");
    mouseHandler("MOUSE_MOTION", { x: hoverX, y: hoverY });

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    mouseHandler("MOUSE_MOTION", { x: outsideX, y: outsideY });

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);

    await prompt.resolveWith("auto");
    await expect(openPromise).resolves.toBe("auto");

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("starts timers on keyboard focus and stops when focus ends", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    expect(setIntervalSpy).not.toHaveBeenCalled();

    const keyHandler = terminalMock.__handlers.get("key") as (name: string) => void;
    keyHandler("TAB");

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    await prompt.resolveWith("auto");

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    await expect(openPromise).resolves.toBe("auto");

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("resolves when mouse release happens on a button", async () => {
    vi.useFakeTimers();
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    const mouseHandler = terminalMock.__handlers.get("mouse") as (name: string, data: { x: number; y: number }) => void;
    const { x: clickX, y: clickY } = getButtonPoint("back");
    mouseHandler("MOUSE_LEFT_BUTTON_RELEASED", { x: clickX, y: clickY });

    const resultPromise = Promise.race([
      openPromise,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 1))
    ]);

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("back");

    vi.useRealTimers();
  });

  it("renders only on the bottom row", () => {
    const prompt = createChoicePrompt({ title: "Step complete" });
    prompt.open();

    const rows = terminalMock.height;
    const moveCalls = terminalMock.moveTo.mock.calls;
    expect(moveCalls.length).toBeGreaterThan(0);
    expect(moveCalls.every(([, y]) => y === rows)).toBe(true);
    expect(terminalMock.eraseArea).not.toHaveBeenCalled();
  });

  it("stops timers when focus is cleared", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    const keyHandler = terminalMock.__handlers.get("key") as (name: string) => void;
    keyHandler("TAB");

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    keyHandler("BACKSPACE");

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);

    await prompt.resolveWith("auto");
    await expect(openPromise).resolves.toBe("auto");

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("keeps timers running when focus stays active after hover ends", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const prompt = createChoicePrompt({ title: "Pick a path" });

    const openPromise = prompt.open();

    expect(setIntervalSpy).not.toHaveBeenCalled();

    const keyHandler = terminalMock.__handlers.get("key") as (name: string) => void;
    keyHandler("TAB");

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    const mouseHandler = terminalMock.__handlers.get("mouse") as (name: string, data: { x: number; y: number }) => void;
    const { outsideX, outsideY } = getButtonPoint("back");
    mouseHandler("MOUSE_MOTION", { x: outsideX, y: outsideY });

    expect(clearIntervalSpy).not.toHaveBeenCalled();

    await prompt.resolveWith("auto");

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    await expect(openPromise).resolves.toBe("auto");

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("computes a full inline layout with prefix", () => {
    const layout = computeInlineLayout(80, 24);
    expect(layout.row).toBe(24);
    expect(layout.line).toBe("Continue: [ Back ]  [ Auto ]  [ Next ]");
    expect(layout.pills[0]).toMatchObject({ id: "back", left: 11, right: 18, text: "[ Back ]" });
    expect(layout.pills[1]).toMatchObject({ id: "auto", left: 21, right: 28, text: "[ Auto ]" });
    expect(layout.pills[2]).toMatchObject({ id: "next", left: 31, right: 38, text: "[ Next ]" });
  });

  it("drops prefix and abbreviates when narrow", () => {
    const layout = computeInlineLayout(20, 10);
    expect(layout.row).toBe(10);
    expect(layout.line).toBe("[Bk] [Au] [Nx]");
    expect(layout.pills[0]).toMatchObject({ id: "back", left: 1, right: 4, text: "[Bk]" });
    expect(layout.pills[1]).toMatchObject({ id: "auto", left: 6, right: 9, text: "[Au]" });
    expect(layout.pills[2]).toMatchObject({ id: "next", left: 11, right: 14, text: "[Nx]" });
  });
});
