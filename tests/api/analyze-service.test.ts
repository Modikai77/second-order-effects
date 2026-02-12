import { describe, expect, it, vi, beforeEach } from "vitest";

const runStructuredAnalysis = vi.fn();
const themeCreate = vi.fn();
const runSnapshotCreate = vi.fn();

vi.mock("@/lib/openai", () => ({
  runStructuredAnalysis
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) =>
      callback({
        theme: { create: themeCreate },
        themeEffect: { createMany: vi.fn() },
        holding: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: "h1", name: "Infra Fund" })
            .mockResolvedValueOnce({ id: "h2", name: "SaaS Fund" })
        },
        portfolioMapping: { createMany: vi.fn() },
        invalidationItem: { create: vi.fn() },
        runSnapshot: { create: runSnapshotCreate }
      })
    ),
    theme: { create: themeCreate },
    runSnapshot: { create: runSnapshotCreate }
  }
}));

import { analyzeAndPersist } from "@/lib/analysis-service";

const validInput = {
  statement: "AI agents reduce custom software costs by 60%.",
  probability: 0.4,
  horizonMonths: 24,
  holdings: [
    { name: "Infra Fund", sensitivity: "HIGH", exposureTags: [] },
    { name: "SaaS Fund", sensitivity: "MED", exposureTags: [] }
  ]
};

const validOutput = {
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
  assumptions: [{ assumption: "x", breakpointSignal: "y" }],
  leadingIndicators: [{ name: "z", rationale: "r" }],
  holdingMappings: [
    {
      holdingName: "Infra Fund",
      exposureType: "Compute",
      netImpact: "POS",
      mechanism: "Demand up",
      confidence: "HIGH"
    },
    {
      holdingName: "SaaS Fund",
      exposureType: "Pricing",
      netImpact: "NEG",
      mechanism: "Pressure",
      confidence: "MED"
    }
  ]
};

describe("analyzeAndPersist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeCreate.mockResolvedValue({ id: "theme-1" });
    runSnapshotCreate.mockResolvedValue({ id: "snap-1" });
  });

  it("retries once when first model call fails", async () => {
    runStructuredAnalysis
      .mockRejectedValueOnce(new Error("schema fail"))
      .mockResolvedValueOnce({
        modelName: "gpt-4.1",
        promptVersion: "v1",
        output: validOutput,
        raw: { output_text: "{}" }
      });

    const result = await analyzeAndPersist(validInput);

    expect(result.ok).toBe(true);
    expect(runStructuredAnalysis).toHaveBeenCalledTimes(2);
  });

  it("returns partial failure payload after retry exhaustion", async () => {
    runStructuredAnalysis
      .mockRejectedValueOnce(new Error("schema fail"))
      .mockRejectedValueOnce(new Error("schema fail again"));

    const result = await analyzeAndPersist(validInput);

    expect(result.ok).toBe(false);
    expect(runStructuredAnalysis).toHaveBeenCalledTimes(2);
    expect(runSnapshotCreate).toHaveBeenCalled();
  });
});
