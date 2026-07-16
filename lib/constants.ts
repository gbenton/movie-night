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
  "Kanopy",
  "Other",
];

export const STORAGE_KEYS = {
  selectedServices: "movie-night:selected-services",
  lists: "movie-night:lists",
  lastUsedListId: "movie-night:last-used-list-id",
  availabilityCache: "movie-night:availability-cache:v8",
} as const;

export const AVAILABILITY_TTL_MS = 24 * 60 * 60 * 1000;
export const AVAILABILITY_RETRY_TTL_MS = 15 * 60 * 1000;
