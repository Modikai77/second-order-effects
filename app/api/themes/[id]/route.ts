import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { extractAssetRecommendationsFromSnapshot } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await requireAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const theme = await prisma.theme.findUnique({
    where: { id, userId },
    include: {
      effects: { orderBy: [{ layer: "asc" }, { orderIndex: "asc" }] },
      holdings: true,
      portfolioMappings: {
        include: {
          holding: true
        }
      },
      invalidationItems: true,
      runSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!theme) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const latestSnapshot = theme.runSnapshots[0];
  const assetRecommendations = extractAssetRecommendationsFromSnapshot(latestSnapshot?.rawOutputJson as unknown);

  return NextResponse.json({
    ...theme,
    assetRecommendations
  });
}
