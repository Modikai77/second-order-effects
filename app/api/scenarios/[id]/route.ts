import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await requireAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scenario = await prisma.portfolioScenario.findUnique({
    where: { id, userId },
    include: {
      holdings: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  return NextResponse.json(scenario);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await requireAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scenario = await prisma.portfolioScenario.findUnique({ where: { id } });
  if (!scenario || scenario.userId !== userId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  await prisma.portfolioScenario.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { status: 200 });
}
