declare module "terminal-kit" {
  type TerminalHandler = (...args: unknown[]) => void;
  type TerminalKeyHandler = (name: string, ...args: unknown[]) => void;
  type TerminalMouseHandler = (name: string, data: { x: number; y: number }) => void;
  type TerminalResizeHandler = () => void;

  interface Terminal {
    width: number;
    height: number;
    grabInput: (options?: { mouse?: boolean | "button" | "drag" | "motion"; focus?: boolean } | false) => void;
    hideCursor: (show?: boolean) => void;
    showCursor: () => void;
    saveCursor: () => void;
    restoreCursor: () => void;
    moveTo: (x: number, y: number) => void;
    eraseLine: () => void;
    eraseArea: (x: number, y: number, width: number, height: number) => void;
    styleReset: () => void;
    bgGray: () => void;
    gray: () => void;
    brightCyan: () => void;
    cyan: () => void;
    white: () => void;
    bold: () => void;
    noFormat: (text: string) => void;
    on(event: "key", handler: TerminalKeyHandler): void;
    on(event: "mouse", handler: TerminalMouseHandler): void;
    on(event: "resize", handler: TerminalResizeHandler): void;
    on(event: string, handler: TerminalHandler): void;
    off(event: "key", handler: TerminalKeyHandler): void;
    off(event: "mouse", handler: TerminalMouseHandler): void;
    off(event: "resize", handler: TerminalResizeHandler): void;
    off(event: string, handler: TerminalHandler): void;
  }

  const terminal: Terminal;

  const terminalKit: { terminal: Terminal };

  export default terminalKit;
}
