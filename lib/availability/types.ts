export interface JustWatchJsonLdMovie {
  "@type"?: string;
  "@id"?: string;
  name?: unknown;
  dateCreated?: unknown;
  image?: string;
  potentialAction?: JustWatchPotentialAction | JustWatchPotentialAction[];
}

export interface JustWatchPotentialAction {
  "@type"?: string;
  target?: {
    urlTemplate?: string;
  };
  expectsAcceptanceOf?: {
    businessFunction?: string;
    offeredBy?: {
      name?: string;
    };
  };
}
