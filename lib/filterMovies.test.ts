import test from "node:test";
import assert from "node:assert/strict";
import { filterMovies } from "./filterMovies";
import { createMovieId } from "./normalize";
import type { MovieList } from "./types";

const list: MovieList = {
  id: "list-1",
  name: "Test",
  ranked: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  movies: [
    { id: "heat__1995", title: "Heat", year: 1995, rank: 1 },
    { id: "zodiac__2007", title: "Zodiac", year: 2007, rank: 2 },
  ],
};

test("filterMovies only returns matching available titles by default", () => {
  const results = filterMovies({
    list,
    selectedServices: ["Netflix"],
    showAll: false,
    availabilityByMovieKey: {
      [createMovieId("Heat", 1995)]: {
        movieId: "heat__1995",
        title: "Heat",
        year: 1995,
        services: ["Netflix"],
        lastCheckedAt: new Date().toISOString(),
        status: "available",
      },
      [createMovieId("Zodiac", 2007)]: {
        movieId: "zodiac__2007",
        title: "Zodiac",
        year: 2007,
        services: [],
        lastCheckedAt: new Date().toISOString(),
        status: "unavailable",
      },
    },
  });

  assert.deepEqual(results.map((movie) => movie.title), ["Heat"]);
});

test("filterMovies preserves source order when showAll is enabled", () => {
  const results = filterMovies({
    list,
    selectedServices: ["Netflix"],
    showAll: true,
    availabilityByMovieKey: {},
  });

  assert.deepEqual(results.map((movie) => movie.title), ["Heat", "Zodiac"]);
});
