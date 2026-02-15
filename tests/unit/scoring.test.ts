import { describe, expect, it } from "vitest";
import { biasLabelFromScore, computePortfolioBias, normalizeWeights } from "@/lib/scoring";

describe("normalizeWeights", () => {
  it("uses equal weight when none are provided", () => {
    const result = normalizeWeights([
      { name: "A", sensitivity: "MED", exposureTags: [] },
      { name: "B", sensitivity: "MED", exposureTags: [] }
    ]);
    expect(result).toEqual([0.5, 0.5]);
  });

  it("normalizes explicit weights", () => {
    const result = normalizeWeights([
      { name: "A", weight: 0.3, sensitivity: "MED", exposureTags: [] },
      { name: "B", weight: 0.7, sensitivity: "MED", exposureTags: [] }
    ]);
    expect(result).toEqual([0.3, 0.7]);
  });

  it("throws on zero sum", () => {
    expect(() =>
      normalizeWeights([
        { name: "A", weight: 0, sensitivity: "MED", exposureTags: [] },
        { name: "B", weight: 0, sensitivity: "MED", exposureTags: [] }
      ])
    ).toThrow("sum to zero");
  });
});

describe("bias labels", () => {
  it("maps band thresholds", () => {
    expect(biasLabelFromScore(-0.6)).toBe("STRONG_NEG");
    expect(biasLabelFromScore(-0.21)).toBe("NEG");
    expect(biasLabelFromScore(0)).toBe("NEUTRAL");
    expect(biasLabelFromScore(0.2)).toBe("POS");
    expect(biasLabelFromScore(0.61)).toBe("STRONG_POS");
  });
});

describe("computePortfolioBias", () => {
  it("computes deterministic score", () => {
    const result = computePortfolioBias(
      {
        statement: "x".repeat(10),
        probability: 0.5,
        horizonMonths: 24,
        holdings: [{ name: "A", sensitivity: "HIGH", exposureTags: [] }]
      },
      {
        effectsByLayer: { first: [], second: [], third: [], fourth: [] },
        assetRecommendations: [],
        assumptions: [],
        leadingIndicators: [],
        holdingMappings: [
          {
            holdingName: "A",
            exposureType: "Compute",
            netImpact: "POS",
            mechanism: "Demand grows",
            confidence: "HIGH"
          }
        ]
      }
    );

    expect(result.portfolioBias).toBe(0.5);
    expect(result.biasLabel).toBe("POS");
  });
});
