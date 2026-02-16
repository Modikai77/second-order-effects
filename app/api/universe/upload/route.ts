import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { parseUniverseCsv } from "@/lib/decision-engine";
import { universeUploadInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = universeUploadInputSchema.parse(await request.json());
    const parsed = parseUniverseCsv(body.csvText);

    const created = await prisma.$transaction(async (tx) => {
      const version = await tx.companyUniverseVersion.create({
        data: {
          userId,
          name: body.name
        }
      });

      await tx.companyExposure.createMany({
        data: parsed.rows.map((row) => ({
          versionId: version.id,
          symbol: row.symbol,
          companyName: row.companyName,
          assetType: row.assetType,
          region: row.region,
          currency: row.currency,
          liquidityClass: row.liquidityClass,
          maxPositionDefaultPct: row.maxPositionDefaultPct,
          tags: row.tags,
          exposureVector: row.exposureVector
        }))
      });

      return tx.companyUniverseVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: {
          companies: true
        }
      });
    });

    return NextResponse.json(
      {
        ok: true,
        version: created,
        warnings: parsed.warnings
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
