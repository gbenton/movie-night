import { NextResponse } from "next/server";
import { fetchJustWatchAvailability } from "../../../../lib/availability/justWatch.ts";

export async function POST(request: Request, context: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await context.params;

  try {
    const body = (await request.json()) as { title?: string; year?: number };
    if (!body.title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const result = await fetchJustWatchAvailability(movieId, body.title, body.year);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected availability error",
      },
      { status: 500 },
    );
  }
}
