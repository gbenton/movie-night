import { slugifyTitle } from "../normalize";
import type { AvailabilityResult, StreamingService } from "../types";
import type { JustWatchJsonLdMovie, JustWatchPotentialAction } from "./types";

const JUSTWATCH_MOVIE_URL = "https://www.justwatch.com/us/movie";
const JUSTWATCH_SEARCH_URL = "https://www.justwatch.com/us/search";

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
  kanopy: "Kanopy",
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
      title: getText(candidate.movie.name) ?? title,
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
  const urls = [...buildCandidateUrls(title, year)];
  let bestCandidate: { movie: JustWatchJsonLdMovie; url: string; score: number } | undefined;

  async function inspectUrl(url: string): Promise<boolean> {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return false;
    }

    const html = await response.text();
    const movie = extractJsonLdMovie(html);
    if (!movie) {
      return false;
    }

    const score = scoreMovie(movie, title, year);
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { movie, url: extractCanonicalUrl(html) ?? url, score };
    }

    return score >= 7;
  }

  for (const url of urls) {
    if (await inspectUrl(url)) {
      break;
    }
  }

  if (!bestCandidate || bestCandidate.score < 7) {
    for (const searchResultUrl of await fetchSearchResultUrls(title)) {
      if (urls.includes(searchResultUrl)) {
        continue;
      }

      urls.push(searchResultUrl);
      if (await inspectUrl(searchResultUrl)) {
        break;
      }
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

async function fetchSearchResultUrls(title: string): Promise<string[]> {
  const response = await fetch(`${JUSTWATCH_SEARCH_URL}?q=${encodeURIComponent(title)}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return [];
  }

  return extractMovieUrls(await response.text()).slice(0, 8);
}

function extractMovieUrls(html: string): string[] {
  const urls: string[] = [];
  const matches = html.matchAll(/(?:href=["'])?(\/us\/movie\/[^"'?#<>\s\\]+)|\\u002Fus\\u002Fmovie\\u002F([^"'?#<>\s\\]+)/gi);

  for (const match of matches) {
    const path = match[1] ?? `/us/movie/${match[2]}`;
    const url = `https://www.justwatch.com${decodeHtmlEntities(path)}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
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
  const candidateTitle = (getText(candidate.name) ?? "").trim().toLowerCase();
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
  const candidateTitle = (getText(candidate.name) ?? "").trim().toLowerCase();
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

function extractYear(dateCreated?: unknown): number | undefined {
  const value = getText(dateCreated);
  const match = value?.match(/^(\d{4})/);
  return match ? Number(match[1]) : undefined;
}

function getText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
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
