import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { fetchJustWatchAvailability } from "./justWatch";

test("fetchJustWatchAvailability falls back to a JustWatch search link when the upstream request fails", async () => {
  const restoreFetch = mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network down");
  });
  const restoreError = mock.method(console, "error", () => {});

  try {
    const result = await fetchJustWatchAvailability("social-network__2010", "The Social Network", 2010);

    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.services, []);
    assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/search?q=the%20social%20network");
  } finally {
    restoreFetch.mock.restore();
    restoreError.mock.restore();
  }
});
