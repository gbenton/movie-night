import test from "node:test";
import assert from "node:assert/strict";
import { createMovieId, normalizeTitle } from "./normalize.ts";

test("normalizeTitle removes punctuation noise and collapses whitespace", () => {
  assert.equal(normalizeTitle("  Spider-Man: No Way Home!  "), "spider-man no way home");
});

test("createMovieId includes year when present", () => {
  assert.equal(createMovieId("Heat", 1995), "heat__1995");
  assert.equal(createMovieId("Heat"), "heat__unknown");
});
