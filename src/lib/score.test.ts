import { describe, it, expect } from "vitest";
import {
  formatScore,
  parseLabel,
  getBaseVariants,
  computeScoreDistribution,
  SCORE_LABELS,
} from "../lib/score";

describe("formatScore", () => {
  it("handles null/undefined", () => {
    expect(formatScore(null)).toBe("--");
    expect(formatScore(undefined)).toBe("--");
  });

  it("maps 2.8 → 3-", () => {
    expect(formatScore(2.8)).toBe("3-");
  });

  it("maps 2.5 → 2+", () => {
    expect(formatScore(2.5)).toBe("2+");
  });

  it("maps 1.0 → 1", () => {
    expect(formatScore(1.0)).toBe("1");
  });

  it("maps 1.3 → 1+", () => {
    expect(formatScore(1.3)).toBe("1+");
  });

  it("maps 1.7 → 2-", () => {
    expect(formatScore(1.7)).toBe("2-");
  });

  it("maps 3.0 → 3", () => {
    expect(formatScore(3.0)).toBe("3");
  });

  it("maps 3.3 → 3+", () => {
    expect(formatScore(3.3)).toBe("3+");
  });

  it("maps 3.7 → 4-", () => {
    expect(formatScore(3.7)).toBe("4-");
  });

  it("maps 4.0 → 4", () => {
    expect(formatScore(4.0)).toBe("4");
  });

  it("maps 4.3 → 4+", () => {
    expect(formatScore(4.3)).toBe("4+");
  });

  it("maps 4.7 → 5-", () => {
    expect(formatScore(4.7)).toBe("5-");
  });

  it("maps 5.0 → 5", () => {
    expect(formatScore(5.0)).toBe("5");
  });

  it("maps above 5 to 5", () => {
    expect(formatScore(10)).toBe("5");
  });

  it("maps below 1 to 1", () => {
    expect(formatScore(0.5)).toBe("1");
  });
});

describe("parseLabel", () => {
  it("maps -- to 0", () => {
    expect(parseLabel("--")).toBe(0);
  });

  it("maps 3- to 2.666", () => {
    expect(parseLabel("3-")).toBeCloseTo(2.666, 2);
  });

  it("maps 3 to 3.0", () => {
    expect(parseLabel("3")).toBe(3.0);
  });

  it("maps 3+ to 3.333", () => {
    expect(parseLabel("3+")).toBeCloseTo(3.333, 2);
  });

  it("maps 5 to 5.0", () => {
    expect(parseLabel("5")).toBe(5.0);
  });

  it("maps 1 to 1.0", () => {
    expect(parseLabel("1")).toBe(1.0);
  });

  it("round-trips: formatScore(parseLabel(X)) == X", () => {
    for (const label of SCORE_LABELS) {
      expect(formatScore(parseLabel(label))).toBe(label);
    }
  });
});

describe("getBaseVariants", () => {
  it("returns correct cycle order for 3: [3, 3+, 3-]", () => {
    const v = getBaseVariants(3);
    expect(v).toEqual(["3", "3+", "3-"]);
  });

  it("returns cycle order for 2: [2, 2+, 2-]", () => {
    const v = getBaseVariants(2);
    expect(v).toEqual(["2", "2+", "2-"]);
  });

  it("handles edge case 1: [1, 1+]", () => {
    const v = getBaseVariants(1);
    expect(v).toEqual(["1", "1+"]);
  });

  it("handles edge case 5: [5, 5-]", () => {
    const v = getBaseVariants(5);
    expect(v).toEqual(["5", "5-"]);
  });
});

describe("computeScoreDistribution", () => {
  it("groups scores into 5 buckets", () => {
    const scores = [1.0, 2.5, 2.8, 3.0, 3.7, 4.9, 5.0];
    const dist = computeScoreDistribution(scores);
    // 1.0 → 1, 2.5→2+, 2.8→3-, 3.0→3, 3.7→4-, 4.9→5-, 5.0→5
    expect(dist.find((d) => d.base === 1)?.count).toBe(1);
    expect(dist.find((d) => d.base === 2)?.count).toBe(1); // 2+
    expect(dist.find((d) => d.base === 3)?.count).toBe(2); // 3- + 3
    expect(dist.find((d) => d.base === 4)?.count).toBe(1); // 4-
    expect(dist.find((d) => d.base === 5)?.count).toBe(2); // 5- + 5
  });

  it("returns all 5 base keys", () => {
    expect(computeScoreDistribution([]).map((d) => d.base)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });
});
