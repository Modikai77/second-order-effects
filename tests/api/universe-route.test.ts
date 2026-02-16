import { describe, expect, it, vi } from "vitest";

const { requireAuth } = vi.hoisted(() => ({
  requireAuth: vi.fn()
}));

const {
  companyUniverseVersionFindMany,
  companyUniverseVersionFindUnique
} = vi.hoisted(() => ({
  companyUniverseVersionFindMany: vi.fn(),
  companyUniverseVersionFindUnique: vi.fn()
}));

vi.mock("@/lib/authz", () => ({ requireAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyUniverseVersion: {
      findMany: companyUniverseVersionFindMany,
      findUnique: companyUniverseVersionFindUnique
    }
  }
}));

import { GET } from "@/app/api/universe/route";

describe("GET /api/universe", () => {
  it("returns list for authenticated user", async () => {
    requireAuth.mockResolvedValue("user-1");
    companyUniverseVersionFindMany.mockResolvedValue([{ id: "u1", name: "Core Universe", _count: { companies: 3 } }]);

    const response = await GET(new Request("http://localhost/api/universe"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
  });

  it("returns 404 for foreign version lookup", async () => {
    requireAuth.mockResolvedValue("user-1");
    companyUniverseVersionFindUnique.mockResolvedValue({ id: "v1", userId: "other-user" });

    const response = await GET(new Request("http://localhost/api/universe?versionId=v1"));
    expect(response.status).toBe(404);
  });
});
