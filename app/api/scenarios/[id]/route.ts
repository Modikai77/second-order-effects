import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scenario = await prisma.portfolioScenario.findUnique({
    where: { id },
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
