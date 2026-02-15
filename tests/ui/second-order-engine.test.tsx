import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecondOrderEngine } from "@/components/second-order-engine";
import React from "react";

describe("SecondOrderEngine", () => {
  it("submits and renders tabs/results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/themes?page=1")) {
        return {
          ok: true,
          json: async () => ({ items: [] })
        };
      }
      if (url.includes("/api/scenarios")) {
        return {
          ok: true,
          json: async () => ({ items: [] })
        };
      }
      if (url.includes("/api/themes/analyze")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            themeId: "theme-1",
            bias: {
              portfolioBias: 0.31,
              biasLabel: "POS",
              contributions: [{ holdingName: "Infra", score: 0.31, weight: 1 }]
            },
            analysis: {
              effectsByLayer: {
                first: [{ description: "A", impactDirection: "POS", confidence: "MED" }],
                second: [{ description: "B", impactDirection: "NEG", confidence: "MED" }],
                third: [],
                fourth: []
              },
              assumptions: [{ assumption: "x", breakpointSignal: "y" }],
              leadingIndicators: [{ name: "z", rationale: "r" }],
              holdingMappings: [
                {
                  holdingName: "Infra",
                  exposureType: "Compute",
                  netImpact: "POS",
                  mechanism: "Capex",
                  confidence: "MED"
                }
              ],
              assetRecommendations: [
                {
                  assetName: "AI Infrastructure ETF",
                  assetCategory: "ETF",
                  sourceLayer: "THIRD",
                  direction: "POS",
                  action: "OVERWEIGHT",
                  rationale: "Rising AI workloads increase usage.",
                  confidence: "HIGH",
                  mechanism: "Higher AI platform demand."
                }
              ]
            }
          })
        };
      }
      if (url.includes("/api/themes/theme-1")) {
        return {
          ok: true,
          json: async () => ({
            id: "theme-1",
            statement: "AI agents reduce costs materially.",
            probability: 0.4,
            horizonMonths: 36,
            effects: [
              { layer: "FIRST", description: "A", impactDirection: "POS", confidence: "MED" },
              { layer: "SECOND", description: "B", impactDirection: "NEG", confidence: "MED" }
            ],
            holdings: [{ name: "Infra", sensitivity: "MED", exposureTags: [] }],
            portfolioMappings: [
              {
                exposureType: "Compute",
                netImpact: "POS",
                mechanism: "Capex",
                confidence: "MED",
                holding: { name: "Infra" }
              }
            ],
            assetRecommendations: [
              {
                assetName: "AI Infrastructure ETF",
                assetCategory: "ETF",
                sourceLayer: "THIRD",
                direction: "POS",
                action: "OVERWEIGHT",
                rationale: "Rising AI workloads increase usage.",
                confidence: "HIGH",
                mechanism: "Higher AI platform demand."
              }
            ],
            invalidationItems: [
              {
                id: "inv-1",
                assumption: "x",
                breakpointSignal: "y",
                indicatorName: "z",
                latestStatus: "UNKNOWN",
                latestNote: "r"
              }
            ],
            runSnapshots: [{ computedBiasScore: 0.31, biasLabel: "POS" }]
          })
        };
      }
      if (url.includes("/api/invalidation/")) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SecondOrderEngine />);

    await userEvent.type(screen.getByLabelText("Structural shift"), "AI agents reduce costs materially.");
    await userEvent.type(screen.getByLabelText("holding-name-0"), "Infra");

    await userEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    await waitFor(() => expect(screen.getByTestId("bias-summary")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Portfolio Impact" }));
    expect(screen.getByTestId("portfolio-tab")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Causal Map" }));
    expect(screen.getByText("Higher-Order Asset Recommendations")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Invalidation" }));
    expect(screen.getByTestId("invalidation-tab")).toBeInTheDocument();
  });
});
