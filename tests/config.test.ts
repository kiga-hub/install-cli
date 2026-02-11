import { describe, it, expect } from "vitest";
import { parseConfig, defaultTheme } from "../src/config.js";

const baseConfig = {
  steps: [{ id: "prepare", title: "Preparing", durationMs: 500 }]
};

describe("config", () => {
  it("fills theme defaults", () => {
    const config = parseConfig(baseConfig);
    expect(config.theme.accent).toBe(defaultTheme.accent);
  });

  it("ignores mutations to exported theme defaults", () => {
    const originalBrand = defaultTheme.brand[0];
    const originalSpinner = defaultTheme.spinner;

    try {
      try {
        defaultTheme.brand[0] = "#FFFFFF";
      } catch {
        // ignore if defaults are frozen
      }

      try {
        defaultTheme.spinner = "line";
      } catch {
        // ignore if defaults are frozen
      }

      const config = parseConfig(baseConfig);
      expect(config.theme.brand[0]).toBe("#00C2FF");
      expect(config.theme.spinner).toBe("dots");
    } finally {
      try {
        defaultTheme.brand[0] = originalBrand;
        defaultTheme.spinner = originalSpinner;
      } catch {
        // ignore if defaults are frozen
      }
    }
  });

  it("does not share theme defaults between parses", () => {
    const first = parseConfig(baseConfig);
    const second = parseConfig(baseConfig);
    first.theme.brand[0] = "#FFFFFF";
    first.theme.spinner = "line";
    expect(second.theme.brand[0]).toBe(defaultTheme.brand[0]);
    expect(second.theme.spinner).toBe(defaultTheme.spinner);
  });

  it("defaults weight to 1", () => {
    const config = parseConfig(baseConfig);
    expect(config.steps[0].weight).toBe(1);
  });

  it("rejects missing title", () => {
    expect(() => parseConfig({ steps: [{ id: "x" }] })).toThrow(/title/i);
  });
});

describe("config ui", () => {
  it("applies ui defaults", () => {
    const config = parseConfig({ steps: [{ id: "x", title: "X" }] });
    expect(config.ui.unicode).toBe(true);
    expect(Array.isArray(config.ui.spinnerFrames)).toBe(true);
  });

  it("normalizes string logs to objects", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", logs: ["Hello"] }]
    });
    expect(config.steps[0].logs?.[0]).toEqual({ level: "info", message: "Hello" });
  });

  it("rejects empty string log messages", () => {
    expect(() =>
      parseConfig({
        steps: [{ id: "x", title: "X", logs: [""] }]
      })
    ).toThrow(/message/i);
  });

  it("rejects empty log object messages", () => {
    expect(() =>
      parseConfig({
        steps: [{ id: "x", title: "X", logs: [{ level: "info", message: "" }] }]
      })
    ).toThrow(/message/i);
  });

  it("accepts result strings", () => {
    const config = parseConfig({
      steps: [{ id: "x", title: "X", result: "Done" }]
    });
    expect(config.steps[0].result).toBe("Done");
  });

  it("does not share ui defaults between parses", () => {
    const first = parseConfig({ steps: [{ id: "x", title: "X" }] });
    const second = parseConfig({ steps: [{ id: "y", title: "Y" }] });
    first.ui.spinnerFrames.push("*");
    first.ui.barChars.full = "#";
    first.ui.separators.unicode = " / ";
    first.ui.animation.tickMs = 120;
    expect(second.ui.spinnerFrames).toEqual(["⟡", "⟢", "⟣", "⟤"]);
    expect(second.ui.barChars.full).toBe("█");
    expect(second.ui.separators.unicode).toBe(" • ");
    expect(second.ui.animation.tickMs).toBe(90);
  });
});
