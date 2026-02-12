import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { analyzeAndPersist } from "@/lib/analysis-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await analyzeAndPersist(body);

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
