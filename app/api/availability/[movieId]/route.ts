import { NextResponse } from "next/server";
import { fetchJustWatchAvailability } from "../../../../lib/availability/justWatch";

const AVAILABILITY_ROUTE_TIMEOUT_MS = 10_000;

export async function POST(request: Request, context: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await context.params;

  try {
    const body = (await request.json()) as { title?: string; year?: number };
    if (!body.title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const result = await withTimeout(fetchJustWatchAvailability(movieId, body.title, body.year), AVAILABILITY_ROUTE_TIMEOUT_MS);
    if (result.failureReason === "rate_limited") {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.retryAfterMs ?? 20_000) / 1_000));
      return NextResponse.json(result, {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      });
    }

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Availability lookup timed out")), timeoutMs);
    }),
  ]);
}
