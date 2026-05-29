import test from "node:test";
import assert from "node:assert/strict";
import { parseTextImport } from "./parseTextImport";

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

test("parseTextImport does not treat numeric-leading titles as ranks", () => {
  const movies = parseTextImport("12 Angry Men (1957)\n10 Things I Hate About You (1999)");

  assert.deepEqual(movies.map((movie) => movie.title), ["12 Angry Men", "10 Things I Hate About You"]);
  assert.deepEqual(movies.map((movie) => movie.rank), [undefined, undefined]);
});

test("parseTextImport creates unique row ids for duplicate movies", () => {
  const movies = parseTextImport("1. Heat (1995)\n2. Heat (1995)");

  assert.notEqual(movies[0].id, movies[1].id);
  assert.deepEqual(movies.map((movie) => movie.title), ["Heat", "Heat"]);
});

test("parseTextImport skips rank-only lines", () => {
  const movies = parseTextImport("1.\n2. Heat (1995)");

  assert.deepEqual(movies.map((movie) => movie.title), ["Heat"]);
});
