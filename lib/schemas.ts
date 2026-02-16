import { z } from "zod";

export const impactDirectionSchema = z.enum(["POS", "NEG", "MIXED", "UNCERTAIN"]);
export const confidenceLevelSchema = z.enum(["LOW", "MED", "HIGH"]);
export const sensitivityLevelSchema = z.enum(["LOW", "MED", "HIGH"]);
export const biasLabelSchema = z.enum(["STRONG_NEG", "NEG", "NEUTRAL", "POS", "STRONG_POS"]);
export const holdingConstraintSchema = z.enum(["LOCKED", "SEMI_LOCKED", "FREE"]);
export const holdingPurposeSchema = z.enum([
  "TAX",
  "SPEND_0_12M",
  "SPEND_12_36M",
  "LIFESTYLE_DRAWDOWN",
  "LONG_TERM_GROWTH"
]);
export const runStatusSchema = z.enum(["PLAYING_OUT", "MIXED", "INVALIDATED", "UNASSESSED"]);
export const branchNameSchema = z.enum(["BASE", "BULL", "BEAR"]);
export const shockDirectionSchema = z.enum(["UP", "DOWN", "FLAT"]);
export const strengthBandSchema = z.enum(["WEAK", "MED", "STRONG"]);
export const lagBandSchema = z.enum(["IMMEDIATE", "M3_6", "M6_18", "M18_PLUS"]);
export const sizingBandSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);
export const indicatorSupportDirectionSchema = z.enum(["HIGHER_SUPPORTS", "LOWER_SUPPORTS"]);
export const universeAssetTypeSchema = z.enum(["EQUITY", "ETF"]);
export const assetCategorySchema = z.enum([
  "EQUITY",
  "ETF",
  "INDEX",
  "SECTOR",
  "COMMODITY",
  "CREDIT",
  "CURRENCY",
  "OTHER"
]);
export const recommendationSourceLayerSchema = z.enum(["SECOND", "THIRD", "FOURTH"]);
export const recommendationActionSchema = z.enum(["OVERWEIGHT", "UNDERWEIGHT", "BUY", "SELL", "HEDGE", "WATCH"]);

export const holdingInputSchema = z.object({
  name: z.string().min(1).max(120),
  ticker: z.string().max(20).optional(),
  weight: z
    .preprocess((value) => {
      if (typeof value !== "number") {
        return value;
      }
      if (value > 1 && value <= 100) {
        return value / 100;
      }
      return value;
    }, z.number().min(0).max(1))
    .optional(),
  sensitivity: sensitivityLevelSchema,
  constraint: holdingConstraintSchema.default("FREE"),
  purpose: holdingPurposeSchema.default("LONG_TERM_GROWTH"),
  exposureTags: z.array(z.string().min(1).max(50)).max(12)
});

export const analyzeInputSchema = z.object({
  statement: z.string().min(10).max(500),
  probability: z.number().min(0).max(1),
  horizonMonths: z.number().int().min(1).max(120),
  modelName: z.string().min(1).max(80).optional(),
  branchMode: z.literal("MODEL_SUGGESTS_USER_OVERRIDES").default("MODEL_SUGGESTS_USER_OVERRIDES"),
  portfolioScenarioId: z.string().cuid().optional(),
  universeVersionId: z.string().cuid().optional(),
  allowWeightOverride: z.boolean().default(false),
  branchOverrides: z
    .array(
      z.object({
        name: branchNameSchema,
        probability: z.number().min(0).max(1)
      })
    )
    .max(3)
    .optional(),
  holdings: z.array(holdingInputSchema).min(1).max(100)
});

export const scenarioCreateInputSchema = z.object({
  name: z.string().min(2).max(120),
  holdings: z.array(holdingInputSchema).min(1).max(500)
});

const effectSchema = z.object({
  description: z.string().min(3).max(500),
  impactDirection: impactDirectionSchema,
  confidence: confidenceLevelSchema
});

export const branchSchema = z.object({
  name: branchNameSchema,
  probability: z.number().min(0).max(1),
  rationale: z.string().min(3).max(500)
});

export const nodeShockSchema = z.object({
  branchName: branchNameSchema,
  nodeKey: z.string().min(2).max(120),
  nodeLabel: z.string().min(2).max(180),
  direction: shockDirectionSchema,
  magnitudePct: z.number().min(-1).max(1),
  strength: strengthBandSchema,
  lag: lagBandSchema,
  confidence: confidenceLevelSchema,
  evidenceNote: z.string().min(2).max(300)
});

export const expressionRecommendationSchema = z.object({
  symbol: z.string().min(1).max(32),
  name: z.string().min(2).max(120),
  assetType: universeAssetTypeSchema,
  direction: z.enum(["POS", "NEG"]),
  action: z.string().min(2).max(40),
  sizingBand: sizingBandSchema,
  maxPositionPct: z.number().min(0).max(1),
  score: z.number(),
  mechanism: z.string().min(5).max(900),
  catalystWindow: z.string().min(2).max(120),
  pricedInNote: z.string().min(2).max(300),
  riskNote: z.string().min(2).max(300),
  invalidationTrigger: z.string().min(2).max(300),
  portfolioRole: z.string().min(2).max(60),
  actionable: z.boolean(),
  alreadyExpressed: z.boolean()
});

export const indicatorDefinitionSchema = z.object({
  indicatorName: z.string().min(2).max(120),
  supportsDirection: indicatorSupportDirectionSchema,
  greenThreshold: z.number(),
  yellowThreshold: z.number(),
  redThreshold: z.number(),
  expectedWindow: z.string().min(2).max(120)
});

export const decisionSummarySchema = z.object({
  portfolioImpactP10: z.number().min(-1).max(1),
  portfolioImpactP50: z.number().min(-1).max(1),
  portfolioImpactP90: z.number().min(-1).max(1),
  topActions: z.array(z.string().min(2).max(200)).max(3),
  topMonitors: z.array(z.string().min(2).max(200)).max(3),
  changeMyMind: z.array(z.string().min(2).max(200)).max(3)
});

export const portfolioValidationSchema = z.object({
  weightSum: z.number(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  actionableWeight: z.number().min(0).max(1),
  suspiciousWeightRows: z.array(z.string())
});

export const assetRecommendationSchema = z.object({
  assetName: z.string().min(1).max(120),
  ticker: z.string().max(20).optional(),
  assetCategory: assetCategorySchema,
  sourceLayer: recommendationSourceLayerSchema,
  direction: impactDirectionSchema,
  action: recommendationActionSchema,
  rationale: z.string().min(3).max(600),
  confidence: confidenceLevelSchema,
  mechanism: z.string().min(5).max(900),
  timeHorizon: z.string().max(120).optional()
});

export const analysisModelOutputSchema = z.object({
  effectsByLayer: z.object({
    first: z.array(effectSchema).min(2),
    second: z.array(effectSchema).min(2),
    third: z.array(effectSchema),
    fourth: z.array(effectSchema)
  }),
  assumptions: z.array(
    z.object({
      assumption: z.string().min(3).max(300),
      breakpointSignal: z.string().min(3).max(300)
    })
  ),
  leadingIndicators: z.array(
    z.object({
      name: z.string().min(2).max(120),
      rationale: z.string().min(3).max(300)
    })
  ),
  holdingMappings: z.array(
    z.object({
      holdingName: z.string().min(1).max(120),
      exposureType: z.string().min(2).max(220),
      netImpact: impactDirectionSchema,
      mechanism: z.string().min(5).max(900),
      confidence: confidenceLevelSchema
    })
  ),
  assetRecommendations: z.array(assetRecommendationSchema).max(12).default([]),
  branches: z.array(branchSchema).length(3).optional(),
  nodeShocks: z.array(nodeShockSchema).optional(),
  indicatorDefinitions: z.array(indicatorDefinitionSchema).optional(),
  expressionRecommendations: z.array(expressionRecommendationSchema).optional(),
  decisionSummary: decisionSummarySchema.optional()
});

export const universeUploadInputSchema = z.object({
  name: z.string().min(2).max(120),
  csvText: z.string().min(10)
});

export const registerInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;
export type AnalysisModelOutput = z.infer<typeof analysisModelOutputSchema>;
export type AssetRecommendation = z.infer<typeof assetRecommendationSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type NodeShock = z.infer<typeof nodeShockSchema>;
export type ExpressionRecommendation = z.infer<typeof expressionRecommendationSchema>;
export type IndicatorDefinition = z.infer<typeof indicatorDefinitionSchema>;
export type DecisionSummary = z.infer<typeof decisionSummarySchema>;
export type PortfolioValidation = z.infer<typeof portfolioValidationSchema>;

function clampText(value: unknown, max: number): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const compact = value.trim().replace(/\s+/g, " ");
  return compact.length <= max ? compact : compact.slice(0, max - 1).trimEnd();
}

export function sanitizeModelOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const obj = raw as Record<string, unknown>;
  const holdingMappings = Array.isArray(obj.holdingMappings)
    ? obj.holdingMappings.map((item) => {
        if (!item || typeof item !== "object") {
          return item;
        }
        const mapping = item as Record<string, unknown>;
        return {
          ...mapping,
          holdingName: clampText(mapping.holdingName, 120),
          exposureType: clampText(mapping.exposureType, 220),
          mechanism: clampText(mapping.mechanism, 900)
        };
      })
    : obj.holdingMappings;
  const assetRecommendations = Array.isArray(obj.assetRecommendations)
    ? obj.assetRecommendations.map((item) => {
        if (!item || typeof item !== "object") {
          return item;
        }
        const recommendation = item as Record<string, unknown>;
        return {
          ...recommendation,
          assetName: clampText(recommendation.assetName, 120),
          ticker: clampText(recommendation.ticker, 20),
          rationale: clampText(recommendation.rationale, 600),
          mechanism: clampText(recommendation.mechanism, 900),
          timeHorizon: recommendation.timeHorizon ? clampText(recommendation.timeHorizon, 120) : undefined
        };
      })
    : obj.assetRecommendations;

  return {
    ...obj,
    holdingMappings,
    assetRecommendations
  };
}

export function normalizeTextKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function dedupeEffects(output: AnalysisModelOutput): AnalysisModelOutput {
  const dedupeLayer = (items: AnalysisModelOutput["effectsByLayer"]["first"]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = normalizeTextKey(item.description);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  return {
    ...output,
    effectsByLayer: {
      first: dedupeLayer(output.effectsByLayer.first),
      second: dedupeLayer(output.effectsByLayer.second),
      third: dedupeLayer(output.effectsByLayer.third),
      fourth: dedupeLayer(output.effectsByLayer.fourth)
    }
  };
}

export function dedupeHoldingMappings(output: AnalysisModelOutput): AnalysisModelOutput {
  const byHolding = new Map<string, AnalysisModelOutput["holdingMappings"][number]>();
  for (const mapping of output.holdingMappings) {
    const key = normalizeTextKey(mapping.holdingName);
    if (!byHolding.has(key)) {
      byHolding.set(key, mapping);
    }
  }

  return {
    ...output,
    holdingMappings: [...byHolding.values()]
  };
}

export function dedupeAssetRecommendations(output: AnalysisModelOutput): AnalysisModelOutput {
  const seen = new Set<string>();
  return {
    ...output,
    assetRecommendations: output.assetRecommendations.filter((item) => {
      const key = `${normalizeTextKey(item.assetName)}|${item.sourceLayer}|${item.action}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
  };
}

export function enforceOutputChecks(output: AnalysisModelOutput, holdings: AnalyzeInput["holdings"]) {
  if (output.effectsByLayer.first.length < 2) {
    throw new Error(
      `Model output must include at least 2 first-order effects (received ${output.effectsByLayer.first.length}).`
    );
  }
  if (output.effectsByLayer.second.length < 2) {
    throw new Error(
      `Model output must include at least 2 second-order effects (received ${output.effectsByLayer.second.length}).`
    );
  }

  if (
    (output.effectsByLayer.second.length > 0 ||
      output.effectsByLayer.third.length > 0 ||
      output.effectsByLayer.fourth.length > 0) &&
    output.assetRecommendations.length === 0
  ) {
    throw new Error(
      "Model output must include at least one asset recommendation tied to SECOND/THIRD/FOURTH effects."
    );
  }

  const byHolding = new Map<string, number>();
  for (const mapping of output.holdingMappings) {
    const key = normalizeTextKey(mapping.holdingName);
    byHolding.set(key, (byHolding.get(key) ?? 0) + 1);
  }

  const uniqueHoldingKeys = new Set(holdings.map((holding) => normalizeTextKey(holding.name)));
  for (const key of uniqueHoldingKeys) {
    if ((byHolding.get(key) ?? 0) !== 1) {
      const sampleName = holdings.find((h) => normalizeTextKey(h.name) === key)?.name ?? key;
      throw new Error(`Expected exactly one mapping for holding: ${sampleName}`);
    }
  }
}

function getRecommendationsFromPayload(output: unknown): AssetRecommendation[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const asRecord = output as Record<string, unknown>;
  let recommendations: unknown;
  if (Array.isArray(asRecord.assetRecommendations)) {
    recommendations = asRecord.assetRecommendations;
  } else if (asRecord.output && typeof asRecord.output === "object" && !Array.isArray(asRecord.output)) {
    const nested = asRecord.output as Record<string, unknown>;
    if (Array.isArray(nested.assetRecommendations)) {
      recommendations = nested.assetRecommendations;
    }
  }

  if (Array.isArray(recommendations)) {
    return recommendations.filter((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const rec = item as Record<string, unknown>;
      return typeof rec.assetName === "string" && rec.assetName.trim().length > 0;
    }) as AssetRecommendation[];
  }

  return [];
}

export function extractAssetRecommendationsFromSnapshot(rawOutputJson: unknown): AssetRecommendation[] {
  const fromCurrentShape = getRecommendationsFromPayload(rawOutputJson);
  if (fromCurrentShape.length > 0) {
    return fromCurrentShape;
  }

  if (
    rawOutputJson &&
    typeof rawOutputJson === "object" &&
    "output_text" in rawOutputJson &&
    typeof (rawOutputJson as { output_text?: unknown }).output_text === "string"
  ) {
    try {
      const parsed = JSON.parse((rawOutputJson as { output_text: string }).output_text);
      const parsedList = getRecommendationsFromPayload(parsed);
      if (parsedList.length > 0) {
        return parsedList;
      }
    } catch {
      return [];
    }
  }

  if (
    rawOutputJson &&
    typeof rawOutputJson === "object" &&
    "output" in rawOutputJson &&
    Array.isArray((rawOutputJson as { output?: unknown }).output)
  ) {
    const output = (rawOutputJson as { output: Array<{ content?: unknown }> }).output;
    for (const block of output) {
      if (block && typeof block === "object" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
            try {
              const parsed = JSON.parse(item.text);
              const parsedList = getRecommendationsFromPayload(parsed);
              if (parsedList.length > 0) {
                return parsedList;
              }
            } catch {
              continue;
            }
          }
        }
      }
    }
  }

  return [];
}

export const indicatorPatchSchema = z.object({
  latestStatus: z.enum(["GREEN", "YELLOW", "RED", "UNKNOWN"]),
  latestNote: z.string().max(500).optional(),
  observedValue: z.number().optional()
});
