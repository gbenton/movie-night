import type { StreamingService } from "./types";

export const STREAMING_SERVICES: StreamingService[] = [
  "Netflix",
  "Hulu",
  "Prime Video",
  "Max",
  "Disney+",
  "Apple TV+",
  "Peacock",
  "Paramount+",
  "Criterion Channel",
  "MUBI",
  "Other",
];

export const STORAGE_KEYS = {
  selectedServices: "movie-night:selected-services",
  lists: "movie-night:lists",
  lastUsedListId: "movie-night:last-used-list-id",
  availabilityCache: "movie-night:availability-cache",
} as const;

export const AVAILABILITY_TTL_MS = 24 * 60 * 60 * 1000;
