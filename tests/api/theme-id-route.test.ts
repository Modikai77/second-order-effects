import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));

vi.mock("@/lib/authz", () => ({ requireAuth }));

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    theme: {
      findUnique
    }
  }
}));

import { GET } from "@/app/api/themes/[id]/route";

describe("GET /api/themes/[id]", () => {
  it("returns asset recommendations from structured snapshot output", async () => {
    requireAuth.mockResolvedValue("user-1");
    findUnique.mockResolvedValue({
      id: "theme-1",
      statement: "AI agents lower software costs",
      probability: 0.4,
      horizonMonths: 36,
      effects: [],
      holdings: [],
      portfolioMappings: [],
      invalidationItems: [],
      branches: [],
      recommendations: [],
      indicatorDefinitions: [],
      runSnapshots: [
        {
          rawOutputJson: {
            output: {
              assetRecommendations: [
                {
                  assetName: "AI ETF",
                  assetCategory: "ETF",
                  sourceLayer: "THIRD",
                  direction: "POS",
                  action: "OVERWEIGHT",
                  rationale: "Rising demand for infrastructure.",
                  confidence: "HIGH",
                  mechanism: "AI infra demand rises."
                }
              ]
            }
          }
        }
      ]
    });

    const response = await GET(new Request("http://localhost/api/themes/theme-1"), {
      params: Promise.resolve({ id: "theme-1" })
    });
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.assetRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetName: "AI ETF",
          sourceLayer: "THIRD"
        })
      ])
    );
  });

  it("returns empty recommendations for legacy snapshots", async () => {
    requireAuth.mockResolvedValue("user-1");
    findUnique.mockResolvedValue({
      id: "theme-1",
      statement: "legacy",
      probability: 0.3,
      horizonMonths: 24,
      effects: [],
      holdings: [],
      portfolioMappings: [],
      invalidationItems: [],
      branches: [],
      recommendations: [],
      indicatorDefinitions: [],
      runSnapshots: [{ rawOutputJson: { output_text: "{\"foo\":\"bar\"}" } }]
    });

    const response = await GET(new Request("http://localhost/api/themes/theme-1"), {
      params: Promise.resolve({ id: "theme-1" })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assetRecommendations).toHaveLength(0);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/themes/theme-1"), {
      params: Promise.resolve({ id: "theme-1" })
    });
    expect(response.status).toBe(401);
  });
});
