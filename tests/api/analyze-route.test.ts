import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));

vi.mock("@/lib/authz", () => ({ requireAuth }));
vi.mock("@/lib/analysis-service", () => ({
  analyzeAndPersist: vi.fn()
}));

import { POST } from "@/app/api/themes/analyze/route";
import { analyzeAndPersist } from "@/lib/analysis-service";

describe("POST /api/themes/analyze", () => {
  it("returns success payload", async () => {
    requireAuth.mockResolvedValue("user-1");
    vi.mocked(analyzeAndPersist).mockResolvedValueOnce({
      ok: true,
      themeId: "theme-1",
      bias: { portfolioBias: 0.3, biasLabel: "POS", contributions: [] },
      analysis: {
        effectsByLayer: { first: [], second: [], third: [], fourth: [] },
        assetRecommendations: [],
        assumptions: [],
        leadingIndicators: [],
        holdingMappings: []
      }
    });

    const response = await POST(
      new Request("http://localhost/api/themes/analyze", {
        method: "POST",
        body: JSON.stringify({
          statement: "AI shift",
          probability: 0.4,
          horizonMonths: 24,
          holdings: [{ name: "Infra", sensitivity: "MED", exposureTags: [] }]
        })
      })
    );

    expect(analyzeAndPersist).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(response.status).toBe(200);
  });

  it("returns 422 on partial failure", async () => {
    requireAuth.mockResolvedValue("user-1");
    vi.mocked(analyzeAndPersist).mockResolvedValueOnce({
      ok: false,
      themeId: "theme-2",
      error: "validation error"
    });

    const response = await POST(
      new Request("http://localhost/api/themes/analyze", {
        method: "POST",
        body: JSON.stringify({
          statement: "AI shift",
          probability: 0.4,
          horizonMonths: 24,
          holdings: [{ name: "Infra", sensitivity: "MED", exposureTags: [] }]
        })
      })
    );

    expect(response.status).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuth.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/themes/analyze", {
        method: "POST",
        body: JSON.stringify({
          statement: "AI shift",
          probability: 0.4,
          horizonMonths: 24,
          holdings: [{ name: "Infra", sensitivity: "MED", exposureTags: [] }]
        })
      })
    );

    expect(response.status).toBe(401);
  });
});
