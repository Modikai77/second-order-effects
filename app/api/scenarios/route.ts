import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { scenarioCreateInputSchema } from "@/lib/schemas";

export async function GET() {
  const items = await prisma.portfolioScenario.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      holdings: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const body = scenarioCreateInputSchema.parse(await request.json());

    const created = await prisma.$transaction(async (tx) => {
      const scenario = await tx.portfolioScenario.create({
        data: {
          name: body.name
        }
      });

      await tx.scenarioHolding.createMany({
        data: body.holdings.map((holding, index) => ({
          scenarioId: scenario.id,
          name: holding.name,
          ticker: holding.ticker,
          weight: holding.weight,
          sensitivity: holding.sensitivity,
          exposureTags: holding.exposureTags,
          orderIndex: index
        }))
      });

      return tx.portfolioScenario.findUniqueOrThrow({
        where: { id: scenario.id },
        include: {
          holdings: {
            orderBy: { orderIndex: "asc" }
          }
        }
      });
    });

    return NextResponse.json({ ok: true, scenario: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
