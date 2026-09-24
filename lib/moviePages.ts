import { normalizeTitle } from "./normalize";
import type { DisplayMovie } from "./types";

export const MOVIES_PER_PAGE = 20;

export function normalizeMovieSearch(value: string): string {
  return normalizeTitle(value.replace(/[-–—]/g, " "));
}

export function selectMoviePage(movies: readonly DisplayMovie[], query: string, requestedPage: number) {
  const search = normalizeMovieSearch(query);
  const matches = search
    ? movies.filter((movie) => normalizeMovieSearch(`${movie.title} ${movie.year ?? ""}`).includes(search))
    : movies;
  const pageCount = Math.max(1, Math.ceil(matches.length / MOVIES_PER_PAGE));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const start = page * MOVIES_PER_PAGE;

  return {
    movies: matches.slice(start, start + MOVIES_PER_PAGE),
    total: matches.length,
    page,
    pageCount,
    start,
  };
}
