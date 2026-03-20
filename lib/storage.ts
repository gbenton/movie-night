import { STORAGE_KEYS } from "./constants.ts";
import type { AvailabilityResult, MovieList, StreamingService } from "./types.ts";

function safeStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
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

  storage.setItem(key, JSON.stringify(value));
}

export function getSelectedServices(): StreamingService[] {
  const value = readJson<unknown>(STORAGE_KEYS.selectedServices, []);
  return Array.isArray(value) ? (value.filter((item): item is StreamingService => typeof item === "string") as StreamingService[]) : [];
}

export function setSelectedServices(services: StreamingService[]): void {
  writeJson(STORAGE_KEYS.selectedServices, services);
}

export function getLists(): MovieList[] {
  const value = readJson<unknown>(STORAGE_KEYS.lists, []);
  return Array.isArray(value) ? (value.filter((item): item is MovieList => !!item && typeof item === "object" && "id" in item && "movies" in item) as MovieList[]) : [];
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

export function getAvailabilityCache(): Record<string, AvailabilityResult> {
  const value = readJson<unknown>(STORAGE_KEYS.availabilityCache, {});
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, AvailabilityResult>)
    : {};
}

export function setAvailabilityCache(cache: Record<string, AvailabilityResult>): void {
  writeJson(STORAGE_KEYS.availabilityCache, cache);
}
