import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 10;

  const [items, total] = await Promise.all([
    prisma.theme.findMany({
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
    prisma.theme.count()
  ]);

  return NextResponse.json({
    page: safePage,
    pageSize: safePageSize,
    total,
    items
  });
}
