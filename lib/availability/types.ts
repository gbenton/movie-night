export interface JustWatchSearchCandidate {
  id?: string;
  objectId?: number;
  objectType?: string;
  content?: {
    title?: string;
    fullPath?: string;
    originalReleaseYear?: number;
    posterUrl?: string;
  };
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
  data?: {
    popularTitles?: {
      edges?: Array<{
        node?: JustWatchSearchCandidate;
      }>;
    };
  };
  errors?: Array<unknown>;
}
