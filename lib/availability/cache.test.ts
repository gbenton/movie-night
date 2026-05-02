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
