export type StreamingService =
  | "Netflix"
  | "Hulu"
  | "Prime Video"
  | "Max"
  | "Disney+"
  | "Apple TV+"
  | "Peacock"
  | "Paramount+"
  | "Criterion Channel"
  | "MUBI"
  | "Other";

export interface MovieItem {
  id: string;
  title: string;
  year?: number;
  rank?: number;
  originalLine?: string;
}

export interface MovieList {
  id: string;
  name: string;
  ranked: boolean;
  createdAt: string;
  updatedAt: string;
  movies: MovieItem[];
}

export interface AvailabilityResult {
  movieId: string;
  title: string;
  year?: number;
  services: StreamingService[];
  providerLinks?: Record<string, string>;
  justWatchUrl?: string;
  posterUrl?: string;
  lastCheckedAt: string;
  status: "available" | "unavailable" | "unknown";
  matchConfidence?: "high" | "medium" | "low";
}

export interface AppState {
  selectedServices: StreamingService[];
  lists: MovieList[];
  lastUsedListId?: string;
  availabilityByMovieKey: Record<string, AvailabilityResult>;
}

export interface DisplayMovie extends MovieItem {
  availability?: AvailabilityResult;
}
