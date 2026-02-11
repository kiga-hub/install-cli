import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  const entry = path.resolve(projectRoot, "src/index.ts");
  return spawnSync("node", ["--import", "tsx", entry, ...args], {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: "0", ...env },
    encoding: "utf8"
  });
}

describe("cli", () => {
  it("prints plan on dry run", () => {
    const result = runCli(["install", "--dry-run", "--config", "config/steps.json"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run");
    expect(result.stdout).toContain("Preparing");
  });

  it("runs install in auto mode", () => {
    const result = runCli([
      "install",
      "--auto",
      "--config",
      "config/steps.json",
      "--speed",
      "20"
    ]);

    expect(result.status).toBe(0);
  });

  it("runs install with mocked prompt choice", () => {
    const result = runCli(
      ["install", "--config", "config/steps.json", "--speed", "20"],
      { CLI_PROMPT_CHOICE: "next" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("completed");
  });

  it("rejects zero speed", () => {
    const result = runCli([
      "install",
      "--config",
      "config/steps.json",
      "--speed",
      "0"
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("speed");
  });
});
