import { normalizeTextKey } from "@/lib/schemas";
import type {
  AnalyzeInput,
  AnalysisModelOutput,
  Branch,
  DecisionSummary,
  ExpressionRecommendation,
  IndicatorDefinition,
  NodeShock,
  PortfolioValidation
} from "@/lib/schemas";

type ImpactDirection = "POS" | "NEG" | "MIXED" | "UNCERTAIN";
type Confidence = "LOW" | "MED" | "HIGH";
type LagBand = "IMMEDIATE" | "M3_6" | "M6_18" | "M18_PLUS";
type BranchName = "BASE" | "BULL" | "BEAR";

type UniverseRow = {
  symbol: string;
  companyName: string;
  assetType: "EQUITY" | "ETF";
  region?: string;
  currency?: string;
  liquidityClass: string;
  maxPositionDefaultPct: number;
  tags: string[];
  exposureVector: Record<string, number>;
};

const confidenceWeight: Record<Confidence, number> = {
  LOW: 0.4,
  MED: 0.7,
  HIGH: 1
};

const lagWeight: Record<LagBand, number> = {
  IMMEDIATE: 1,
  M3_6: 0.9,
  M6_18: 0.75,
  M18_PLUS: 0.6
};

const impactWeight: Record<ImpactDirection, number> = {
  POS: 1,
  NEG: -1,
  MIXED: 0,
  UNCERTAIN: 0
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

export function normalizeBranchProbabilities(
  overrides: AnalyzeInput["branchOverrides"] | undefined
): Branch[] {
  const defaults: Branch[] = [
    { name: "BASE", probability: 0.5, rationale: "Most likely trajectory." },
    { name: "BULL", probability: 0.25, rationale: "Constructive upside scenario." },
    { name: "BEAR", probability: 0.25, rationale: "Downside stress scenario." }
  ];

  if (!overrides || overrides.length === 0) return defaults;
  const byName = new Map(overrides.map((x) => [x.name, x.probability]));
  const merged = defaults.map((branch) => ({
    ...branch,
    probability: byName.get(branch.name) ?? branch.probability
  }));
  const total = merged.reduce((sum, branch) => sum + branch.probability, 0);
  if (total <= 0) return defaults;
  return merged.map((branch) => ({ ...branch, probability: branch.probability / total }));
}

export function validatePortfolioReality(
  holdings: AnalyzeInput["holdings"],
  allowWeightOverride: boolean
): PortfolioValidation {
  const weights = holdings.map((holding) => holding.weight ?? 0);
  const weightSum = weights.reduce((sum, x) => sum + x, 0);
  const warnings: string[] = [];
  const errors: string[] = [];
  const suspiciousWeightRows: string[] = [];

  const providedWeightCount = holdings.filter((holding) => typeof holding.weight === "number").length;
  if (providedWeightCount > 0) {
    if (!allowWeightOverride && (weightSum < 0.98 || weightSum > 1.02)) {
      errors.push(`Weight sum is ${(weightSum * 100).toFixed(2)}%. It must be between 98% and 102%.`);
    }
    if (allowWeightOverride && (weightSum < 0.98 || weightSum > 1.02)) {
      warnings.push(`Weight sum is ${(weightSum * 100).toFixed(2)}% (override enabled).`);
    }
  } else {
    warnings.push("No explicit weights provided. Equal-weighting will be used for scoring.");
  }

  for (const holding of holdings) {
    if ((holding.weight ?? 0) > 0.25) {
      warnings.push(`Holding ${holding.name} is above 25%. Confirm this concentration is intentional.`);
    }
    if (typeof holding.weight === "number" && holding.weight > 1 && holding.weight < 99) {
      suspiciousWeightRows.push(holding.name);
    }
  }
  if (suspiciousWeightRows.length > 0) {
    warnings.push("Suspicious weights detected. These look like percent values but should be decimals.");
  }

  const actionableWeight = holdings
    .filter((holding) => holding.constraint === "FREE")
    .reduce((sum, holding) => sum + (holding.weight ?? 0), 0);
  if (actionableWeight <= 0) {
    warnings.push("No FREE capital detected; recommendations may be non-actionable.");
  }

  return {
    weightSum,
    warnings,
    errors,
    actionableWeight,
    suspiciousWeightRows
  };
}

function strengthFromLayer(layer: "first" | "second" | "third" | "fourth"): "WEAK" | "MED" | "STRONG" {
  if (layer === "first") return "STRONG";
  if (layer === "second") return "MED";
  return "WEAK";
}

function lagFromLayer(layer: "first" | "second" | "third" | "fourth"): LagBand {
  if (layer === "first") return "IMMEDIATE";
  if (layer === "second") return "M3_6";
  if (layer === "third") return "M6_18";
  return "M18_PLUS";
}

export function buildNodeShocks(output: AnalysisModelOutput, branches: Branch[]): NodeShock[] {
  const layerEntries = [
    ["first", output.effectsByLayer.first],
    ["second", output.effectsByLayer.second],
    ["third", output.effectsByLayer.third],
    ["fourth", output.effectsByLayer.fourth]
  ] as const;

  const result: NodeShock[] = [];
  for (const branch of branches) {
    for (const [layer, effects] of layerEntries) {
      for (const effect of effects.slice(0, 3)) {
        const direction =
          effect.impactDirection === "POS" ? "UP" : effect.impactDirection === "NEG" ? "DOWN" : "FLAT";
        const baseMagnitude = effect.impactDirection === "UNCERTAIN" ? 0.02 : 0.08;
        const branchMultiplier = branch.name === "BULL" ? 1.2 : branch.name === "BEAR" ? 1.4 : 1;
        const sign = direction === "DOWN" ? -1 : direction === "UP" ? 1 : 0;
        result.push({
          branchName: branch.name,
          nodeKey: normalizeTextKey(effect.description).slice(0, 80) || "macro-node",
          nodeLabel: effect.description.slice(0, 180),
          direction,
          magnitudePct: sign * baseMagnitude * branchMultiplier,
          strength: strengthFromLayer(layer),
          lag: lagFromLayer(layer),
          confidence: effect.confidence,
          evidenceNote: `Derived from ${layer}-order effect chain.`
        });
      }
    }
  }

  return result;
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[|,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseUniverseCsv(csvText: string): { rows: UniverseRow[]; warnings: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("Universe CSV must include a header and at least one data row.");

  const headers = lines[0].split(",").map((h) => h.trim());
  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const normalized = headers.map(normalizeHeader);
  const indexOf = (...names: string[]) => normalized.findIndex((h) => names.includes(h));
  const expCols = normalized
    .map((header, index) => ({ header, index }))
    .filter((item) => item.header.startsWith("exp_"));

  if (expCols.length === 0) {
    throw new Error("Universe CSV must include at least one exp_* exposure column.");
  }

  const symbolIdx = indexOf("symbol");
  const nameIdx = indexOf("company_name", "companyname");
  const assetTypeIdx = indexOf("asset_type", "assettype");
  const liquidityIdx = indexOf("liquidity_class", "liquidityclass");
  const regionIdx = indexOf("region");
  const currencyIdx = indexOf("currency");
  const maxPosIdx = indexOf("max_position_pct", "maxpositionpct");
  const tagsIdx = indexOf("tags");

  if (symbolIdx < 0 || nameIdx < 0 || assetTypeIdx < 0 || liquidityIdx < 0) {
    throw new Error("Universe CSV missing one of required columns: symbol, company_name, asset_type, liquidity_class.");
  }

  const dedupe = new Set<string>();
  const warnings: string[] = [];
  const rows: UniverseRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((x) => x.trim());
    const symbol = (cells[symbolIdx] ?? "").toUpperCase();
    const dedupeKey = normalizeTextKey(symbol);
    if (!symbol) continue;
    if (dedupe.has(dedupeKey)) {
      warnings.push(`Duplicate symbol dropped: ${symbol}`);
      continue;
    }
    dedupe.add(dedupeKey);

    const assetType = (cells[assetTypeIdx] ?? "").toUpperCase();
    if (assetType !== "EQUITY" && assetType !== "ETF") {
      warnings.push(`Invalid asset_type for ${symbol}; row skipped.`);
      continue;
    }

    const vector: Record<string, number> = {};
    for (const col of expCols) {
      const parsed = Number(cells[col.index] ?? "0");
      vector[col.header] = Number.isFinite(parsed) ? Math.max(-1, Math.min(1, parsed)) : 0;
    }
    const hasSignal = Object.values(vector).some((value) => Math.abs(value) > 0);
    if (!hasSignal) {
      warnings.push(`All-zero exposures dropped: ${symbol}`);
      continue;
    }

    const maxPositionPctRaw = Number(cells[maxPosIdx] ?? "0.05");
    rows.push({
      symbol,
      companyName: cells[nameIdx] ?? symbol,
      assetType,
      region: regionIdx >= 0 ? cells[regionIdx] : undefined,
      currency: currencyIdx >= 0 ? cells[currencyIdx] : undefined,
      liquidityClass: cells[liquidityIdx] ?? "daily",
      maxPositionDefaultPct: Number.isFinite(maxPositionPctRaw)
        ? Math.max(0, Math.min(1, maxPositionPctRaw > 1 ? maxPositionPctRaw / 100 : maxPositionPctRaw))
        : 0.05,
      tags: parseTags(tagsIdx >= 0 ? cells[tagsIdx] : undefined),
      exposureVector: vector
    });
  }

  if (rows.length === 0) {
    throw new Error("Universe CSV did not produce any valid rows.");
  }

  return { rows, warnings };
}

export function buildExpressionRecommendations(
  branches: Branch[],
  nodeShocks: NodeShock[],
  universeRows: UniverseRow[],
  holdings: AnalyzeInput["holdings"],
  horizonMonths: number
): ExpressionRecommendation[] {
  const holdingKeys = new Set(
    holdings.map((holding) => normalizeTextKey([holding.ticker ?? "", holding.name].join(" ").trim()))
  );
  const actionableFreeWeight = holdings
    .filter((holding) => holding.constraint === "FREE")
    .reduce((sum, holding) => sum + (holding.weight ?? 0), 0);

  const scored = universeRows.map((row) => {
    let score = 0;
    for (const branch of branches) {
      const branchShocks = nodeShocks.filter((nodeShock) => nodeShock.branchName === branch.name);
      for (const shock of branchShocks) {
        const beta = row.exposureVector[`exp_${shock.nodeKey}`] ?? 0;
        const lagAdj = horizonMonths <= 12 && shock.lag === "M18_PLUS" ? 0.4 : lagWeight[shock.lag];
        score += branch.probability * shock.magnitudePct * beta * confidenceWeight[shock.confidence] * lagAdj;
      }
    }

    const direction: "POS" | "NEG" = score >= 0 ? "POS" : "NEG";
    const absScore = Math.abs(score);
    const sizingBand =
      absScore >= 0.06 ? "LARGE" : absScore >= 0.03 ? "MEDIUM" : "SMALL";

    const baseCap =
      sizingBand === "LARGE" ? 0.05 : sizingBand === "MEDIUM" ? 0.025 : 0.01;
    const freeCap = actionableFreeWeight > 0 ? actionableFreeWeight * 0.05 : baseCap;
    const maxPositionPct = Math.min(baseCap, freeCap, row.maxPositionDefaultPct);
    const alreadyExpressed =
      holdingKeys.has(normalizeTextKey(row.symbol)) || holdingKeys.has(normalizeTextKey(row.companyName));
    const actionable = actionableFreeWeight > 0 && !alreadyExpressed;

    return {
      symbol: row.symbol,
      name: row.companyName,
      assetType: row.assetType,
      direction,
      action: direction === "POS" ? "OVERWEIGHT" : "UNDERWEIGHT",
      sizingBand,
      maxPositionPct,
      score,
      mechanism: "Exposure vector aligns with branch-weighted node shocks.",
      catalystWindow: horizonMonths <= 12 ? "0-12 months" : "12-36 months",
      pricedInNote: "Assess valuation and crowding before execution.",
      riskNote: "Model relies on simplified exposure vectors and manual tagging.",
      invalidationTrigger: "Primary node shocks fail to materialize for two consecutive review cycles.",
      portfolioRole: direction === "POS" ? "core" : "hedge",
      actionable,
      alreadyExpressed
    } satisfies ExpressionRecommendation;
  });

  const longs = scored.filter((x) => x.direction === "POS").sort((a, b) => b.score - a.score).slice(0, 4);
  const shorts = scored.filter((x) => x.direction === "NEG").sort((a, b) => a.score - b.score).slice(0, 3);
  return [...longs, ...shorts];
}

export function buildDecisionSummary(
  branchImpacts: Array<{ branchName: BranchName; score: number }>,
  recommendations: ExpressionRecommendation[],
  indicators: IndicatorDefinition[]
): DecisionSummary {
  const samples = branchImpacts.flatMap((x) => [x.score * 0.8, x.score, x.score * 1.2]);
  const portfolioImpactP10 = percentile(samples, 0.1);
  const portfolioImpactP50 = percentile(samples, 0.5);
  const portfolioImpactP90 = percentile(samples, 0.9);

  const topActions = recommendations
    .filter((x) => x.actionable)
    .slice(0, 3)
    .map((x) => `${x.action} ${x.symbol} (${(x.maxPositionPct * 100).toFixed(1)}% max)`);
  while (topActions.length < 3) topActions.push("No additional actionable change required.");

  const topMonitors = indicators.slice(0, 3).map((x) => x.indicatorName);
  while (topMonitors.length < 3) topMonitors.push("Monitor thesis coherence versus branch probabilities.");

  const changeMyMind = [
    "Branch probabilities diverge materially from observed indicators.",
    "Core second-order assumptions fail for two review cycles.",
    "Portfolio impact distribution re-centers near neutral."
  ];

  return {
    portfolioImpactP10,
    portfolioImpactP50,
    portfolioImpactP90,
    topActions,
    topMonitors,
    changeMyMind
  };
}

export function deriveIndicatorDefinitions(output: AnalysisModelOutput): IndicatorDefinition[] {
  const inferred = output.leadingIndicators.slice(0, 5).map((indicator) => ({
    indicatorName: indicator.name,
    supportsDirection: "HIGHER_SUPPORTS" as const,
    greenThreshold: 1,
    yellowThreshold: 0,
    redThreshold: -1,
    expectedWindow: "3-6 months"
  }));
  return inferred;
}

export function computeStatusFromObservedValue(
  observedValue: number,
  definition: IndicatorDefinition
): "GREEN" | "YELLOW" | "RED" {
  if (definition.supportsDirection === "HIGHER_SUPPORTS") {
    if (observedValue >= definition.greenThreshold) return "GREEN";
    if (observedValue >= definition.yellowThreshold) return "YELLOW";
    return "RED";
  }
  if (observedValue <= definition.greenThreshold) return "GREEN";
  if (observedValue <= definition.yellowThreshold) return "YELLOW";
  return "RED";
}
