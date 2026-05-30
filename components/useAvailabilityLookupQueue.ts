"use client";

import { useEffect, useRef } from "react";
import { isAvailabilityFresh } from "../lib/availability/cache";
import { createMovieId } from "../lib/normalize";
import { createTimeoutSignal } from "../lib/timeoutSignal";
import type { AvailabilityResult, MovieItem, MovieList } from "../lib/types";

const AVAILABILITY_FIRST_PASS_CONCURRENCY = 2;
const AVAILABILITY_FIRST_PASS_START_SPACING_MS = 1_250;
const AVAILABILITY_RETRY_CONCURRENCY = 1;
const AVAILABILITY_RETRY_START_SPACING_MS = 2_500;
const AVAILABILITY_CLIENT_TIMEOUT_MS = 20_000;
export const AVAILABILITY_LOOKUP_MAX_ATTEMPTS = 5;
const AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS = 6_000;
const AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS = 12_000;

interface LookupQueueItem {
  movie: MovieItem;
  attempt: number;
}

interface AvailabilityLookupQueueOptions {
  activeList?: MovieList;
  availabilityCache: Record<string, AvailabilityResult>;
  onAvailability: (movieKey: string, availability: AvailabilityResult) => void;
  onLoadingCountChange: (loadingCount: number) => void;
  onRetryAttemptChange: (retryAttempt: number) => void;
  onRetryCountChange: (retryCount: number) => void;
}

export function useAvailabilityLookupQueue({
  activeList,
  availabilityCache,
  onAvailability,
  onLoadingCountChange,
  onRetryAttemptChange,
  onRetryCountChange,
}: AvailabilityLookupQueueOptions) {
  const lookupRunIdRef = useRef(0);
  const inFlightAvailabilityKeysRef = useRef<Set<string>>(new Set());
  const availabilityCacheRef = useRef<Record<string, AvailabilityResult>>(availabilityCache);

  useEffect(() => {
    availabilityCacheRef.current = availabilityCache;
  }, [availabilityCache]);

  useEffect(() => {
    function resetQueueStatus() {
      onLoadingCountChange(0);
      onRetryCountChange(0);
      onRetryAttemptChange(0);
    }

    if (!activeList) {
      lookupRunIdRef.current += 1;
      resetQueueStatus();
      return;
    }

    const runId = lookupRunIdRef.current + 1;
    lookupRunIdRef.current = runId;

    const staleMovieByKey = new Map<string, MovieItem>();
    for (const movie of activeList.movies) {
      const key = createMovieId(movie.title, movie.year);
      const availability = availabilityCacheRef.current[key];
      if (!inFlightAvailabilityKeysRef.current.has(key) && !isAvailabilityFresh(availability)) {
        staleMovieByKey.set(key, movie);
      }
    }

    const staleMovies = Array.from(staleMovieByKey.values());
    if (staleMovies.length === 0) {
      resetQueueStatus();
      return;
    }

    let cancelled = false;
    const foregroundPendingKeys = new Set(staleMovies.map((movie) => createMovieId(movie.title, movie.year)));
    const retryPendingKeys = new Set<string>();
    onLoadingCountChange(foregroundPendingKeys.size);
    onRetryCountChange(0);
    onRetryAttemptChange(0);

    runLookupQueue({
      getCancelled: () => cancelled || lookupRunIdRef.current !== runId,
      inFlightAvailabilityKeys: inFlightAvailabilityKeysRef.current,
      movies: staleMovies,
      onAvailability,
      onComplete: resetQueueStatus,
      onLoadingCountChange,
      onRetryAttemptChange,
      onRetryCountChange,
      foregroundPendingKeys,
      retryPendingKeys,
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeList,
    onAvailability,
    onLoadingCountChange,
    onRetryAttemptChange,
    onRetryCountChange,
  ]);
}

interface RunLookupQueueOptions {
  foregroundPendingKeys: Set<string>;
  getCancelled: () => boolean;
  inFlightAvailabilityKeys: Set<string>;
  movies: MovieItem[];
  onAvailability: (movieKey: string, availability: AvailabilityResult) => void;
  onComplete: () => void;
  onLoadingCountChange: (loadingCount: number) => void;
  onRetryAttemptChange: (retryAttempt: number) => void;
  onRetryCountChange: (retryCount: number) => void;
  retryPendingKeys: Set<string>;
}

function runLookupQueue({
  foregroundPendingKeys,
  getCancelled,
  inFlightAvailabilityKeys,
  movies,
  onAvailability,
  onComplete,
  onLoadingCountChange,
  onRetryAttemptChange,
  onRetryCountChange,
  retryPendingKeys,
}: RunLookupQueueOptions) {
  void (async () => {
    const firstPassQueue: LookupQueueItem[] = movies.map((movie) => ({ movie, attempt: 1 }));
    const retryQueue: LookupQueueItem[] = [];
    const waitForFirstPassStart = createStartLimiter(AVAILABILITY_FIRST_PASS_START_SPACING_MS);
    const waitForRetryStart = createStartLimiter(AVAILABILITY_RETRY_START_SPACING_MS);
    let rateLimitPauseUntil = 0;
    let untrustedResultStreak = 0;

    async function lookupMovie({ movie, attempt }: LookupQueueItem) {
      const key = createMovieId(movie.title, movie.year);
      inFlightAvailabilityKeys.add(key);

      try {
        await waitForDocumentVisible(getCancelled);
        if (getCancelled()) {
          return;
        }

        const update = await fetchAvailability(movie);
        const trusted = isAvailabilityFresh(update);
        const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;
        if (trusted || exhausted) {
          onAvailability(key, update);
        }
        markForegroundLookupFinished(key);

        if (!trusted && !exhausted) {
          retryPendingKeys.add(key);
          retryQueue.push({ movie, attempt: attempt + 1 });
        } else {
          retryPendingKeys.delete(key);
        }

        untrustedResultStreak = trusted ? 0 : untrustedResultStreak + 1;
      } catch (error) {
        if (error instanceof AvailabilityRateLimitError) {
          rateLimitPauseUntil = Math.max(rateLimitPauseUntil, Date.now() + error.retryAfterMs);
          markForegroundLookupFinished(key);
          retryPendingKeys.add(key);
          retryQueue.push({ movie, attempt });
          return;
        }

        const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;
        markForegroundLookupFinished(key);

        if (exhausted) {
          onAvailability(key, buildUnknownAvailability(movie));
        }

        if (!exhausted) {
          retryPendingKeys.add(key);
          retryQueue.push({ movie, attempt: attempt + 1 });
        } else {
          retryPendingKeys.delete(key);
        }

        untrustedResultStreak += 1;
      } finally {
        inFlightAvailabilityKeys.delete(key);

        if (!getCancelled()) {
          onLoadingCountChange(foregroundPendingKeys.size);
          onRetryCountChange(retryPendingKeys.size);
        }
      }
    }

    function markForegroundLookupFinished(key: string) {
      foregroundPendingKeys.delete(key);
    }

    async function processLookupItems(
      items: LookupQueueItem[],
      workerCount: number,
      waitForStart: (shouldCancel: () => boolean) => Promise<void>,
    ): Promise<void> {
      async function runWorker(): Promise<void> {
        if (getCancelled()) {
          return;
        }

        const item = items.shift();
        if (!item) {
          return;
        }

        await waitForStart(getCancelled);
        await waitForRateLimitPause();
        if (getCancelled()) {
          return;
        }

        await lookupMovie(item);
        return runWorker();
      }

      await Promise.all(Array.from({ length: workerCount }, runWorker));
    }

    async function processRetryQueue(): Promise<void> {
      if (getCancelled()) {
        return;
      }

      const nextAttempt = retryQueue[0]?.attempt;
      if (!nextAttempt) {
        return;
      }

      const retryWave: LookupQueueItem[] = [];
      while (retryQueue[0]?.attempt === nextAttempt) {
        const item = retryQueue.shift();
        if (item) {
          retryWave.push(item);
        }
      }

      onRetryAttemptChange(nextAttempt);
      await delay(getRetryDelayMs(nextAttempt, untrustedResultStreak));
      await processLookupItems(
        retryWave,
        Math.min(AVAILABILITY_RETRY_CONCURRENCY, retryWave.length),
        waitForRetryStart,
      );
      return processRetryQueue();
    }

    async function waitForRateLimitPause(): Promise<void> {
      const waitMs = rateLimitPauseUntil - Date.now();
      if (waitMs > 0) {
        await delay(waitMs);
      }
    }

    await processLookupItems(
      firstPassQueue,
      Math.min(AVAILABILITY_FIRST_PASS_CONCURRENCY, firstPassQueue.length),
      waitForFirstPassStart,
    );
    await processRetryQueue();

    if (!getCancelled()) {
      onComplete();
    }
  })();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStartLimiter(spacingMs: number): (shouldCancel: () => boolean) => Promise<void> {
  let nextStartAt = 0;

  return async (shouldCancel: () => boolean) => {
    if (shouldCancel()) {
      return;
    }

    const now = Date.now();
    const startAt = Math.max(now, nextStartAt);
    nextStartAt = startAt + spacingMs;
    const waitMs = startAt - now;

    if (waitMs > 0) {
      await delay(waitMs);
    }
  };
}

async function fetchAvailability(movie: MovieItem): Promise<AvailabilityResult> {
  const response = await fetch(`/api/availability/${encodeURIComponent(movie.id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: movie.title, year: movie.year }),
    signal: createTimeoutSignal(AVAILABILITY_CLIENT_TIMEOUT_MS),
  });

  if (response.status === 429) {
    const body = (await response.json().catch(() => ({}))) as Partial<AvailabilityResult>;
    throw new AvailabilityRateLimitError(body.retryAfterMs ?? parseRetryAfterHeader(response.headers.get("Retry-After")));
  }

  if (!response.ok) {
    throw new Error(`Lookup failed for ${movie.title}`);
  }

  return (await response.json()) as AvailabilityResult;
}

class AvailabilityRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Availability provider asked us to slow down");
    this.name = "AvailabilityRateLimitError";
    this.retryAfterMs = Math.max(1_000, retryAfterMs);
  }
}

function parseRetryAfterHeader(value: string | null): number {
  if (!value) {
    return AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS;
  }

  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1_000;
  }

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt)
    ? AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS
    : Math.max(1_000, retryAt - Date.now());
}

function getRetryDelayMs(attempt: number, untrustedResultStreak: number): number {
  if (untrustedResultStreak >= 3) {
    return AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS;
  }

  if (untrustedResultStreak > 0) {
    return AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS * (attempt - 1);
  }

  return AVAILABILITY_RETRY_START_SPACING_MS;
}

function waitForDocumentVisible(shouldCancel: () => boolean): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState !== "hidden" || shouldCancel()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const interval = window.setInterval(handleVisibilityChange, 1_000);

    function handleVisibilityChange() {
      if (document.visibilityState !== "hidden" || shouldCancel()) {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        resolve();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
  });
}

function buildUnknownAvailability(movie: MovieItem): AvailabilityResult {
  return {
    movieId: movie.id,
    title: movie.title,
    year: movie.year,
    services: [],
    lastCheckedAt: new Date().toISOString(),
    status: "unknown",
  };
}
