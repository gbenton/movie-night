export interface JustWatchSearchCandidate {
  id?: string;
  objectId?: number;
  objectType?: string;
  title?: string;
  fullPath?: string;
  originalReleaseYear?: number;
  posterUrl?: string;
  scoring?: number;
  offers?: Array<{
    package?: {
      clearName?: string;
      technicalName?: string;
    };
    standardWebURL?: string;
    deeplinkRoku?: string;
    deeplinkAndroidTV?: string;
  }>;
}

export interface JustWatchSearchResponse {
  items?: JustWatchSearchCandidate[];
}
