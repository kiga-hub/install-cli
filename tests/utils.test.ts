import { describe, it, expect } from "vitest";
import { formatDuration } from "../src/utils/time.js";
import { computeOverallPercent } from "../src/utils/progress.js";

describe("utils", () => {
  it("formats mm:ss", () => {
    expect(formatDuration(61000)).toBe("01:01");
  });

  it("computes weighted percent", () => {
    expect(computeOverallPercent(10, 3, 2, 50)).toBe(40);
  });
});
