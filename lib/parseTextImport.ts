import { createMovieId } from "./normalize.ts";
import type { MovieItem, MovieList } from "./types.ts";

const RANK_PATTERN = /^\s*(\d+)[\).\-\s]+/;
const YEAR_PATTERN = /\((\d{4})\)\s*$/;

export function parseTextImport(input: string): MovieItem[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const rankMatch = line.match(RANK_PATTERN);
      const yearMatch = line.match(YEAR_PATTERN);
      const rank = rankMatch ? Number.parseInt(rankMatch[1], 10) : undefined;
      const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined;

      let title = line.replace(RANK_PATTERN, "").replace(YEAR_PATTERN, "").trim();
      if (!title) {
        title = line.trim();
      }

      return {
        id: createMovieId(title, year),
        title,
        year,
        rank,
        originalLine: line,
      } satisfies MovieItem;
    });
}

export function createMovieListFromText(name: string, input: string): MovieList {
  const movies = parseTextImport(input);
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    ranked: movies.some((movie) => typeof movie.rank === "number"),
    createdAt: timestamp,
    updatedAt: timestamp,
    movies,
  };
}
