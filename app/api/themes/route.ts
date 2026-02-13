import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(request: Request) {
  const userId = await requireAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 10;
  const where = { userId };

  const [items, total] = await Promise.all([
    prisma.theme.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: {
        runSnapshots: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.theme.count({ where })
  ]);

  return NextResponse.json({
    page: safePage,
    pageSize: safePageSize,
    total,
    items
  });
}
