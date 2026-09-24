import test from "node:test";
import assert from "node:assert/strict";
import { runLookupQueue } from "../../components/useAvailabilityLookupQueue";
import { createMovieId } from "../normalize";
import type { AvailabilityResult, MovieItem } from "../types";

test("persistent provider rate limits stop a large lookup after one cooldown", async () => {
  const originalFetch = globalThis.fetch;
  const movies: MovieItem[] = Array.from({ length: 40 }, (_, index) => ({
    id: `movie-${index}`,
    title: `Movie ${index}`,
  }));
  const results = new Map<string, AvailabilityResult>();
  const foregroundPendingKeys = new Set(movies.map((movie) => createMovieId(movie.title)));
  const retryPendingKeys = new Set<string>();
  let requests = 0;
  let completed = false;

  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ retryAfterMs: 1_000 }, { status: 429 });
  };

  try {
    await runLookupQueue({
      movies,
      signal: new AbortController().signal,
      getCancelled: () => false,
      foregroundPendingKeys,
      retryPendingKeys,
      onAvailability: (key, result) => results.set(key, result),
      onComplete: () => { completed = true; },
      onLoadingCountChange: () => {},
      onRetryAttemptChange: () => {},
      onRetryCountChange: () => {},
    });

    assert.equal(completed, true);
    assert.equal(foregroundPendingKeys.size, 0);
    assert.equal(retryPendingKeys.size, 0);
    assert.equal(results.size, 40);
    assert.ok(requests <= 12, `expected a circuit break after one cooldown, got ${requests} requests`);
    assert.ok([...results.values()].every((result) => result.failureReason === "rate_limited"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
