import type { AnalysisModelOutput, AnalyzeInput } from "@/lib/schemas";
import { biasLabelSchema } from "@/lib/schemas";
import { normalizeTextKey } from "@/lib/schemas";

const impactScore: Record<"POS" | "NEG" | "MIXED" | "UNCERTAIN", number> = {
  POS: 1,
  NEG: -1,
  MIXED: 0,
  UNCERTAIN: 0
};

const confidenceScore: Record<"LOW" | "MED" | "HIGH", number> = {
  LOW: 0.4,
  MED: 0.7,
  HIGH: 1
};

const sensitivityScore: Record<"LOW" | "MED" | "HIGH", number> = {
  LOW: 0.5,
  MED: 0.8,
  HIGH: 1
};

export type BiasLabel = ReturnType<typeof biasLabelSchema.parse>;

export function normalizeWeights(holdings: AnalyzeInput["holdings"]): number[] {
  const hasAnyWeight = holdings.some((h) => typeof h.weight === "number");
  if (!hasAnyWeight) {
    const w = 1 / holdings.length;
    return holdings.map(() => w);
  }

  const raw = holdings.map((h) => h.weight ?? 0);
  const total = raw.reduce((sum, x) => sum + x, 0);
  if (total <= 0) {
    throw new Error("Provided holding weights sum to zero.");
  }
  return raw.map((x) => x / total);
}

export function biasLabelFromScore(score: number): BiasLabel {
  if (score <= -0.6) return "STRONG_NEG";
  if (score <= -0.2) return "NEG";
  if (score < 0.2) return "NEUTRAL";
  if (score < 0.6) return "POS";
  return "STRONG_POS";
}

export function computePortfolioBias(input: AnalyzeInput, output: AnalysisModelOutput) {
  const weights = normalizeWeights(input.holdings);

  const mappingByHolding = new Map(
    output.holdingMappings.map((m) => [normalizeTextKey(m.holdingName), m])
  );

  const contributions = input.holdings.map((holding, index) => {
    const mapping = mappingByHolding.get(normalizeTextKey(holding.name));
    if (!mapping) {
      throw new Error(`Missing mapping for holding ${holding.name}`);
    }

    const score =
      impactScore[mapping.netImpact] *
      confidenceScore[mapping.confidence] *
      sensitivityScore[holding.sensitivity] *
      input.probability *
      weights[index];

    return {
      holdingName: holding.name,
      score,
      weight: weights[index]
    };
  });

  const rawBias = contributions.reduce((sum, c) => sum + c.score, 0);
  const portfolioBias = Math.max(-1, Math.min(1, rawBias));
  return {
    contributions,
    portfolioBias,
    biasLabel: biasLabelFromScore(portfolioBias)
  };
}
