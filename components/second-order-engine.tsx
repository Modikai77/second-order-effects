"use client";

import React from "react";
import { useMemo, useState } from "react";
import { useEffect } from "react";

type Sensitivity = "LOW" | "MED" | "HIGH";
type Impact = "POS" | "NEG" | "MIXED" | "UNCERTAIN";
type Confidence = "LOW" | "MED" | "HIGH";
type IndicatorStatus = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
type AssetRecommendationDirection = "POS" | "NEG" | "MIXED" | "UNCERTAIN";
type HoldingConstraint = "LOCKED" | "SEMI_LOCKED" | "FREE";
type HoldingPurpose = "TAX" | "SPEND_0_12M" | "SPEND_12_36M" | "LIFESTYLE_DRAWDOWN" | "LONG_TERM_GROWTH";
type BranchName = "BASE" | "BULL" | "BEAR";

type HoldingInput = {
  name: string;
  ticker?: string;
  weight?: number;
  sensitivity: Sensitivity;
  constraint: HoldingConstraint;
  purpose: HoldingPurpose;
  exposureTags: string[];
};

type AnalysisResponse = {
  ok: boolean;
  themeId?: string;
  error?: unknown;
  message?: string;
  bias?: {
    portfolioBias: number;
    biasLabel: string;
    contributions: Array<{ holdingName: string; score: number; weight: number }>;
  };
  analysis?: {
    effectsByLayer: Record<
      "first" | "second" | "third" | "fourth",
      Array<{ description: string; impactDirection: Impact; confidence: Confidence }>
    >;
    holdingMappings: Array<{ holdingName: string; exposureType: string; netImpact: Impact; mechanism: string; confidence: Confidence }>;
    assumptions: Array<{ assumption: string; breakpointSignal: string }>;
    leadingIndicators: Array<{ name: string; rationale: string }>;
    assetRecommendations?: AssetRecommendation[];
  };
  assetRecommendations?: AssetRecommendation[];
  portfolioValidation?: {
    weightSum: number;
    warnings: string[];
    errors: string[];
    actionableWeight: number;
    suspiciousWeightRows: string[];
  };
  branches?: Array<{ name: BranchName; probability: number; rationale: string }>;
  nodeShocks?: Array<{
    branchName: BranchName;
    nodeKey?: string;
    nodeLabel: string;
    direction: "UP" | "DOWN" | "FLAT";
    magnitudePct: number;
    strength: "WEAK" | "MED" | "STRONG";
    lag: "IMMEDIATE" | "M3_6" | "M6_18" | "M18_PLUS";
    confidence: Confidence;
    evidenceNote: string;
  }>;
  recommendations?: Array<{
    symbol: string;
    name: string;
    assetType: "EQUITY" | "ETF";
    direction: "POS" | "NEG";
    action: string;
    sizingBand: "SMALL" | "MEDIUM" | "LARGE";
    maxPositionPct: number;
    score: number;
    mechanism: string;
    catalystWindow: string;
    riskNote: string;
    invalidationTrigger: string;
    portfolioRole: string;
    actionable: boolean;
    alreadyExpressed: boolean;
  }>;
  decisionSummary?: {
    portfolioImpactP10: number;
    portfolioImpactP50: number;
    portfolioImpactP90: number;
    topActions: string[];
    topMonitors: string[];
    changeMyMind: string[];
  };
  exposureContributions?: Array<{ holdingName: string; score: number; weight: number; direction: string }>;
};

type AssetRecommendation = {
  assetName: string;
  ticker?: string;
  assetCategory: string;
  sourceLayer: "SECOND" | "THIRD" | "FOURTH";
  direction: AssetRecommendationDirection;
  action: "OVERWEIGHT" | "UNDERWEIGHT" | "BUY" | "SELL" | "HEDGE" | "WATCH";
  rationale: string;
  confidence: Confidence;
  mechanism: string;
  timeHorizon?: string;
};

type IndicatorItem = {
  id?: string;
  assumption: string;
  breakpointSignal: string;
  indicatorName: string;
  latestStatus: IndicatorStatus;
  latestNote?: string;
};

type ThemeListItem = {
  id: string;
  statement: string;
  runStatus?: "PLAYING_OUT" | "MIXED" | "INVALIDATED" | "UNASSESSED";
  createdAt: string;
  runSnapshots: Array<{ biasLabel: string; computedBiasScore: number }>;
};

type ScenarioRecord = {
  id: string;
  name: string;
  createdAt: string;
  holdings: Array<{
    name: string;
    ticker?: string | null;
    weight?: number | null;
    sensitivity: Sensitivity;
    constraint: HoldingConstraint;
    purpose: HoldingPurpose;
    exposureTags: string[];
  }>;
};

type UniverseVersionListItem = {
  id: string;
  name: string;
  createdAt: string;
  _count?: { companies: number };
};

const statusOptions: IndicatorStatus[] = ["UNKNOWN", "GREEN", "YELLOW", "RED"];
const recommendationLayerLabels = {
  SECOND: "Second",
  THIRD: "Third",
  FOURTH: "Fourth"
} as const;
const availableModels = ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "gpt-5.2"];

const emptyHolding = (): HoldingInput => ({
  name: "",
  ticker: "",
  sensitivity: "MED",
  constraint: "FREE",
  purpose: "LONG_TERM_GROWTH",
  exposureTags: []
});

function toPercentWeight(weight?: number | null): number | undefined {
  if (typeof weight !== "number" || !Number.isFinite(weight)) return undefined;
  if (weight <= 1) return Number((weight * 100).toFixed(2));
  return Number(weight.toFixed(2));
}

function toDecimalWeight(weight?: number): number | undefined {
  if (typeof weight !== "number" || !Number.isFinite(weight)) return undefined;
  if (weight > 1) return weight / 100;
  return weight;
}

function impactToneClass(impact: Impact): string {
  if (impact === "POS") return "tone-pos";
  if (impact === "NEG") return "tone-neg";
  return "tone-neutral";
}

function biasToneClass(label: string): string {
  if (label === "POS" || label === "STRONG_POS") return "tone-pos";
  if (label === "NEG" || label === "STRONG_NEG") return "tone-neg";
  return "tone-neutral";
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parsePortfolioCsv(text: string): HoldingInput[] {
  const normalizeHeader = (header: string) =>
    header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const parseHeaderDate = (value: string): Date | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return new Date(Date.UTC(year, month - 1, day));
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  };

  const parseNumeric = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const cleaned = value
      .replace(/[£$,]/g, "")
      .replace(/%/g, "")
      .replace(/\s+/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseDecimalWeight = (value: number | undefined): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    return value > 1 ? value / 100 : value;
  };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1) {
    throw new Error("CSV is empty.");
  }

  const rows = lines.map(parseCsvRow);
  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      normalized.includes("name") ||
      normalized.includes("holdingname") ||
      normalized.includes("assetname")
    );
  });

  if (headerRowIndex < 0) {
    throw new Error("CSV must include a `name` column.");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const headerIndex = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

  const nameIdx = headerIndex(["name", "holding", "holdingname", "assetname"]);
  const tickerIdx = headerIndex(["ticker", "symbol"]);
  const weightIdx = headerIndex(["weight", "allocation", "portfolio_weight"]);
  const weightPctIdx = headerIndex(["weightpct", "weight_percent", "weightpercentage", "allocationpct"]);
  const amountIdx = headerIndex([
    "amount",
    "value",
    "marketvalue",
    "positionvalue",
    "gbpamount",
    "amountgbp",
    "amount",
    "valuegbp",
    "holdingvalue"
  ]);
  const sensitivityIdx = headerIndex(["sensitivity", "exposuresensitivity"]);
  const constraintIdx = headerIndex(["constraint", "capitalconstraint"]);
  const purposeIdx = headerIndex(["purpose", "bucketpurpose"]);
  const tagsIdx = headerIndex(["tags", "exposuretags", "exposure_tags"]);

  if (nameIdx < 0) {
    throw new Error("CSV must include a `name` column.");
  }

  const dateColumns = rows[headerRowIndex]
    .map((header, index) => ({ header, index, date: parseHeaderDate(header) }))
    .filter((x) => x.date !== null) as Array<{ header: string; index: number; date: Date }>;
  const latestDateColumn = dateColumns
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
    ?.index;
  const chosenAmountColumn = latestDateColumn ?? amountIdx;

  const dataRows = rows.slice(headerRowIndex + 1);
  const staged: Array<HoldingInput & { _rawAmount?: number }> = [];
  for (const cells of dataRows) {
    const name = cells[nameIdx]?.trim();
    const normalizedName = normalizeHeader(name ?? "");
    const secondCell = normalizeHeader(cells[1] ?? "");
    if (
      normalizedName === "summary" ||
      (normalizedName === "bucket" && secondCell.startsWith("sumof")) ||
      normalizedName === "grandtotal"
    ) {
      break;
    }
    if (!name || normalizedName === "summary" || normalizedName === "bucket" || normalizedName === "grandtotal") {
      continue;
    }
    if (cells.every((cell) => !cell || !cell.trim())) {
      continue;
    }

    const parsedWeight = parseNumeric(weightIdx >= 0 ? cells[weightIdx]?.trim() : undefined);
    const parsedWeightPct = parseNumeric(weightPctIdx >= 0 ? cells[weightPctIdx]?.trim() : undefined);
    const parsedAmount = parseNumeric(
      chosenAmountColumn !== undefined && chosenAmountColumn >= 0
        ? cells[chosenAmountColumn]?.trim()
        : undefined
    );

    const rawSensitivity = sensitivityIdx >= 0 ? cells[sensitivityIdx]?.trim().toUpperCase() : "";
    const sensitivity: Sensitivity =
      rawSensitivity === "LOW" || rawSensitivity === "MED" || rawSensitivity === "HIGH"
        ? rawSensitivity
        : "MED";
    const rawConstraint = constraintIdx >= 0 ? cells[constraintIdx]?.trim().toUpperCase() : "";
    const constraint: HoldingConstraint =
      rawConstraint === "LOCKED" || rawConstraint === "SEMI_LOCKED" || rawConstraint === "FREE"
        ? rawConstraint
        : "FREE";
    const rawPurpose = purposeIdx >= 0 ? cells[purposeIdx]?.trim().toUpperCase() : "";
    const purpose: HoldingPurpose =
      rawPurpose === "TAX" ||
      rawPurpose === "SPEND_0_12M" ||
      rawPurpose === "SPEND_12_36M" ||
      rawPurpose === "LIFESTYLE_DRAWDOWN" ||
      rawPurpose === "LONG_TERM_GROWTH"
        ? rawPurpose
        : "LONG_TERM_GROWTH";

    const rawTags = tagsIdx >= 0 ? cells[tagsIdx] ?? "" : "";
    const exposureTags = rawTags
      .split(/[|;]+/)
      .flatMap((part) => part.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    staged.push({
      name,
      ticker: tickerIdx >= 0 ? cells[tickerIdx]?.trim() : undefined,
      weight: Number.isFinite(parsedWeight)
        ? parseDecimalWeight(parsedWeight as number)
        : Number.isFinite(parsedWeightPct)
          ? parseDecimalWeight(parsedWeightPct as number)
          : undefined,
      sensitivity,
      constraint,
      purpose,
      exposureTags,
      _rawAmount: parsedAmount
    });
  }

  if (staged.length === 0) {
    throw new Error("No valid holding rows found in CSV.");
  }

  const hasExplicitWeight = staged.some((h) => typeof h.weight === "number");
  const hasAmountValues = staged.some((h) => typeof h._rawAmount === "number" && (h._rawAmount ?? 0) > 0);

    if (!hasExplicitWeight && hasAmountValues) {
      const totalAmount = staged.reduce((sum, h) => sum + (h._rawAmount && h._rawAmount > 0 ? h._rawAmount : 0), 0);
      if (totalAmount <= 0) {
        throw new Error("CSV amount column found, but total amount is zero.");
      }
      for (const holding of staged) {
        if ((holding._rawAmount ?? 0) > 0) {
          holding.weight = Number(((holding._rawAmount as number) / totalAmount).toFixed(6));
        }
      }
    }

  return staged.map(({ _rawAmount, ...holding }) => holding);
}

function mechanismBullets(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const obj = error as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  const formErrors = Array.isArray(obj.formErrors) ? obj.formErrors.filter(Boolean) : [];
  const fieldErrors = obj.fieldErrors && typeof obj.fieldErrors === "object" ? obj.fieldErrors : {};
  const flattenedFields = Object.entries(fieldErrors)
    .flatMap(([field, msgs]) => (Array.isArray(msgs) ? msgs.map((msg) => `${field}: ${msg}`) : []))
    .filter(Boolean);

  const combined = [...formErrors, ...flattenedFields];
  if (combined.length > 0) {
    return combined.join(" | ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export function SecondOrderEngine() {
  const [statement, setStatement] = useState("");
  const [probabilityPct, setProbabilityPct] = useState(40);
  const [horizonMonths, setHorizonMonths] = useState(36);
  const [selectedModel, setSelectedModel] = useState("gpt-5.2");
  const [holdings, setHoldings] = useState<HoldingInput[]>([emptyHolding()]);
  const [activeTab, setActiveTab] = useState<"causal" | "portfolio" | "recommendations" | "invalidation">("causal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);
  const [observedIndicatorValues, setObservedIndicatorValues] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<ThemeListItem[]>([]);
  const [runTabs, setRunTabs] = useState<"recent" | "previous">("recent");
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [scenarioName, setScenarioName] = useState("Current Portfolio");
  const [scenarioFile, setScenarioFile] = useState<File | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [loadedScenarioId, setLoadedScenarioId] = useState<string | null>(null);
  const [universeVersions, setUniverseVersions] = useState<UniverseVersionListItem[]>([]);
  const [selectedUniverseVersionId, setSelectedUniverseVersionId] = useState<string>("");
  const [universeCsvName, setUniverseCsvName] = useState("Default Universe");
  const [universeCsvFile, setUniverseCsvFile] = useState<File | null>(null);
  const [universeMessage, setUniverseMessage] = useState<string | null>(null);
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [allowWeightOverride, setAllowWeightOverride] = useState(false);
  const [branchOverrides, setBranchOverrides] = useState<Record<BranchName, number>>({
    BASE: 0.5,
    BULL: 0.25,
    BEAR: 0.25
  });

  const validHoldings = useMemo(
    () => holdings.filter((h) => h.name.trim().length > 0),
    [holdings]
  );
  const recommendationItems = useMemo(
    () =>
      (result?.analysis?.assetRecommendations ?? result?.assetRecommendations ?? []).filter((rec) =>
        ["SECOND", "THIRD", "FOURTH"].includes(rec.sourceLayer)
      ),
    [result]
  );
  const localWeightSummary = useMemo(() => {
    const explicit = holdings.filter((h) => typeof h.weight === "number");
    const sum = explicit.reduce((acc, h) => acc + (h.weight ?? 0), 0);
    return {
      hasWeights: explicit.length > 0,
      sumPct: sum,
      outOfRange: explicit.length > 0 && (sum < 98 || sum > 102)
    };
  }, [holdings]);

  const fetchHistory = async () => {
    const res = await fetch("/api/themes?page=1&pageSize=15");
    if (!res.ok) return;
    const json = (await res.json()) as { items: ThemeListItem[] };
    setHistory(json.items);
  };

  const fetchScenarios = async () => {
    const res = await fetch("/api/scenarios");
    if (!res.ok) return;
    const json = (await res.json()) as { items: ScenarioRecord[] };
    setScenarios(json.items);
  };

  const fetchUniverseVersions = async () => {
    const res = await fetch("/api/universe");
    if (!res.ok) return;
    const json = (await res.json()) as { items: UniverseVersionListItem[] };
    setUniverseVersions(json.items);
    if (!selectedUniverseVersionId && json.items[0]?.id) {
      setSelectedUniverseVersionId(json.items[0].id);
    }
  };

  useEffect(() => {
    void fetchHistory();
    void fetchScenarios();
    void fetchUniverseVersions();
  }, []);

  const updateHolding = (idx: number, patch: Partial<HoldingInput>) => {
    setHoldings((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const uploadUniverseCsv = async () => {
    setUniverseError(null);
    setUniverseMessage(null);
    if (!universeCsvFile) {
      setUniverseError("Select a universe CSV file first.");
      return;
    }
    try {
      const csvText = await universeCsvFile.text();
      const res = await fetch("/api/universe/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: universeCsvName.trim() || "Default Universe",
          csvText
        })
      });
      const json = (await res.json()) as { ok?: boolean; error?: unknown; version?: UniverseVersionListItem };
      if (!res.ok || !json.ok || !json.version) {
        throw new Error(formatApiError(json.error, `Universe upload failed (${res.status})`));
      }
      setUniverseMessage(`Uploaded universe: ${json.version.name}`);
      setUniverseCsvFile(null);
      await fetchUniverseVersions();
      setSelectedUniverseVersionId(json.version.id);
    } catch (uploadError) {
      setUniverseError(uploadError instanceof Error ? uploadError.message : "Universe upload failed.");
    }
  };

  const loadScenario = (scenario: ScenarioRecord) => {
    setHoldings(
      scenario.holdings.map((holding) => ({
        name: holding.name,
        ticker: holding.ticker ?? "",
        weight: toPercentWeight(holding.weight),
        sensitivity: holding.sensitivity,
        constraint: holding.constraint ?? "FREE",
        purpose: holding.purpose ?? "LONG_TERM_GROWTH",
        exposureTags: Array.isArray(holding.exposureTags) ? holding.exposureTags : []
      }))
    );
    setLoadedScenarioId(scenario.id);
    setScenarioMessage(`Loaded scenario: ${scenario.name}`);
    setScenarioError(null);
  };

  const clearScenario = () => {
    setHoldings([emptyHolding()]);
    setLoadedScenarioId(null);
    setScenarioMessage(null);
    setScenarioError(null);
  };

  const saveScenarioFromCsv = async () => {
    setScenarioError(null);
    setScenarioMessage(null);

    if (!scenarioName.trim()) {
      setScenarioError("Enter a scenario name before uploading.");
      return;
    }
    if (!scenarioFile) {
      setScenarioError("Select a CSV file first.");
      return;
    }

    try {
      const text = await scenarioFile.text();
      const parsedHoldings = parsePortfolioCsv(text);
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scenarioName.trim(),
          holdings: parsedHoldings.map((holding) => ({
            ...holding,
            weight: toDecimalWeight(holding.weight)
          }))
        })
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: unknown;
        scenario?: ScenarioRecord;
      };

      if (!res.ok || !json.ok || !json.scenario) {
        throw new Error(formatApiError(json.error, `Scenario save failed (${res.status})`));
      }

      setScenarioMessage(`Saved scenario: ${json.scenario.name}`);
      setScenarioFile(null);
      await fetchScenarios();
      loadScenario(json.scenario);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "Could not save scenario.");
    }
  };

  const submit = async () => {
    setError(null);
    setLoading(true);

    try {
      const payload = {
        statement,
        probability: probabilityPct / 100,
        horizonMonths,
        modelName: selectedModel,
        branchMode: "MODEL_SUGGESTS_USER_OVERRIDES",
        allowWeightOverride,
        universeVersionId: selectedUniverseVersionId || undefined,
        branchOverrides: (["BASE", "BULL", "BEAR"] as const).map((name) => ({
          name,
          probability: Math.max(0, branchOverrides[name] / 100)
        })),
        holdings: validHoldings.map((h) => ({
          ...h,
          weight: Number.isFinite(h.weight) ? toDecimalWeight(h.weight) : undefined,
          exposureTags: h.exposureTags
        }))
      };

      const res = await fetch("/api/themes/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = (await res.json()) as AnalysisResponse;
      if (!res.ok || !json.ok) {
        const message = formatApiError(
          json.error,
          json.message ?? `Analyze request failed (${res.status})`
        );
        throw new Error(message);
      }

      setResult(json);
      if (json.themeId) {
        await loadTheme(json.themeId);
      }
      setActiveTab("causal");
      await fetchHistory();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const loadTheme = async (themeId: string) => {
    const res = await fetch(`/api/themes/${themeId}`);
    if (!res.ok) {
      return;
    }

    const json = (await res.json()) as {
      id: string;
      statement: string;
      probability: number;
      horizonMonths: number;
      effects: Array<{ layer: "FIRST" | "SECOND" | "THIRD" | "FOURTH"; description: string; impactDirection: Impact; confidence: Confidence }>;
      holdings: Array<{
        name: string;
        ticker?: string;
        weight?: number;
        sensitivity: Sensitivity;
        constraint: HoldingConstraint;
        purpose: HoldingPurpose;
        exposureTags: string[];
      }>;
      portfolioMappings: Array<{ exposureType: string; netImpact: Impact; mechanism: string; confidence: Confidence; holding: { name: string } }>;
      invalidationItems: Array<{ id: string; assumption: string; breakpointSignal: string; indicatorName: string; latestStatus: IndicatorStatus; latestNote?: string }>;
      runSnapshots: Array<{ computedBiasScore: number; biasLabel: string }>;
      assetRecommendations: AssetRecommendation[];
      branches?: Array<{ name: BranchName; probability: number; rationale: string }>;
      nodeShocks?: Array<{
        branchName: BranchName;
        nodeKey: string;
        nodeLabel: string;
        direction: "UP" | "DOWN" | "FLAT";
        magnitudePct: number;
        strength: "WEAK" | "MED" | "STRONG";
        lag: "IMMEDIATE" | "M3_6" | "M6_18" | "M18_PLUS";
        confidence: Confidence;
        evidenceNote: string;
      }>;
      recommendations?: AnalysisResponse["recommendations"];
      decisionSummary?: AnalysisResponse["decisionSummary"];
      exposureContributions?: AnalysisResponse["exposureContributions"];
      portfolioValidation?: AnalysisResponse["portfolioValidation"];
    };

    setStatement(json.statement);
    setProbabilityPct(Math.round(json.probability * 100));
    setHorizonMonths(json.horizonMonths);
    setHoldings(
      json.holdings.map((h) => ({
        name: h.name,
        ticker: h.ticker ?? "",
        weight: toPercentWeight(h.weight),
        sensitivity: h.sensitivity,
        constraint: h.constraint ?? "FREE",
        purpose: h.purpose ?? "LONG_TERM_GROWTH",
        exposureTags: h.exposureTags
      }))
    );

    const layerMap = {
      first: json.effects.filter((e) => e.layer === "FIRST"),
      second: json.effects.filter((e) => e.layer === "SECOND"),
      third: json.effects.filter((e) => e.layer === "THIRD"),
      fourth: json.effects.filter((e) => e.layer === "FOURTH")
    };

    setResult({
      ok: true,
      themeId: json.id,
      bias: {
        portfolioBias: json.runSnapshots[0]?.computedBiasScore ?? 0,
        biasLabel: json.runSnapshots[0]?.biasLabel ?? "NEUTRAL",
        contributions: []
      },
      analysis: {
        effectsByLayer: layerMap,
        assumptions: json.invalidationItems.map((item) => ({
          assumption: item.assumption,
          breakpointSignal: item.breakpointSignal
        })),
        leadingIndicators: json.invalidationItems.map((item) => ({
          name: item.indicatorName,
          rationale: item.latestNote ?? ""
        })),
        holdingMappings: json.portfolioMappings.map((m) => ({
          holdingName: m.holding.name,
          exposureType: m.exposureType,
          netImpact: m.netImpact,
          mechanism: m.mechanism,
          confidence: m.confidence
        })),
        assetRecommendations: json.assetRecommendations
      },
      assetRecommendations: json.assetRecommendations,
      branches: json.branches,
      nodeShocks: json.nodeShocks,
      recommendations: json.recommendations,
      decisionSummary: json.decisionSummary,
      exposureContributions: json.exposureContributions,
      portfolioValidation: json.portfolioValidation
    });

    setIndicators(
      json.invalidationItems.map((item) => ({
        id: item.id,
        assumption: item.assumption,
        breakpointSignal: item.breakpointSignal,
        indicatorName: item.indicatorName,
        latestStatus: item.latestStatus,
        latestNote: item.latestNote
      }))
    );
  };

  const updateIndicator = async (
    idx: number,
    nextStatus: IndicatorStatus,
    nextNote: string,
    observedValue?: number
  ) => {
    const indicator = indicators[idx];
    if (!indicator) {
      return;
    }

    const optimistic = [...indicators];
    optimistic[idx] = { ...indicator, latestStatus: nextStatus, latestNote: nextNote };
    setIndicators(optimistic);

    if (!indicator.id) {
      return;
    }

    await fetch(`/api/invalidation/${indicator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latestStatus: nextStatus, latestNote: nextNote, observedValue })
    });
  };

  return (
    <section className="grid" style={{ gap: 16 }}>
      <div className="panel grid" style={{ gap: 8 }}>
        <h3>Recent Runs</h3>
        {history.length === 0 ? (
          <p className="muted">No prior runs yet.</p>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={runTabs === "recent" ? "" : "secondary"} onClick={() => setRunTabs("recent")}>
                Recent (3)
              </button>
              <button
                type="button"
                className={runTabs === "previous" ? "" : "secondary"}
                onClick={() => setRunTabs("previous")}
              >
                Previous
              </button>
            </div>
            {(runTabs === "recent" ? history.slice(0, 3) : history.slice(3)).length === 0 ? (
              <p className="muted">
                {runTabs === "recent" ? "No recent runs available." : "No previous runs available."}
              </p>
            ) : (
              (runTabs === "recent" ? history.slice(0, 3) : history.slice(3)).map((item) => (
                <button
                  key={item.id}
                  className={`run-card ${biasToneClass(item.runSnapshots[0]?.biasLabel ?? "NEUTRAL")}`}
                  type="button"
                  onClick={() => loadTheme(item.id)}
                  style={{ textAlign: "left" }}
                >
                  <strong>{item.statement}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(item.createdAt).toLocaleString()} |{" "}
                  <span className={`badge ${biasToneClass(item.runSnapshots[0]?.biasLabel ?? "NEUTRAL")}`}>
                    {item.runSnapshots[0]?.biasLabel ?? "NEUTRAL"}
                  </span>
                  {" | "}
                  <span className="badge tone-neutral">{item.runStatus ?? "UNASSESSED"}</span>
                </div>
              </button>
            ))
            )}
          </div>
        )}
      </div>

      <div className="panel grid" style={{ gap: 10 }}>
        <h3>Portfolio Scenarios</h3>
        <div className="grid grid-2">
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="scenario-name">Scenario name</label>
            <input
              id="scenario-name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Current Portfolio"
            />
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="scenario-csv">Upload CSV</label>
            <input
              id="scenario-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setScenarioFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={saveScenarioFromCsv}>
            Save Scenario From CSV
          </button>
        </div>
        {scenarioError && <p className="error">{scenarioError}</p>}
        {scenarioMessage && <p className="muted">{scenarioMessage}</p>}
        <div className="grid" style={{ gap: 8 }}>
          {scenarios.length === 0 ? (
            <p className="muted">No saved portfolio scenarios yet.</p>
          ) : (
            scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="secondary"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px" }}
              >
                <button
                  type="button"
                  className="secondary"
                  style={{ textAlign: "left", flex: 1 }}
                  onClick={() => loadScenario(scenario)}
                >
                  <strong>{scenario.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {scenario.holdings.length} holdings | {new Date(scenario.createdAt).toLocaleString()}
                  </div>
                </button>
                {loadedScenarioId === scenario.id && (
                  <button type="button" className="secondary" onClick={clearScenario}>
                    Clear
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
        <h3>Company Universe</h3>
        <div className="grid grid-2">
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="universe-select">Universe version</label>
            <select
              id="universe-select"
              value={selectedUniverseVersionId}
              onChange={(e) => setSelectedUniverseVersionId(e.target.value)}
            >
              <option value="">None selected</option>
              {universeVersions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item._count?.companies ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="universe-name">New universe name</label>
            <input
              id="universe-name"
              value={universeCsvName}
              onChange={(e) => setUniverseCsvName(e.target.value)}
              placeholder="Default Universe"
            />
          </div>
        </div>
        <div className="grid grid-2">
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="universe-csv">Upload universe CSV</label>
            <input
              id="universe-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setUniverseCsvFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={uploadUniverseCsv}>
              Upload Universe CSV
            </button>
          </div>
        </div>
        {universeError ? <p className="error">{universeError}</p> : null}
        {universeMessage ? <p className="muted">{universeMessage}</p> : null}
      </div>

      <div className="panel grid" style={{ gap: 12 }}>
        <div className="grid" style={{ gap: 6 }}>
          <label htmlFor="statement">Structural shift</label>
          <textarea
            id="statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="AI agents reduce the cost of custom software development by 60%."
          />
        </div>

        <div className="grid grid-2">
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="model">OpenAI model</label>
            <select id="model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="probability">Probability ({probabilityPct}%)</label>
            <input
              id="probability"
              type="range"
              min={0}
              max={100}
              value={probabilityPct}
              onChange={(e) => setProbabilityPct(Number(e.target.value))}
            />
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="horizon">Horizon (months)</label>
            <input
              id="horizon"
              type="number"
              min={1}
              max={120}
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="grid grid-2">
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="branch-base">Base probability (%)</label>
            <input
              id="branch-base"
              type="number"
              min={0}
              max={100}
              value={branchOverrides.BASE}
              onChange={(e) => setBranchOverrides((prev) => ({ ...prev, BASE: Number(e.target.value) }))}
            />
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="branch-bull">Bull probability (%)</label>
            <input
              id="branch-bull"
              type="number"
              min={0}
              max={100}
              value={branchOverrides.BULL}
              onChange={(e) => setBranchOverrides((prev) => ({ ...prev, BULL: Number(e.target.value) }))}
            />
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="branch-bear">Bear probability (%)</label>
            <input
              id="branch-bear"
              type="number"
              min={0}
              max={100}
              value={branchOverrides.BEAR}
              onChange={(e) => setBranchOverrides((prev) => ({ ...prev, BEAR: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="grid" style={{ gap: 8 }}>
          <h3>Holdings</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ticker</th>
                <th>Weight (%)</th>
                <th>Sensitivity</th>
                <th>Constraint</th>
                <th>Purpose</th>
                <th>Tags (comma separated)</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding, idx) => (
                <tr key={`holding-${idx}`}>
                  <td>
                    <input
                      aria-label={`holding-name-${idx}`}
                      value={holding.name}
                      onChange={(e) => updateHolding(idx, { name: e.target.value })}
                      placeholder="Holding name"
                    />
                  </td>
                  <td>
                    <input
                      value={holding.ticker ?? ""}
                      onChange={(e) => updateHolding(idx, { ticker: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={holding.weight ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateHolding(idx, { weight: value === "" ? undefined : Number(value) });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={holding.sensitivity}
                      onChange={(e) => updateHolding(idx, { sensitivity: e.target.value as Sensitivity })}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MED">MED</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={holding.constraint}
                      onChange={(e) => updateHolding(idx, { constraint: e.target.value as HoldingConstraint })}
                    >
                      <option value="FREE">FREE</option>
                      <option value="SEMI_LOCKED">SEMI_LOCKED</option>
                      <option value="LOCKED">LOCKED</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={holding.purpose}
                      onChange={(e) => updateHolding(idx, { purpose: e.target.value as HoldingPurpose })}
                    >
                      <option value="LONG_TERM_GROWTH">LONG_TERM_GROWTH</option>
                      <option value="LIFESTYLE_DRAWDOWN">LIFESTYLE_DRAWDOWN</option>
                      <option value="SPEND_12_36M">SPEND_12_36M</option>
                      <option value="SPEND_0_12M">SPEND_0_12M</option>
                      <option value="TAX">TAX</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={holding.exposureTags.join(", ")}
                      onChange={(e) =>
                        updateHolding(idx, {
                          exposureTags: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="secondary"
              type="button"
              onClick={() => setHoldings((prev) => [...prev, emptyHolding()])}
            >
              Add holding
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={
                loading ||
                !statement ||
                validHoldings.length === 0 ||
                (localWeightSummary.outOfRange && !allowWeightOverride)
              }
            >
              {loading ? "Analyzing..." : "Run analysis"}
            </button>
          </div>
          <div className={`panel ${localWeightSummary.outOfRange ? "tone-neg" : "tone-neutral"}`}>
            <p>
              Weight sum: {localWeightSummary.sumPct.toFixed(2)}%
              {!localWeightSummary.hasWeights ? " (equal-weighting fallback)" : ""}
            </p>
            {localWeightSummary.outOfRange ? (
              <p className="error">Weight sum must be close to 100% unless override is enabled.</p>
            ) : null}
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={allowWeightOverride}
                onChange={(e) => setAllowWeightOverride(e.target.checked)}
                style={{ width: 16 }}
              />
              Allow weight-sum override for this run
            </label>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {result?.bias && (
        <div className="panel" data-testid="bias-summary">
          <p>
            <span className={`badge ${biasToneClass(result.bias.biasLabel)}`}>{result.bias.biasLabel}</span> bias score{" "}
            {result.bias.portfolioBias.toFixed(3)}
          </p>
        </div>
      )}

      {result?.decisionSummary && (
        <div className="panel grid" style={{ gap: 8 }}>
          <h3>Decision</h3>
          <p>
            Scenario impact (P10/P50/P90): {result.decisionSummary.portfolioImpactP10.toFixed(3)} /{" "}
            {result.decisionSummary.portfolioImpactP50.toFixed(3)} /{" "}
            {result.decisionSummary.portfolioImpactP90.toFixed(3)}
          </p>
          <p>
            Top Actions: {result.decisionSummary.topActions.join(" | ")}
          </p>
          <p>
            Top Monitors: {result.decisionSummary.topMonitors.join(" | ")}
          </p>
          <p>
            Change My Mind: {result.decisionSummary.changeMyMind.join(" | ")}
          </p>
        </div>
      )}

      {result?.analysis && (
        <div className="panel grid" style={{ gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={activeTab === "causal" ? "" : "secondary"} onClick={() => setActiveTab("causal")}>
              Causal Map
            </button>
            <button className={activeTab === "portfolio" ? "" : "secondary"} onClick={() => setActiveTab("portfolio")}>
              Portfolio Impact
            </button>
            <button
              className={activeTab === "recommendations" ? "" : "secondary"}
              onClick={() => setActiveTab("recommendations")}
            >
              Recommendations
            </button>
            <button
              className={activeTab === "invalidation" ? "" : "secondary"}
              onClick={() => setActiveTab("invalidation")}
            >
              Invalidation
            </button>
          </div>

          {activeTab === "causal" && (
            <div className="grid" style={{ gap: 22 }} data-testid="causal-tab">
              {([
                ["First", "first"],
                ["Second", "second"],
                ["Third", "third"],
                ["Fourth", "fourth"]
              ] as const).map(([label, key]) => (
                <div key={key}>
                  <h3>{label}-order</h3>
                  <ul className="causal-list">
                    {result.analysis?.effectsByLayer[key].map((effect, idx) => (
                      <li key={`${key}-${idx}`}>
                        {effect.description} ({effect.impactDirection}, {effect.confidence})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {result.nodeShocks && result.nodeShocks.length > 0 ? (
                <div>
                  <h3>Branch Node Shocks</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>Node</th>
                        <th>Direction</th>
                        <th>Magnitude</th>
                        <th>Strength</th>
                        <th>Lag</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.nodeShocks.slice(0, 18).map((shock, idx) => (
                        <tr key={`shock-${idx}`}>
                          <td>{shock.branchName}</td>
                          <td>{shock.nodeLabel}</td>
                          <td>{shock.direction}</td>
                          <td>{(shock.magnitudePct * 100).toFixed(1)}%</td>
                          <td>{shock.strength}</td>
                          <td>{shock.lag}</td>
                          <td>{shock.confidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div>
                <h3>Higher-Order Asset Recommendations</h3>
                {recommendationItems.length === 0 ? (
                  <p className="muted">No asset recommendations returned for this theme.</p>
                ) : (
                  <div className="grid" style={{ gap: 14 }}>
                    {(["SECOND", "THIRD", "FOURTH"] as const).map((layer) => {
                      const layerItems = recommendationItems.filter((item) => item.sourceLayer === layer);
                      if (layerItems.length === 0) {
                        return null;
                      }

                      return (
                        <div key={layer} className="panel">
                          <h4>{recommendationLayerLabels[layer]}</h4>
                          <div className="grid" style={{ gap: 10 }}>
                            {layerItems.map((item) => (
                              <div key={`${layer}-${item.assetName}`} className="grid">
                                <p>
                                  <strong>{item.assetName}</strong>
                                  {item.ticker ? ` (${item.ticker})` : ""}
                                  {" · "}
                                  {item.action}
                                  {" · "}
                                  {item.direction}
                                  {" · "}
                                  {item.confidence}
                                </p>
                                <p className="muted" style={{ marginTop: -8 }}>
                                  {item.rationale}
                                </p>
                                <p>{item.mechanism}</p>
                                {item.timeHorizon ? <p className="muted">Horizon: {item.timeHorizon}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "portfolio" && (
            <div className="grid" style={{ gap: 12 }} data-testid="portfolio-tab">
              {result.portfolioValidation ? (
                <div className={`panel ${result.portfolioValidation.errors.length > 0 ? "tone-neg" : "tone-neutral"}`}>
                  <p>Weight sum: {(result.portfolioValidation.weightSum * 100).toFixed(2)}%</p>
                  {result.portfolioValidation.warnings.map((warning, idx) => (
                    <p className="muted" key={`pv-w-${idx}`}>
                      {warning}
                    </p>
                  ))}
                  {result.portfolioValidation.errors.map((errText, idx) => (
                    <p className="error" key={`pv-e-${idx}`}>
                      {errText}
                    </p>
                  ))}
                </div>
              ) : null}
              {result.exposureContributions && result.exposureContributions.length > 0 ? (
                <div className="panel">
                  <h3>Top Contribution Drivers</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Holding</th>
                        <th>Score</th>
                        <th>Weight</th>
                        <th>Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.exposureContributions.slice(0, 8).map((item, idx) => (
                        <tr key={`contrib-${idx}`}>
                          <td>{item.holdingName}</td>
                          <td>{item.score.toFixed(3)}</td>
                          <td>{(item.weight * 100).toFixed(2)}%</td>
                          <td>{item.direction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <table>
                <thead>
                  <tr>
                    <th>Holding</th>
                    <th>Exposure Type</th>
                    <th>Impact</th>
                    <th>Confidence</th>
                    <th>Mechanism</th>
                  </tr>
                </thead>
                <tbody>
                  {result.analysis.holdingMappings.map((mapping, idx) => (
                    <tr key={`mapping-${idx}`} className={impactToneClass(mapping.netImpact)}>
                      <td>{mapping.holdingName}</td>
                      <td>{mapping.exposureType}</td>
                      <td>{mapping.netImpact}</td>
                      <td>{mapping.confidence}</td>
                      <td>
                        <ul className="mechanism-list">
                          {mechanismBullets(mapping.mechanism).map((bullet, bulletIndex) => (
                            <li key={`mechanism-${idx}-${bulletIndex}`} className="mechanism-text">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className="grid" style={{ gap: 10 }} data-testid="recommendations-tab">
              {!result.recommendations || result.recommendations.length === 0 ? (
                <p className="muted">No ranked expressions available. Upload a universe CSV to enable this.</p>
              ) : (
                result.recommendations.map((recommendation, idx) => (
                  <div className="panel grid" style={{ gap: 6 }} key={`rec-${idx}`}>
                    <p>
                      <strong>{recommendation.symbol}</strong> ({recommendation.name}) | {recommendation.action} |{" "}
                      {recommendation.direction} | {recommendation.sizingBand} | max {(recommendation.maxPositionPct * 100).toFixed(2)}%
                    </p>
                    <p className="muted">Role: {recommendation.portfolioRole}</p>
                    <p>{recommendation.mechanism}</p>
                    <p className="muted">Catalyst: {recommendation.catalystWindow}</p>
                    <p className="muted">Risk: {recommendation.riskNote}</p>
                    <p className="muted">Invalidation: {recommendation.invalidationTrigger}</p>
                    <p className={`badge ${recommendation.actionable ? "tone-pos" : "tone-neutral"}`}>
                      {recommendation.actionable ? "Actionable" : "Non-actionable"}
                      {recommendation.alreadyExpressed ? " | Already expressed" : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "invalidation" && (
            <div className="grid" style={{ gap: 10 }} data-testid="invalidation-tab">
              {indicators.map((item, idx) => (
                <div className="panel" style={{ padding: 12 }} key={`indicator-${idx}`}>
                  <p>
                    <strong>Assumption:</strong> {item.assumption}
                  </p>
                  <p>
                    <strong>Breakpoint:</strong> {item.breakpointSignal}
                  </p>
                  <p>
                    <strong>Indicator:</strong> {item.indicatorName}
                  </p>
                  <div className="grid grid-2">
                    <select
                      value={item.latestStatus}
                      onChange={(e) => updateIndicator(idx, e.target.value as IndicatorStatus, item.latestNote ?? "")}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      value={item.latestNote ?? ""}
                      onChange={(e) => updateIndicator(idx, item.latestStatus, e.target.value)}
                      placeholder="Manual note"
                    />
                  </div>
                  <div className="grid grid-2">
                    <input
                      type="number"
                      placeholder="Observed value (optional)"
                      value={observedIndicatorValues[item.id ?? String(idx)] ?? ""}
                      onChange={(e) =>
                        setObservedIndicatorValues((prev) => ({
                          ...prev,
                          [item.id ?? String(idx)]: e.target.value
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const raw = observedIndicatorValues[item.id ?? String(idx)];
                        const observed = raw === undefined || raw === "" ? undefined : Number(raw);
                        void updateIndicator(idx, item.latestStatus, item.latestNote ?? "", observed);
                      }}
                    >
                      Apply Observed Value
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
