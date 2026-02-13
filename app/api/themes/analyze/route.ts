import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { analyzeAndPersist } from "@/lib/analysis-service";
import { requireAuth } from "@/lib/authz";

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await analyzeAndPersist(body, userId);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          themeId: result.themeId,
          error: result.error,
          message: "Analysis failed validation after retry; snapshot persisted for audit."
        },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
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
