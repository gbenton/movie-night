import { STORAGE_KEYS, STREAMING_SERVICES } from "./constants";
import type { AvailabilityResult, MovieItem, MovieList, StreamingService } from "./types";

const SELECTABLE_STREAMING_SERVICES = new Set<string>(STREAMING_SERVICES);

function safeStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const storage = safeStorage();
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  const storage = safeStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Treat storage as best-effort so large imports or privacy settings do not crash the app.
  }
}

export function getSelectedServices(): StreamingService[] {
  const value = readJson<unknown>(STORAGE_KEYS.selectedServices, []);
  return Array.isArray(value)
    ? (value.filter((item): item is StreamingService => typeof item === "string" && SELECTABLE_STREAMING_SERVICES.has(item)) as StreamingService[])
    : [];
}

export function setSelectedServices(services: StreamingService[]): void {
  writeJson(STORAGE_KEYS.selectedServices, services);
}

export function getLists(): MovieList[] {
  const value = readJson<unknown>(STORAGE_KEYS.lists, []);
  return Array.isArray(value) ? value.map(normalizeMovieList).filter((list): list is MovieList => Boolean(list)) : [];
}

export function setLists(lists: MovieList[]): void {
  writeJson(STORAGE_KEYS.lists, lists);
}

export function getLastUsedListId(): string | undefined {
  const storage = safeStorage();
  if (!storage) {
    return undefined;
  }

  const value = storage.getItem(STORAGE_KEYS.lastUsedListId);
  return value || undefined;
}

export function setLastUsedListId(id: string): void {
  const storage = safeStorage();
  storage?.setItem(STORAGE_KEYS.lastUsedListId, id);
}

export function clearLastUsedListId(): void {
  const storage = safeStorage();
  storage?.removeItem(STORAGE_KEYS.lastUsedListId);
}

export function getAvailabilityCache(): Record<string, AvailabilityResult> {
  const value = readJson<unknown>(STORAGE_KEYS.availabilityCache, {});
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, AvailabilityResult>)
    : {};
}

export function setAvailabilityCache(cache: Record<string, AvailabilityResult>): void {
  writeJson(STORAGE_KEYS.availabilityCache, cache);
}

function normalizeMovieList(value: unknown): MovieList | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<MovieList>;
  if (typeof candidate.id !== "string" || !candidate.id || !Array.isArray(candidate.movies)) {
    return undefined;
  }

  const movies = candidate.movies.map(normalizeMovieItem).filter((movie): movie is MovieItem => Boolean(movie));
  return {
    id: candidate.id,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : "Imported list",
    ranked: typeof candidate.ranked === "boolean" ? candidate.ranked : movies.some((movie) => typeof movie.rank === "number"),
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    movies,
  };
}

function normalizeMovieItem(value: unknown, index: number): MovieItem | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<MovieItem>;
  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    return undefined;
  }

  const year = typeof candidate.year === "number" ? candidate.year : undefined;
  const rank = typeof candidate.rank === "number" ? candidate.rank : undefined;
  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : `${candidate.title.trim()}__row-${index + 1}`;

  return {
    id,
    title: candidate.title.trim(),
    year,
    rank,
    originalLine: typeof candidate.originalLine === "string" ? candidate.originalLine : undefined,
  };
}
