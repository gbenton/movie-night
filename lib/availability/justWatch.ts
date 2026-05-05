import { slugifyTitle } from "../normalize";
import type { AvailabilityResult, StreamingService } from "../types";
import type { JustWatchJsonLdMovie, JustWatchPotentialAction } from "./types";

const JUSTWATCH_MOVIE_URL = "https://www.justwatch.com/us/movie";

const STREAMING_BUSINESS_FUNCTIONS = new Set([
  "https://schema.org/ProvideService",
  "http://purl.org/goodrelations/v1#ProvideService",
]);

const SERVICE_NAME_MAP: Record<string, StreamingService> = {
  netflix: "Netflix",
  hulu: "Hulu",
  "amazon prime video": "Prime Video",
  "prime video": "Prime Video",
  max: "Max",
  "hbo max": "Max",
  "disney plus": "Disney+",
  "disney+": "Disney+",
  "apple tv plus": "Apple TV+",
  "apple tv+": "Apple TV+",
  "peacock premium": "Peacock",
  peacock: "Peacock",
  paramount: "Paramount+",
  "paramount plus": "Paramount+",
  "paramount+": "Paramount+",
  "criterion channel": "Criterion Channel",
  mubi: "MUBI",
};

export async function fetchJustWatchAvailability(movieId: string, title: string, year?: number): Promise<AvailabilityResult> {
  try {
    const candidate = await fetchBestJustWatchPage(title, year);

    if (!candidate) {
      return buildFallbackAvailability(movieId, title, year, "unavailable");
    }

    const services = extractServices(candidate.movie);
    const providerLinks = extractProviderLinks(candidate.movie);

    return {
      movieId,
      title: candidate.movie.name ?? title,
      year: extractYear(candidate.movie.dateCreated) ?? year,
      services,
      providerLinks,
      justWatchUrl: candidate.url,
      posterUrl: candidate.movie.image,
      lastCheckedAt: new Date().toISOString(),
      status: services.length > 0 ? "available" : "unavailable",
      matchConfidence: deriveConfidence(candidate.movie, title, year),
    };
  } catch (error) {
    console.error("JustWatch lookup failed", { movieId, title, year, error });
    return buildFallbackAvailability(movieId, title, year, "unknown");
  }
}

async function fetchBestJustWatchPage(
  title: string,
  year?: number,
): Promise<{ movie: JustWatchJsonLdMovie; url: string } | undefined> {
  const urls = buildCandidateUrls(title, year);
  let bestCandidate: { movie: JustWatchJsonLdMovie; url: string; score: number } | undefined;

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const movie = extractJsonLdMovie(html);
    if (!movie) {
      continue;
    }

    const score = scoreMovie(movie, title, year);
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { movie, url: extractCanonicalUrl(html) ?? url, score };
    }

    if (score >= 7) {
      break;
    }
  }

  return bestCandidate && bestCandidate.score >= 4
    ? { movie: bestCandidate.movie, url: bestCandidate.url }
    : undefined;
}

function buildCandidateUrls(title: string, year?: number): string[] {
  const slug = slugifyTitle(title);
  const urls = [`${JUSTWATCH_MOVIE_URL}/${slug}`];

  if (typeof year === "number") {
    urls.unshift(`${JUSTWATCH_MOVIE_URL}/${slug}-${year}`);
  }

  return Array.from(new Set(urls));
}

function extractJsonLdMovie(html: string): JustWatchJsonLdMovie | undefined {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const script of scripts) {
    try {
      const value = JSON.parse(script[1]) as unknown;
      const movie = findMovieJsonLd(value);
      if (movie) {
        return movie;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function findMovieJsonLd(value: unknown): JustWatchJsonLdMovie | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const movie = findMovieJsonLd(item);
      if (movie) {
        return movie;
      }
    }
    return undefined;
  }

  const candidate = value as JustWatchJsonLdMovie & { "@graph"?: unknown };
  if (candidate["@type"] === "Movie") {
    return candidate;
  }

  return findMovieJsonLd(candidate["@graph"]);
}

function extractCanonicalUrl(html: string): string | undefined {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1]) : undefined;
}

function scoreMovie(candidate: JustWatchJsonLdMovie, title: string, year?: number): number {
  let score = 0;
  const candidateTitle = (candidate.name ?? "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  const candidateYear = extractYear(candidate.dateCreated);

  if (typeof year === "number" && typeof candidateYear === "number" && candidateYear !== year) {
    return 0;
  }

  if (candidateTitle === normalizedTitle) {
    score += 4;
  } else if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
    score += 2;
  }

  if (typeof year === "number" && candidateYear === year) {
    score += 3;
  }

  if (extractPotentialActions(candidate).some(isStreamingAction)) {
    score += 1;
  }

  return score;
}

function extractServices(candidate: JustWatchJsonLdMovie): StreamingService[] {
  const mapped = new Set<StreamingService>();

  for (const action of extractPotentialActions(candidate)) {
    if (!isStreamingAction(action)) {
      continue;
    }

    const providerName = action.expectsAcceptanceOf?.offeredBy?.name;
    if (!providerName) {
      continue;
    }

    mapped.add(mapServiceName(providerName));
  }

  return Array.from(mapped);
}

function extractProviderLinks(candidate: JustWatchJsonLdMovie): Record<string, string> | undefined {
  const entries = extractPotentialActions(candidate)
    .filter(isStreamingAction)
    .map((action) => {
      const name = action.expectsAcceptanceOf?.offeredBy?.name;
      const url = action.target?.urlTemplate;
      if (!name || !url) {
        return undefined;
      }
      return [name, decodeHtmlEntities(url)] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function extractPotentialActions(candidate: JustWatchJsonLdMovie): JustWatchPotentialAction[] {
  if (!candidate.potentialAction) {
    return [];
  }

  return Array.isArray(candidate.potentialAction) ? candidate.potentialAction : [candidate.potentialAction];
}

function isStreamingAction(action: JustWatchPotentialAction): boolean {
  if (action["@type"] !== "WatchAction") {
    return false;
  }

  const businessFunction = action.expectsAcceptanceOf?.businessFunction;
  return Boolean(businessFunction && STREAMING_BUSINESS_FUNCTIONS.has(businessFunction));
}

function mapServiceName(providerName: string): StreamingService {
  return SERVICE_NAME_MAP[providerName.trim().toLowerCase()] ?? "Other";
}

function deriveConfidence(candidate: JustWatchJsonLdMovie, title: string, year?: number): "high" | "medium" | "low" {
  const candidateTitle = (candidate.name ?? "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  const candidateYear = extractYear(candidate.dateCreated);

  if (candidateTitle === normalizedTitle && (!year || candidateYear === year)) {
    return "high";
  }

  if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
    return "medium";
  }

  return "low";
}

function extractYear(dateCreated?: string): number | undefined {
  const match = dateCreated?.match(/^(\d{4})/);
  return match ? Number(match[1]) : undefined;
}

function buildFallbackAvailability(
  movieId: string,
  title: string,
  year: number | undefined,
  status: "unavailable" | "unknown",
): AvailabilityResult {
  return {
    movieId,
    title,
    year,
    services: [],
    lastCheckedAt: new Date().toISOString(),
    status,
    matchConfidence: "low",
    justWatchUrl: buildFallbackJustWatchUrl(title),
  };
}

function buildFallbackJustWatchUrl(title: string): string {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(slugifyTitle(title).replace(/-/g, " "))}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
