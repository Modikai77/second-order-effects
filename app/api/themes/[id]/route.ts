import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const theme = await prisma.theme.findUnique({
    where: { id },
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

  return NextResponse.json(theme);
}
