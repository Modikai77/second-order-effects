import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const create = vi.fn();
const createMany = vi.fn();
const findUniqueOrThrow = vi.fn();

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
  });

  it("lists scenarios", async () => {
    findMany.mockResolvedValue([{ id: "s1", name: "Current", holdings: [] }]);

    const res = await GET();
    expect(res.status).toBe(200);
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
    expect(createMany).toHaveBeenCalled();
  });
});
