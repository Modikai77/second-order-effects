import { describe, expect, it } from "vitest";
import {
  dedupeAssetRecommendations,
  dedupeEffects,
  dedupeHoldingMappings,
  enforceOutputChecks,
  extractAssetRecommendationsFromSnapshot,
  type AnalysisModelOutput
} from "@/lib/schemas";

const baseOutput: AnalysisModelOutput = {
  effectsByLayer: {
    first: [
      { description: "A", impactDirection: "POS", confidence: "MED" },
      { description: "B", impactDirection: "NEG", confidence: "LOW" }
    ],
    second: [
      { description: "C", impactDirection: "POS", confidence: "MED" },
      { description: "D", impactDirection: "NEG", confidence: "HIGH" }
    ],
    third: [],
    fourth: []
  },
  assumptions: [],
  leadingIndicators: [],
  assetRecommendations: [],
  holdingMappings: [
    {
      holdingName: "Infra Fund",
      exposureType: "Compute",
      netImpact: "POS",
      mechanism: "Capex",
      confidence: "MED"
    }
  ]
};

describe("schema post checks", () => {
  it("dedupes repeated effects", () => {
    const deduped = dedupeEffects({
      ...baseOutput,
      effectsByLayer: {
        ...baseOutput.effectsByLayer,
        first: [
          ...baseOutput.effectsByLayer.first,
          { description: "A!", impactDirection: "POS", confidence: "LOW" }
        ]
      }
    });
    expect(deduped.effectsByLayer.first).toHaveLength(2);
  });

  it("dedupes repeated asset recommendations", () => {
    const deduped = dedupeAssetRecommendations({
      ...baseOutput,
      assetRecommendations: [
        {
          assetName: "AI Software ETF",
          assetCategory: "ETF",
          sourceLayer: "SECOND",
          direction: "POS",
          action: "OVERWEIGHT",
          rationale: "Captures higher compute demand with specific exposure.",
          confidence: "HIGH",
          mechanism: "Demand reroutes toward software infra demand."
        },
        {
          assetName: "AI Software ETF",
          assetCategory: "ETF",
          sourceLayer: "SECOND",
          direction: "POS",
          action: "OVERWEIGHT",
          rationale: "Duplicate that should collapse via dedupe.",
          confidence: "MED",
          mechanism: "Duplicate."
        },
        {
          assetName: "Nvidia",
          assetCategory: "EQUITY",
          sourceLayer: "THIRD",
          direction: "NEG",
          action: "WATCH",
          rationale: "Third-order demand shift can compress margins.",
          confidence: "LOW",
          mechanism: "Margins may reset."
        }
      ]
    } as never);

    expect(deduped.assetRecommendations).toHaveLength(2);
  });

  it("enforces one mapping per holding", () => {
    const withRecommendation = {
      ...baseOutput,
      assetRecommendations: [
        {
          assetName: "Infra Fund",
          assetCategory: "ETF",
          sourceLayer: "SECOND",
          direction: "POS",
          action: "OVERWEIGHT",
          rationale: "Fallback recommendation.",
          confidence: "LOW",
          mechanism: "Needs recommendation to satisfy checks."
        }
      ]
    } as never;

    expect(() =>
      enforceOutputChecks(withRecommendation, [
        { name: "Infra Fund", sensitivity: "MED", exposureTags: [] },
        { name: "SaaS Fund", sensitivity: "MED", exposureTags: [] }
      ])
    ).toThrow("SaaS Fund");
  });

  it("enforces recommendation requirement when second-order exists", () => {
    expect(() =>
      enforceOutputChecks(
        {
          ...baseOutput,
          assetRecommendations: [],
          effectsByLayer: {
            ...baseOutput.effectsByLayer,
            second: [
              { description: "C", impactDirection: "POS", confidence: "MED" },
              { description: "D", impactDirection: "NEG", confidence: "LOW" }
            ]
          }
        } as never,
        [{ name: "Infra Fund", sensitivity: "MED", exposureTags: [] }]
      )
    ).toThrow("at least one asset recommendation");
  });

  it("dedupes holding mappings by name for duplicate holdings", () => {
    const output = dedupeHoldingMappings({
      ...baseOutput,
      holdingMappings: [
        ...baseOutput.holdingMappings,
        {
          holdingName: "Infra Fund",
          exposureType: "Compute",
          netImpact: "NEG",
          mechanism: "Duplicate",
          confidence: "LOW"
        }
      ]
    } as never);

    expect(output.holdingMappings).toHaveLength(1);
    expect(() =>
      enforceOutputChecks(
        {
          ...output,
          assetRecommendations: [
            {
              assetName: "Infra Fund",
              assetCategory: "ETF",
              sourceLayer: "SECOND",
              direction: "POS",
              action: "OVERWEIGHT",
              rationale: "Fallback recommendation.",
              confidence: "MED",
              mechanism: "Keep existing behavior intact."
            }
          ]
        } as never,
        [
        { name: "Infra Fund", sensitivity: "MED", exposureTags: [] },
        { name: "Infra Fund", sensitivity: "LOW", exposureTags: [] }
      ])
    ).not.toThrow();
  });

  it("extracts recommendations from modern snapshot payload", () => {
    const result = extractAssetRecommendationsFromSnapshot({
      output: {
        assetRecommendations: [
          {
            assetName: "AI Infrastructure ETF",
            assetCategory: "ETF",
            sourceLayer: "THIRD",
            direction: "POS",
            action: "OVERWEIGHT",
            rationale: "Specific AI infrastructure exposure.",
            confidence: "HIGH",
            mechanism: "Direct usage spillover."
          }
        ]
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].assetName).toBe("AI Infrastructure ETF");
  });

  it("returns [] for legacy payloads", () => {
    const result = extractAssetRecommendationsFromSnapshot({ output_text: "{\"foo\":\"bar\"}" });
    expect(result).toHaveLength(0);
  });
});
