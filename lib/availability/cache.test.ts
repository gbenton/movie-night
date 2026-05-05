import test from "node:test";
import assert from "node:assert/strict";
import { isAvailabilityFresh } from "./cache";

test("isAvailabilityFresh returns true for a recent entry", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: ["Netflix"],
      lastCheckedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: "available",
    }),
    true,
  );
});

test("isAvailabilityFresh returns false for a stale entry", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: ["Netflix"],
      lastCheckedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      status: "available",
    }),
    false,
  );
});

test("isAvailabilityFresh returns false for unknown entries", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date().toISOString(),
      status: "unknown",
    }),
    false,
  );
});

test("isAvailabilityFresh returns false for failed empty unavailable entries", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    false,
  );
});

test("isAvailabilityFresh returns true for unavailable JustWatch results with a fallback URL", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      justWatchUrl: "https://www.justwatch.com/us/search?q=heat",
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    true,
  );
});
