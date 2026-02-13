import type { EventEmitter } from "node:events";
import type { ChoicePrompt } from "../ui/choicePrompt.js";
import type { InstallerConfig, RunnerOptions } from "../types.js";
import { runSingleStep } from "../runner.js";

type StepControllerOptions = {
  config: InstallerConfig;
  options: RunnerOptions;
  emitter: EventEmitter;
  prompt: Pick<ChoicePrompt, "open">;
  renderer?: { pause?: () => void; resume?: () => void };
};

export function createStepController({
  config,
  options,
  emitter,
  prompt,
  renderer
}: StepControllerOptions) {
  const pauseRenderer = renderer?.pause;
  const resumeRenderer = renderer?.resume;

  async function runAll(forceAutoMode = false) {
    emitter.emit("run:start", { total: config.steps.length });

    let index = 0;
    let autoMode = forceAutoMode;
    let stepFailed = false;
    while (index < config.steps.length) {
      stepFailed = false;
      try {
        await runSingleStep(config, options, emitter, index);
      } catch (error) {
        stepFailed = true;
        if (!options.continueOnError) {
          emitter.emit("run:error", { error });
          throw error;
        }
      }

      if (!autoMode) {
        pauseRenderer?.();
        const choice = await prompt.open();
        resumeRenderer?.();

        if (choice === "auto") {
          autoMode = true;
          index += 1;
          continue;
        }
        if (choice === "back") {
          index = Math.max(0, index - 1);
          continue;
        }
      }

      index += 1;
    }

    emitter.emit("run:complete", { total: config.steps.length });
  }

  return { runAll };
}
