import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));

vi.mock("@/lib/authz", () => ({ requireAuth }));

const { findMany, create, createMany, findUniqueOrThrow } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  findUniqueOrThrow: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolioScenario: {
      findMany,
      findUniqueOrThrow
    },
    $transaction: vi.fn(async (callback) =>
      callback({
        portfolioScenario: { create, findUniqueOrThrow },
        scenarioHolding: { createMany }
      })
    )
  }
}));

import { GET, POST } from "@/app/api/scenarios/route";

describe("/api/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue("user-1");
  });

  it("lists scenarios", async () => {
    findMany.mockResolvedValue([{ id: "s1", name: "Current", holdings: [] }]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" }
      })
    );
  });

  it("creates scenario", async () => {
    create.mockResolvedValue({ id: "s1" });
    findUniqueOrThrow.mockResolvedValue({ id: "s1", name: "Current", holdings: [] });

    const res = await POST(
      new Request("http://localhost/api/scenarios", {
        method: "POST",
        body: JSON.stringify({
          name: "Current",
          holdings: [{ name: "Infra", sensitivity: "MED", exposureTags: [] }]
        })
      })
    );

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1" })
      })
    );
    expect(createMany).toHaveBeenCalled();
  });

  it("returns 401 without session", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });
});
