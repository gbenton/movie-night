import test from "node:test";
import assert from "node:assert/strict";
import { filterMovies } from "./filterMovies";
import { selectMoviePage } from "./moviePages";
import { createMovieId } from "./normalize";
import type { AvailabilityResult, MovieList } from "./types";

test("pages only the 27 available service matches from a 439-title list", () => {
  const movies = Array.from({ length: 439 }, (_, index) => ({
    id: `row-${index}`,
    title: `Movie ${index + 1}`,
  }));
  const list: MovieList = {
    id: "large-list", name: "RW", ranked: false, createdAt: "", updatedAt: "", movies,
  };
  const availabilityByMovieKey: Record<string, AvailabilityResult> = Object.fromEntries(
    movies.map((movie, index) => [createMovieId(movie.title), {
      movieId: movie.id,
      title: movie.title,
      services: index < 27 ? ["Netflix"] : [],
      status: index < 27 ? "available" : "unavailable",
      lastCheckedAt: "2026-01-01T00:00:00.000Z",
    }]),
  );
  const available = filterMovies({ list, selectedServices: ["Netflix"], availabilityByMovieKey, showAll: false });
  const first = selectMoviePage(available, "", 0);
  const second = selectMoviePage(available, "", 1);

  assert.equal(first.total, 27);
  assert.equal(first.pageCount, 2);
  assert.equal(first.movies.length, 20);
  assert.deepEqual(second.movies.map((movie) => movie.title), movies.slice(20, 27).map((movie) => movie.title));
  assert.equal(second.movies.length, 7);
  assert.ok(second.movies.every((movie) => movie.availability?.services.includes("Netflix")));

  const all = filterMovies({ list, selectedServices: ["Netflix"], availabilityByMovieKey, showAll: true });
  const last = selectMoviePage(all, "", 21);
  assert.equal(last.pageCount, 22);
  assert.equal(last.movies.length, 19);
  assert.deepEqual(selectMoviePage(all, "Movie 439", 0).movies.map((movie) => movie.title), ["Movie 439"]);
});

test("search ignores case, hyphens and punctuation while keeping a release year searchable", () => {
  const movies = [{ id: "virgin", title: "The 40-Year-Old Virgin", year: 2005 }];
  assert.equal(selectMoviePage(movies, "40 year old", 0).total, 1);
  assert.equal(selectMoviePage(movies, "virgin 2005", 0).total, 1);
  assert.equal(selectMoviePage(movies, "2006", 0).total, 0);
});
