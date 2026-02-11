export type ThemeConfig = {
  brand: [string, string];
  accent: string;
  success: string;
  warn: string;
  error: string;
  barComplete: string;
  barIncomplete: string;
  spinner: string;
};

export type UiConfig = {
  unicode: boolean;
  brandLabel: string;
  spinnerFrames: string[];
  barChars: { full: string; empty: string; glow: string };
  separators: { unicode: string; ascii: string };
  animation: { tickMs: number; glowWidth: number };
};

export type StepLog = {
  level: "info" | "warn" | "error" | "success";
  message: string;
};

export type StepConfig = {
  id: string;
  title: string;
  weight: number;
  durationMs?: number;
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
  logs?: StepLog[];
  result?: string;
};

export type InstallerConfig = {
  theme: ThemeConfig;
  ui: UiConfig;
  steps: StepConfig[];
};

export type RunnerOptions = {
  speed: number;
  continueOnError: boolean;
  verbose: boolean;
};

export type RendererOptions = {
  noColor: boolean;
  isTTY: boolean;
  verbose: boolean;
};
