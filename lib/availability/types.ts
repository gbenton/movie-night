export interface JustWatchJsonLdMovie {
  "@type"?: string;
  "@id"?: string;
  name?: string;
  dateCreated?: string;
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
