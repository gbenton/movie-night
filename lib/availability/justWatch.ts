import { slugifyTitle } from "../normalize";
import type { AvailabilityResult, StreamingService } from "../types";
import type { JustWatchSearchCandidate, JustWatchSearchResponse } from "./types";

const JUSTWATCH_GRAPHQL_URL = "https://apis.justwatch.com/graphql";
const COUNTRY_CODE = "US";
const LANGUAGE_CODE = "en";

const SEARCH_QUERY = `
  query GetSearchTitles(
    $searchTitlesFilter: TitleFilter!
    $country: Country!
    $language: Language!
    $first: Int!
    $filter: OfferFilter!
  ) {
    popularTitles(
      country: $country
      filter: $searchTitlesFilter
      first: $first
      sortBy: POPULAR
      sortRandomSeed: 0
    ) {
      edges {
        node {
          id
          objectId
          objectType
          content(country: $country, language: $language) {
            title
            fullPath
            originalReleaseYear
            posterUrl
          }
          offers(country: $country, platform: WEB, filter: $filter) {
            standardWebURL
            deeplinkRoku: deeplinkURL(platform: ROKU_OS)
            package {
              clearName
              technicalName
              shortName
              slug
            }
          }
        }
      }
    }
  }
`;

const PROVIDER_NAME_MAP: Record<string, StreamingService> = {
  netflix: "Netflix",
  hulu: "Hulu",
  amazon_prime_video: "Prime Video",
  amazonprime: "Prime Video",
  max: "Max",
  disney_plus: "Disney+",
  disneyplus: "Disney+",
  apple_tv_plus: "Apple TV+",
  appletvplus: "Apple TV+",
  peacock_premium: "Peacock",
  peacocktv: "Peacock",
  peacocktvpremium: "Peacock",
  paramount_plus: "Paramount+",
  paramountpluspremium: "Paramount+",
  paramountplusessential: "Paramount+",
  kanopy: "Kanopy",
};

export async function fetchJustWatchAvailability(movieId: string, title: string, year?: number): Promise<AvailabilityResult> {
  try {
    const response = await fetch(JUSTWATCH_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        operationName: "GetSearchTitles",
        variables: {
          first: 5,
          searchTitlesFilter: { searchQuery: title },
          country: COUNTRY_CODE,
          language: LANGUAGE_CODE,
          filter: { bestOnly: true },
        },
        query: SEARCH_QUERY,
      }),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`JustWatch request failed with ${response.status}`);
    }

    const data = (await response.json()) as JustWatchSearchResponse;
    if (data.errors?.length) {
      throw new Error("JustWatch GraphQL response contained errors");
    }

    const candidate = chooseBestCandidate(extractCandidates(data), title, year);

    if (!candidate) {
      return buildFallbackAvailability(movieId, title, year);
    }

    const services = extractServices(candidate);
    const providerLinks = extractProviderLinks(candidate);

    return {
      movieId,
      title: getCandidateTitle(candidate) ?? title,
      year: getCandidateYear(candidate) ?? year,
      services,
      providerLinks,
      justWatchUrl: buildCandidateUrl(candidate, title),
      posterUrl: getCandidatePosterUrl(candidate),
      lastCheckedAt: new Date().toISOString(),
      status: services.length > 0 ? "available" : "unavailable",
      matchConfidence: deriveConfidence(candidate, title, year),
    };
  } catch (error) {
    console.error("JustWatch lookup failed", { movieId, title, year, error });
    return buildFallbackAvailability(movieId, title, year);
  }
}

function extractCandidates(data: JustWatchSearchResponse): JustWatchSearchCandidate[] {
  if (data.items) {
    return data.items;
  }

  return data.data?.popularTitles?.edges?.map((edge) => edge.node).filter((node): node is JustWatchSearchCandidate => Boolean(node)) ?? [];
}

function chooseBestCandidate(candidates: JustWatchSearchCandidate[], title: string, year?: number): JustWatchSearchCandidate | undefined {
  const normalizedTitle = title.trim().toLowerCase();

  const scored = candidates
    .filter((candidate) => (candidate.objectType ?? "movie").toLowerCase() === "movie")
    .map((candidate) => {
      let score = 0;
      const candidateTitle = (getCandidateTitle(candidate) ?? "").trim().toLowerCase();
      if (candidateTitle === normalizedTitle) {
        score += 4;
      } else if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
        score += 2;
      }

      if (typeof year === "number" && getCandidateYear(candidate) === year) {
        score += 3;
      }

      if (typeof candidate.scoring === "number") {
        score += Math.min(candidate.scoring, 1);
      }

      if ((candidate.offers?.length ?? 0) > 0) {
        score += 0.5;
      }

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.candidate;
}

function extractServices(candidate: JustWatchSearchCandidate): StreamingService[] {
  const mapped = new Set<StreamingService>();

  for (const offer of candidate.offers ?? []) {
    const provider = getProviderKey(offer.package);
    if (!provider) {
      continue;
    }

    mapped.add(PROVIDER_NAME_MAP[provider] ?? "Other");
  }

  return Array.from(mapped);
}

function extractProviderLinks(candidate: JustWatchSearchCandidate): Record<string, string> | undefined {
  const entries = (candidate.offers ?? [])
    .map((offer) => {
      const name = offer.package?.clearName;
      const url = offer.standardWebURL ?? offer.deeplinkAndroidTV ?? offer.deeplinkRoku;
      if (!name || !url) {
        return undefined;
      }
      return [name, url] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function buildCandidateUrl(candidate: JustWatchSearchCandidate, title: string): string {
  const fullPath = candidate.fullPath ?? candidate.content?.fullPath;
  if (fullPath) {
    return `https://www.justwatch.com${fullPath}`;
  }

  return buildFallbackJustWatchUrl(getCandidateTitle(candidate) ?? title);
}

function buildFallbackJustWatchUrl(title: string): string {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(slugifyTitle(title).replace(/-/g, " "))}`;
}

function deriveConfidence(candidate: JustWatchSearchCandidate, title: string, year?: number): "high" | "medium" | "low" {
  const candidateTitle = (getCandidateTitle(candidate) ?? "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();

  if (candidateTitle === normalizedTitle && (!year || getCandidateYear(candidate) === year)) {
    return "high";
  }

  if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
    return "medium";
  }

  return "low";
}

function getCandidateTitle(candidate: JustWatchSearchCandidate): string | undefined {
  return candidate.title ?? candidate.content?.title;
}

function getCandidateYear(candidate: JustWatchSearchCandidate): number | undefined {
  return candidate.originalReleaseYear ?? candidate.content?.originalReleaseYear;
}

function getCandidatePosterUrl(candidate: JustWatchSearchCandidate): string | undefined {
  const posterUrl = candidate.posterUrl ?? candidate.content?.posterUrl;
  return posterUrl?.replace("{profile}", "s718").replace("{format}", "jpg");
}

function getProviderKey(provider?: { clearName?: string; technicalName?: string; shortName?: string; slug?: string }): string | undefined {
  return provider?.technicalName ?? provider?.slug?.replace(/-/g, "_") ?? provider?.clearName?.toLowerCase().replace(/\s+/g, "_");
}

function buildFallbackAvailability(movieId: string, title: string, year?: number): AvailabilityResult {
  return {
    movieId,
    title,
    year,
    services: [],
    lastCheckedAt: new Date().toISOString(),
    status: "unavailable",
    matchConfidence: "low",
    justWatchUrl: buildFallbackJustWatchUrl(title),
  };
}
