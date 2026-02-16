import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { indicatorPatchSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/authz";
import { computeStatusFromObservedValue } from "@/lib/decision-engine";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = indicatorPatchSchema.parse(await request.json());

    const current = await prisma.invalidationItem.findUnique({
      where: { id },
      include: {
        theme: {
          select: { userId: true }
        }
      }
    });

    if (!current || current.theme.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let nextStatus = body.latestStatus;
    if (typeof body.observedValue === "number") {
      const definition = await prisma.indicatorDefinition.findFirst({
        where: {
          themeId: current.themeId,
          indicatorName: current.indicatorName
        }
      });
      if (definition) {
        nextStatus = computeStatusFromObservedValue(body.observedValue, {
          indicatorName: definition.indicatorName,
          supportsDirection: definition.supportsDirection,
          greenThreshold: definition.greenThreshold,
          yellowThreshold: definition.yellowThreshold,
          redThreshold: definition.redThreshold,
          expectedWindow: definition.expectedWindow
        });
      }
    }

    const updated = await prisma.invalidationItem.update({
      where: { id },
      data: {
        latestStatus: nextStatus,
        latestNote: body.latestNote
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
