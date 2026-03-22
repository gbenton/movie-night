import { slugifyTitle } from "../normalize.ts";
import type { AvailabilityResult, StreamingService } from "../types.ts";
import type { JustWatchSearchCandidate, JustWatchSearchResponse } from "./types.ts";

const JUSTWATCH_SEARCH_URL = "https://apis.justwatch.com/content/titles/en_US/popular";
const COUNTRY_CODE = "US";

const PROVIDER_NAME_MAP: Record<string, StreamingService> = {
  netflix: "Netflix",
  hulu: "Hulu",
  amazon_prime_video: "Prime Video",
  max: "Max",
  disney_plus: "Disney+",
  apple_tv_plus: "Apple TV+",
  peacock_premium: "Peacock",
  peacocktv: "Peacock",
  paramount_plus: "Paramount+",
  criterion_channel: "Criterion Channel",
  mubi: "MUBI",
};

export async function fetchJustWatchAvailability(movieId: string, title: string, year?: number): Promise<AvailabilityResult> {
  try {
    const response = await fetch(JUSTWATCH_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        query: title,
        content_types: ["movie"],
        page_size: 5,
        page: 1,
        country: COUNTRY_CODE,
        language: "en",
      }),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`JustWatch request failed with ${response.status}`);
    }

    const data = (await response.json()) as JustWatchSearchResponse;
    const candidate = chooseBestCandidate(data.items ?? [], title, year);

    if (!candidate) {
      return buildFallbackAvailability(movieId, title, year);
    }

    const services = extractServices(candidate);
    const providerLinks = extractProviderLinks(candidate);

    return {
      movieId,
      title: candidate.title ?? title,
      year: candidate.originalReleaseYear ?? year,
      services,
      providerLinks,
      justWatchUrl: buildCandidateUrl(candidate, title),
      posterUrl: candidate.posterUrl,
      lastCheckedAt: new Date().toISOString(),
      status: services.length > 0 ? "available" : "unavailable",
      matchConfidence: deriveConfidence(candidate, title, year),
    };
  } catch (error) {
    console.error("JustWatch lookup failed", { movieId, title, year, error });
    return buildFallbackAvailability(movieId, title, year);
  }
}

function chooseBestCandidate(candidates: JustWatchSearchCandidate[], title: string, year?: number): JustWatchSearchCandidate | undefined {
  const normalizedTitle = title.trim().toLowerCase();

  const scored = candidates
    .filter((candidate) => (candidate.objectType ?? "movie") === "movie")
    .map((candidate) => {
      let score = 0;
      const candidateTitle = (candidate.title ?? "").trim().toLowerCase();
      if (candidateTitle === normalizedTitle) {
        score += 4;
      } else if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
        score += 2;
      }

      if (typeof year === "number" && candidate.originalReleaseYear === year) {
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
    const provider = offer.package?.technicalName ?? offer.package?.clearName?.toLowerCase().replace(/\s+/g, "_");
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
  if (candidate.fullPath) {
    return `https://www.justwatch.com${candidate.fullPath}`;
  }

  return buildFallbackJustWatchUrl(candidate.title ?? title);
}

function buildFallbackJustWatchUrl(title: string): string {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(slugifyTitle(title).replace(/-/g, " "))}`;
}

function deriveConfidence(candidate: JustWatchSearchCandidate, title: string, year?: number): "high" | "medium" | "low" {
  const candidateTitle = (candidate.title ?? "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();

  if (candidateTitle === normalizedTitle && (!year || candidate.originalReleaseYear === year)) {
    return "high";
  }

  if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
    return "medium";
  }

  return "low";
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
