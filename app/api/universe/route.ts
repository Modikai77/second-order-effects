import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(request: Request) {
  const userId = await requireAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");

  if (versionId) {
    const version = await prisma.companyUniverseVersion.findUnique({
      where: { id: versionId },
      include: { companies: true }
    });
    if (!version || version.userId !== userId) {
      return NextResponse.json({ error: "Universe version not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  }

  const items = await prisma.companyUniverseVersion.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { companies: true }
      }
    }
  });

  return NextResponse.json({ items });
}
