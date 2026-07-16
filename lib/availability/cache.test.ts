import test from "node:test";
import assert from "node:assert/strict";
import { isAvailabilityFresh, isAvailabilityTrusted } from "./cache";

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

test("isAvailabilityFresh gives recent unknown entries a retry cooldown", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date().toISOString(),
      status: "unknown",
    }),
    true,
  );
});

test("isAvailabilityFresh retries unknown entries after the cooldown", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      status: "unknown",
    }),
    false,
  );
});

test("isAvailabilityFresh gives recent empty unavailable entries a retry cooldown", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    true,
  );
});

test("isAvailabilityFresh gives low-confidence fallback results a retry cooldown", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      justWatchUrl: "https://www.justwatch.com/us/search?q=heat",
      matchConfidence: "low",
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    true,
  );
});

test("isAvailabilityFresh returns true for confident unavailable JustWatch matches", () => {
  assert.equal(
    isAvailabilityFresh({
      movieId: "heat",
      title: "Heat",
      services: [],
      justWatchUrl: "https://www.justwatch.com/us/movie/heat",
      matchConfidence: "high",
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    true,
  );
});

test("isAvailabilityTrusted keeps retry decisions separate from the reload cooldown", () => {
  assert.equal(
    isAvailabilityTrusted({
      movieId: "heat",
      title: "Heat",
      services: [],
      lastCheckedAt: new Date().toISOString(),
      status: "unknown",
    }),
    false,
  );
  assert.equal(
    isAvailabilityTrusted({
      movieId: "heat",
      title: "Heat",
      services: [],
      justWatchUrl: "https://www.justwatch.com/us/movie/heat",
      matchConfidence: "high",
      lastCheckedAt: new Date().toISOString(),
      status: "unavailable",
    }),
    true,
  );
});
