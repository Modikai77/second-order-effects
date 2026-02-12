"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";

type Sensitivity = "LOW" | "MED" | "HIGH";
type Impact = "POS" | "NEG" | "MIXED" | "UNCERTAIN";
type Confidence = "LOW" | "MED" | "HIGH";
type IndicatorStatus = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

type HoldingInput = {
  name: string;
  ticker?: string;
  weight?: number;
  sensitivity: Sensitivity;
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
    effectsByLayer: Record<"first" | "second" | "third" | "fourth", Array<{ description: string; impactDirection: Impact; confidence: Confidence }>>;
    holdingMappings: Array<{ holdingName: string; exposureType: string; netImpact: Impact; mechanism: string; confidence: Confidence }>;
    assumptions: Array<{ assumption: string; breakpointSignal: string }>;
    leadingIndicators: Array<{ name: string; rationale: string }>;
  };
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
    exposureTags: string[];
  }>;
};

const statusOptions: IndicatorStatus[] = ["UNKNOWN", "GREEN", "YELLOW", "RED"];

const emptyHolding = (): HoldingInput => ({
  name: "",
  ticker: "",
  sensitivity: "MED",
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
    const cleaned = value.replace(/[£$,]/g, "").replace(/\s+/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
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

    const rawTags = tagsIdx >= 0 ? cells[tagsIdx] ?? "" : "";
    const exposureTags = rawTags
      .split(/[|;]+/)
      .flatMap((part) => part.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    staged.push({
      name,
      ticker: tickerIdx >= 0 ? cells[tickerIdx]?.trim() : undefined,
      weight: Number.isFinite(parsedWeight) ? toPercentWeight(parsedWeight) : undefined,
      sensitivity,
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
        holding.weight = Number((((holding._rawAmount as number) / totalAmount) * 100).toFixed(2));
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
  const [holdings, setHoldings] = useState<HoldingInput[]>([emptyHolding()]);
  const [activeTab, setActiveTab] = useState<"causal" | "portfolio" | "invalidation">("causal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);
  const [history, setHistory] = useState<ThemeListItem[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [scenarioName, setScenarioName] = useState("Current Portfolio");
  const [scenarioFile, setScenarioFile] = useState<File | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);

  const validHoldings = useMemo(
    () => holdings.filter((h) => h.name.trim().length > 0),
    [holdings]
  );

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

  useEffect(() => {
    void fetchHistory();
    void fetchScenarios();
  }, []);

  const updateHolding = (idx: number, patch: Partial<HoldingInput>) => {
    setHoldings((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const loadScenario = (scenario: ScenarioRecord) => {
    setHoldings(
      scenario.holdings.map((holding) => ({
        name: holding.name,
        ticker: holding.ticker ?? "",
        weight: toPercentWeight(holding.weight),
        sensitivity: holding.sensitivity,
        exposureTags: Array.isArray(holding.exposureTags) ? holding.exposureTags : []
      }))
    );
    setScenarioMessage(`Loaded scenario: ${scenario.name}`);
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
      holdings: Array<{ name: string; ticker?: string; weight?: number; sensitivity: Sensitivity; exposureTags: string[] }>;
      portfolioMappings: Array<{ exposureType: string; netImpact: Impact; mechanism: string; confidence: Confidence; holding: { name: string } }>;
      invalidationItems: Array<{ id: string; assumption: string; breakpointSignal: string; indicatorName: string; latestStatus: IndicatorStatus; latestNote?: string }>;
      runSnapshots: Array<{ computedBiasScore: number; biasLabel: string }>;
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
        }))
      }
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

  const updateIndicator = async (idx: number, nextStatus: IndicatorStatus, nextNote: string) => {
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
      body: JSON.stringify({ latestStatus: nextStatus, latestNote: nextNote })
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
            {history.map((item) => (
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
                </div>
              </button>
            ))}
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
              <button
                key={scenario.id}
                type="button"
                className="secondary"
                style={{ textAlign: "left" }}
                onClick={() => loadScenario(scenario)}
              >
                <strong>{scenario.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {scenario.holdings.length} holdings | {new Date(scenario.createdAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
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

        <div className="grid" style={{ gap: 8 }}>
          <h3>Holdings</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ticker</th>
                <th>Weight (%)</th>
                <th>Sensitivity</th>
                <th>Tags (comma separated)</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding, idx) => (
                <tr key={`holding-${idx}`}>
                  <td>
                    <input
                      value={holding.name}
                      onChange={(e) => updateHolding(idx, { name: e.target.value })}
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
              disabled={loading || !statement || validHoldings.length === 0}
            >
              {loading ? "Analyzing..." : "Run analysis"}
            </button>
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
            </div>
          )}

          {activeTab === "portfolio" && (
            <div data-testid="portfolio-tab">
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
