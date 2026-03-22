import test from "node:test";
import assert from "node:assert/strict";
import { parseTextImport } from "./parseTextImport.ts";

test("parseTextImport supports ranked lines with years", () => {
  const [movie] = parseTextImport("1. The Social Network (2010)");
  assert.equal(movie.title, "The Social Network");
  assert.equal(movie.year, 2010);
  assert.equal(movie.rank, 1);
});

test("parseTextImport preserves unranked input order and ignores blanks", () => {
  const movies = parseTextImport("Heat\n\nZodiac\nMichael Clayton");
  assert.deepEqual(movies.map((movie) => movie.title), ["Heat", "Zodiac", "Michael Clayton"]);
  assert.equal(movies[0].rank, undefined);
});
