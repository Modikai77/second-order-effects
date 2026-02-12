import { describe, expect, it } from "vitest";
import { dedupeEffects, dedupeHoldingMappings, enforceOutputChecks } from "@/lib/schemas";

const baseOutput = {
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
  holdingMappings: [
    {
      holdingName: "Infra Fund",
      exposureType: "Compute",
      netImpact: "POS",
      mechanism: "Capex",
      confidence: "MED"
    }
  ]
} as const;

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

  it("enforces one mapping per holding", () => {
    expect(() =>
      enforceOutputChecks(baseOutput as never, [
        { name: "Infra Fund", sensitivity: "MED", exposureTags: [] },
        { name: "SaaS Fund", sensitivity: "MED", exposureTags: [] }
      ])
    ).toThrow("SaaS Fund");
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
      enforceOutputChecks(output as never, [
        { name: "Infra Fund", sensitivity: "MED", exposureTags: [] },
        { name: "Infra Fund", sensitivity: "LOW", exposureTags: [] }
      ])
    ).not.toThrow();
  });
});
