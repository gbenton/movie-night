import { createMovieId } from "./normalize.ts";
import type { MovieItem, MovieList } from "./types.ts";

interface RawImportItem {
  rank?: unknown;
  title?: unknown;
  year?: unknown;
}

interface RawImportPayload {
  listName?: unknown;
  items?: unknown;
}

export function parseJsonImport(input: string): MovieList {
  let payload: RawImportPayload;

  try {
    payload = JSON.parse(input) as RawImportPayload;
  } catch {
    throw new Error("That JSON could not be parsed. Check for missing commas or quotes.");
  }

  if (!Array.isArray(payload.items)) {
    throw new Error("JSON import must include an \"items\" array.");
  }

  const movies = payload.items.map((item, index) => normalizeJsonItem(item, index));
  const timestamp = new Date().toISOString();
  const listName = typeof payload.listName === "string" && payload.listName.trim() ? payload.listName.trim() : "Imported list";

  return {
    id: crypto.randomUUID(),
    name: listName,
    ranked: movies.some((movie) => typeof movie.rank === "number"),
    createdAt: timestamp,
    updatedAt: timestamp,
    movies,
  };
}

function normalizeJsonItem(item: unknown, index: number): MovieItem {
  if (!item || typeof item !== "object") {
    throw new Error(`Item ${index + 1} must be an object.`);
  }

  const candidate = item as RawImportItem;

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    throw new Error(`Item ${index + 1} is missing a valid title.`);
  }

  const title = candidate.title.trim();
  const rank = typeof candidate.rank === "number" ? candidate.rank : undefined;
  const year = typeof candidate.year === "number" ? candidate.year : undefined;

  return {
    id: createMovieId(title, year),
    title,
    rank,
    year,
  };
}
