import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));

const { txVersionCreate, txExposureCreateMany, txVersionFindUniqueOrThrow } = vi.hoisted(() => ({
  txVersionCreate: vi.fn(),
  txExposureCreateMany: vi.fn(),
  txVersionFindUniqueOrThrow: vi.fn()
}));

vi.mock("@/lib/authz", () => ({ requireAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) =>
      callback({
        companyUniverseVersion: {
          create: txVersionCreate,
          findUniqueOrThrow: txVersionFindUniqueOrThrow
        },
        companyExposure: {
          createMany: txExposureCreateMany
        }
      })
    )
  }
}));

import { POST } from "@/app/api/universe/upload/route";

describe("POST /api/universe/upload", () => {
  it("creates version and exposures", async () => {
    requireAuth.mockResolvedValue("user-1");
    txVersionCreate.mockResolvedValue({ id: "version-1" });
    txVersionFindUniqueOrThrow.mockResolvedValue({
      id: "version-1",
      name: "Core Universe",
      companies: [{ id: "c1", symbol: "NVDA" }]
    });

    const response = await POST(
      new Request("http://localhost/api/universe/upload", {
        method: "POST",
        body: JSON.stringify({
          name: "Core Universe",
          csvText: "symbol,company_name,asset_type,liquidity_class,exp_ai\nNVDA,NVIDIA,EQUITY,daily,0.9"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuth.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/universe/upload", {
        method: "POST",
        body: JSON.stringify({
          name: "Core Universe",
          csvText: "symbol,company_name,asset_type,liquidity_class,exp_ai\nNVDA,NVIDIA,EQUITY,daily,0.9"
        })
      })
    );
    expect(response.status).toBe(401);
  });
});
