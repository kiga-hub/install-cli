import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { InstallerConfig, ThemeConfig } from "./types.js";

export const defaultTheme: Readonly<ThemeConfig> = Object.freeze({
  brand: Object.freeze(["#00C2FF", "#00E6A8"]) as [string, string],
  accent: "#F6C177",
  success: "#2ED573",
  warn: "#FFA502",
  error: "#FF4757",
  barComplete: "#00E6A8",
  barIncomplete: "#2F3542",
  spinner: "dots"
});

const StepLogSchema = z.object({
  level: z.enum(["info", "warn", "error", "success"]),
  message: z.string().min(1)
});

const StepLogInputSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return { level: "info", message: value };
    }
    return value;
  },
  StepLogSchema
);

const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  weight: z.number().positive().default(1),
  durationMs: z.number().int().positive().optional(),
  command: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string()).optional(),
  logs: z.array(StepLogInputSchema).optional(),
  result: z.string().optional()
});

const ThemeSchema = z
  .object({
    brand: z
      .tuple([z.string(), z.string()])
      .default(() => [defaultTheme.brand[0], defaultTheme.brand[1]] as [string, string]),
    accent: z.string().default(() => defaultTheme.accent),
    success: z.string().default(() => defaultTheme.success),
    warn: z.string().default(() => defaultTheme.warn),
    error: z.string().default(() => defaultTheme.error),
    barComplete: z.string().default(() => defaultTheme.barComplete),
    barIncomplete: z.string().default(() => defaultTheme.barIncomplete),
    spinner: z.string().default(() => defaultTheme.spinner)
  })
  .default(() => ({
    brand: [defaultTheme.brand[0], defaultTheme.brand[1]] as [string, string],
    accent: defaultTheme.accent,
    success: defaultTheme.success,
    warn: defaultTheme.warn,
    error: defaultTheme.error,
    barComplete: defaultTheme.barComplete,
    barIncomplete: defaultTheme.barIncomplete,
    spinner: defaultTheme.spinner
  }));

const UiSchema = z
  .object({
    unicode: z.boolean().default(() => true),
    brandLabel: z.string().default(() => "OpenInstall"),
    spinnerFrames: z.array(z.string()).default(() => ["⟡", "⟢", "⟣", "⟤"]),
    barChars: z
    .object({
      full: z.string().default(() => "█"),
      empty: z.string().default(() => "░"),
      glow: z.string().default(() => "▓")
    })
    .default(() => ({ full: "█", empty: "░", glow: "▓" })),
  separators: z
    .object({
      unicode: z.string().default(() => " • "),
      ascii: z.string().default(() => " | ")
    })
    .default(() => ({ unicode: " • ", ascii: " | " })),
  animation: z
    .object({
      tickMs: z.number().int().positive().default(() => 90),
      glowWidth: z.number().int().positive().default(() => 4),
      frameTickMs: z.number().int().positive().default(() => 140)
    })
    .default(() => ({ tickMs: 90, glowWidth: 4, frameTickMs: 140 }))
  })
  .default(() => ({
    unicode: true,
    brandLabel: "OpenInstall",
    spinnerFrames: ["⟡", "⟢", "⟣", "⟤"],
    barChars: { full: "█", empty: "░", glow: "▓" },
    separators: { unicode: " • ", ascii: " | " },
    animation: { tickMs: 90, glowWidth: 4, frameTickMs: 140 }
  }));

const ConfigSchema = z.object({
  theme: ThemeSchema,
  ui: UiSchema,
  steps: z.array(StepSchema).min(1)
});

export type ParsedConfig = z.infer<typeof ConfigSchema>;

export function parseConfig(input: unknown): InstallerConfig {
  return ConfigSchema.parse(input);
}

export async function loadConfigFromFile(
  filePath: string
): Promise<InstallerConfig> {
  const raw = await readFile(filePath, "utf8");
  return parseConfig(JSON.parse(raw));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConfigPath(cliPath?: string): Promise<string> {
  if (cliPath) {
    return path.resolve(cliPath);
  }

  const candidates = [
    path.resolve("installer.config.json"),
    path.resolve("config/steps.json")
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error("No config file found. Use --config <path>.");
}
