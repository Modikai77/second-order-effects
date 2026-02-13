import { z } from "zod";

export const impactDirectionSchema = z.enum(["POS", "NEG", "MIXED", "UNCERTAIN"]);
export const confidenceLevelSchema = z.enum(["LOW", "MED", "HIGH"]);
export const sensitivityLevelSchema = z.enum(["LOW", "MED", "HIGH"]);
export const biasLabelSchema = z.enum(["STRONG_NEG", "NEG", "NEUTRAL", "POS", "STRONG_POS"]);

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
  exposureTags: z.array(z.string().min(1).max(50)).max(12)
});

export const analyzeInputSchema = z.object({
  statement: z.string().min(10).max(500),
  probability: z.number().min(0).max(1),
  horizonMonths: z.number().int().min(1).max(120),
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

export const analysisModelOutputSchema = z.object({
  effectsByLayer: z.object({
    first: z.array(effectSchema),
    second: z.array(effectSchema),
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
  )
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

  return {
    ...obj,
    holdingMappings
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

export function enforceOutputChecks(output: AnalysisModelOutput, holdings: AnalyzeInput["holdings"]) {
  if (output.effectsByLayer.first.length < 2) {
    throw new Error("Model output must include at least 2 first-order effects.");
  }
  if (output.effectsByLayer.second.length < 2) {
    throw new Error("Model output must include at least 2 second-order effects.");
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

export const indicatorPatchSchema = z.object({
  latestStatus: z.enum(["GREEN", "YELLOW", "RED", "UNKNOWN"]),
  latestNote: z.string().max(500).optional()
});
