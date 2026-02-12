import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invalidationItem: {
      update: vi.fn().mockResolvedValue({ id: "inv-1", latestStatus: "GREEN" })
    }
  }
}));

import { PATCH } from "@/app/api/invalidation/[id]/route";

describe("PATCH /api/invalidation/:id", () => {
  it("updates item", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/invalidation/inv-1", {
        method: "PATCH",
        body: JSON.stringify({ latestStatus: "GREEN", latestNote: "Trend stable" })
      }),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(200);
  });
});
