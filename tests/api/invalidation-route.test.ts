import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));
vi.mock("@/lib/authz", () => ({ requireAuth }));

const { invalidationUpdate, invalidationFind } = vi.hoisted(() => ({
  invalidationUpdate: vi.fn().mockResolvedValue({ id: "inv-1", latestStatus: "GREEN" }),
  invalidationFind: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invalidationItem: {
      findUnique: invalidationFind,
      update: invalidationUpdate
    }
  }
}));

import { PATCH } from "@/app/api/invalidation/[id]/route";

describe("PATCH /api/invalidation/:id", () => {
  it("updates item", async () => {
    requireAuth.mockResolvedValue("user-1");
    invalidationFind.mockResolvedValue({ id: "inv-1", theme: { userId: "user-1" } });

    const response = await PATCH(
      new Request("http://localhost/api/invalidation/inv-1", {
        method: "PATCH",
        body: JSON.stringify({ latestStatus: "GREEN", latestNote: "Trend stable" })
      }),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(invalidationFind).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      include: { theme: { select: { userId: true } } }
    });
  });

  it("returns 404 when item not owned", async () => {
    requireAuth.mockResolvedValue("user-1");
    invalidationFind.mockResolvedValue({ id: "inv-2", theme: { userId: "other-user" } });

    const response = await PATCH(
      new Request("http://localhost/api/invalidation/inv-2", {
        method: "PATCH",
        body: JSON.stringify({ latestStatus: "RED" })
      }),
      { params: Promise.resolve({ id: "inv-2" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuth.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/invalidation/inv-3", {
        method: "PATCH",
        body: JSON.stringify({ latestStatus: "RED" })
      }),
      { params: Promise.resolve({ id: "inv-3" }) }
    );

    expect(response.status).toBe(401);
  });
});
