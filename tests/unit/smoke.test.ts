import { describe, it, expect } from "vitest";
import { LEVELS, LEVEL_RANK, maxLevel, bumpLevel } from "@/engine/levels";

describe("Phase 0 Smoke Tests", () => {
  it("defines exact 3 triage levels", () => {
    expect(LEVELS).toEqual(["IMMEDIATE", "SOON", "ROUTINE"]);
  });

  it("ranks IMMEDIATE as 1, SOON as 2, ROUTINE as 3", () => {
    expect(LEVEL_RANK.IMMEDIATE).toBe(1);
    expect(LEVEL_RANK.SOON).toBe(2);
    expect(LEVEL_RANK.ROUTINE).toBe(3);
  });

  it("evaluates maxLevel with highest urgency winning (S-1 invariant)", () => {
    expect(maxLevel("ROUTINE", "SOON")).toBe("SOON");
    expect(maxLevel("SOON", "IMMEDIATE")).toBe("IMMEDIATE");
    expect(maxLevel("IMMEDIATE", "ROUTINE")).toBe("IMMEDIATE");
  });

  it("bumps level conservatively capped at IMMEDIATE", () => {
    expect(bumpLevel("ROUTINE")).toBe("SOON");
    expect(bumpLevel("SOON")).toBe("IMMEDIATE");
    expect(bumpLevel("IMMEDIATE")).toBe("IMMEDIATE");
  });
});
