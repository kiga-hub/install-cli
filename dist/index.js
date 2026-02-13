#!/usr/bin/env node
import { Command } from "commander";
import { EventEmitter } from "node:events";
import { loadConfigFromFile, resolveConfigPath } from "./config.js";
import { createStepController } from "./controller/stepController.js";
import { createRenderer } from "./renderer.js";
import { createChoicePrompt } from "./ui/choicePrompt.js";
import { isTTY } from "./utils/tty.js";
import { detectOS, getInstallCommand, getOSDisplayName, getPackageManager } from "./utils/os.js";
const program = new Command();
program
    .name("installer")
    .description("Installer-style CLI with progress bar and logs")
    .version("0.1.0");
program
    .command("install", { isDefault: true })
    .option("--config <path>", "path to config file")
    .option("--dry-run", "validate config and print plan")
    .option("--verbose", "print extra logs")
    .option("--no-color", "disable ANSI colors")
    .option("--continue-on-error", "continue after step failure")
    .option("--auto", "run without step prompts")
    .option("--speed <factor>", "speed factor for simulated steps", "1")
    .action(async (options) => {
    const speed = Number(options.speed ?? 1);
    if (!Number.isFinite(speed) || speed <= 0) {
        throw new Error("Invalid speed: must be a number greater than 0.");
    }
    const configPath = await resolveConfigPath(options.config);
    const config = await loadConfigFromFile(configPath);
    const detectedOS = detectOS();
    const osDisplayName = getOSDisplayName(detectedOS);
    const packageManager = getPackageManager(detectedOS);
    if (config.steps && config.steps.length > 0 && config.steps[0].id === "install-htop") {
        config.steps[0].command = getInstallCommand(detectedOS, "htop");
        config.steps[0].logs = [
            { level: "info", message: `Detected OS: ${osDisplayName}` },
            { level: "info", message: `Installing htop via ${packageManager}` }
        ];
    }
    if (options.dryRun) {
        printPlan(config);
        return;
    }
    const emitter = new EventEmitter();
    const renderer = createRenderer(config, {
        noColor: Boolean(options.noColor),
        isTTY: isTTY(),
        verbose: Boolean(options.verbose)
    });
    renderer.attach(emitter);
    const promptChoice = process.env.CLI_PROMPT_CHOICE;
    const prompt = promptChoice
        ? { open: async () => promptChoice }
        : createChoicePrompt({ title: "Step complete" }, Boolean(options.noColor));
    const controller = createStepController({
        config,
        options: {
            speed,
            continueOnError: Boolean(options.continueOnError),
            verbose: Boolean(options.verbose)
        },
        emitter,
        prompt,
        renderer
    });
    if (options.auto) {
        await controller.runAll(true);
        return;
    }
    await controller.runAll();
});
function printPlan(config) {
    if (!Array.isArray(config.steps) || config.steps.length === 0) {
        throw new Error("Invalid config: steps must be a non-empty array.");
    }
    console.log("Dry run: no steps executed.");
    console.log("Plan:");
    config.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.title} (weight ${step.weight})`);
    });
}
(async () => {
    await program.parseAsync(process.argv);
})().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
