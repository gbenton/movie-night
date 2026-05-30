"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImportPanel } from "./ImportPanel";
import { ListPicker } from "./ListPicker";
import { MovieListView } from "./MovieListView";
import { ServiceSelector } from "./ServiceSelector";
import { isAvailabilityFresh } from "../lib/availability/cache";
import { filterMovies } from "../lib/filterMovies";
import { createMovieId } from "../lib/normalize";
import { createTimeoutSignal } from "../lib/timeoutSignal";
import {
  getAvailabilityCache,
  getLastUsedListId,
  getLists,
  getSelectedServices,
  clearLastUsedListId,
  setAvailabilityCache,
  setLastUsedListId,
  setLists,
  setSelectedServices,
} from "../lib/storage";
import type { AvailabilityResult, MovieItem, MovieList, StreamingService } from "../lib/types";

const AVAILABILITY_LOOKUP_SPACING_MS = 1_500;
const AVAILABILITY_CLIENT_TIMEOUT_MS = 20_000;
const AVAILABILITY_LOOKUP_MAX_ATTEMPTS = 5;
const AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS = 8_000;
const AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS = 30_000;
const AVAILABILITY_CACHE_WRITE_DEBOUNCE_MS = 2_000;

interface LookupQueueItem {
  movie: MovieItem;
  attempt: number;
}

export function AppShell() {
  const [selectedServices, setSelectedServicesState] = useState<StreamingService[]>([]);
  const [lists, setListsState] = useState<MovieList[]>([]);
  const [lastUsedListId, setLastUsedListIdState] = useState<string>();
  const [availabilityCache, setAvailabilityCacheState] = useState<Record<string, AvailabilityResult>>({});
  const [showAll, setShowAll] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const lookupRunIdRef = useRef(0);
  const inFlightAvailabilityKeysRef = useRef(new Set<string>());
  const skipNextAvailabilityCacheWriteRef = useRef(true);
  const availabilityCacheRef = useRef<Record<string, AvailabilityResult>>({});
  const availabilityCacheWriteTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSelectedServicesState(getSelectedServices());
    setListsState(getLists());
    setLastUsedListIdState(getLastUsedListId());
    setAvailabilityCacheState(getAvailabilityCache());
  }, []);

  useEffect(() => {
    availabilityCacheRef.current = availabilityCache;
  }, [availabilityCache]);

  const activeList = useMemo(
    () => lists.find((list) => list.id === lastUsedListId) ?? lists[0],
    [lists, lastUsedListId],
  );

  useEffect(() => {
    if (!activeList) {
      lookupRunIdRef.current += 1;
      setLoadingCount(0);
      return;
    }

    if (activeList.id !== lastUsedListId) {
      setLastUsedListIdState(activeList.id);
      setLastUsedListId(activeList.id);
    }
  }, [activeList, lastUsedListId]);

  useEffect(() => {
    if (!activeList) {
      lookupRunIdRef.current += 1;
      setLoadingCount(0);
      return;
    }

    const runId = lookupRunIdRef.current + 1;
    lookupRunIdRef.current = runId;

    const currentAvailabilityCache = availabilityCacheRef.current;
    const staleMovieByKey = new Map<string, MovieItem>();
    for (const movie of activeList.movies) {
      const key = createMovieId(movie.title, movie.year);
      const availability = currentAvailabilityCache[key];
      if (
        !inFlightAvailabilityKeysRef.current.has(key) &&
        !isAvailabilityFresh(availability)
      ) {
        staleMovieByKey.set(key, movie);
      }
    }

    const staleMovies = Array.from(staleMovieByKey.values());
    if (staleMovies.length === 0) {
      setLoadingCount(0);
      return;
    }

    let cancelled = false;
    const pendingKeys = new Set(staleMovies.map((movie) => createMovieId(movie.title, movie.year)));
    setLoadingCount(pendingKeys.size);

    (async () => {
      const queue: LookupQueueItem[] = staleMovies.map((movie) => ({ movie, attempt: 1 }));
      let untrustedResultStreak = 0;

      async function lookupMovie({ movie, attempt }: LookupQueueItem) {
        const key = createMovieId(movie.title, movie.year);
        inFlightAvailabilityKeysRef.current.add(key);

        try {
          await waitForDocumentVisible(() => cancelled || lookupRunIdRef.current !== runId);
          if (cancelled || lookupRunIdRef.current !== runId) {
            return;
          }

          const update = await fetchAvailability(movie);
          const trusted = isAvailabilityFresh(update);
          const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;

          if (trusted || exhausted) {
            setAvailabilityCacheState((current) => ({ ...current, [key]: update }));
            pendingKeys.delete(key);
          } else {
            queue.push({ movie, attempt: attempt + 1 });
          }

          untrustedResultStreak = trusted ? 0 : untrustedResultStreak + 1;
        } catch {
          const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;
          if (exhausted) {
            setAvailabilityCacheState((current) => ({
              ...current,
              [key]: buildUnknownAvailability(movie),
            }));
            pendingKeys.delete(key);
          } else {
            queue.push({ movie, attempt: attempt + 1 });
          }

          untrustedResultStreak += 1;
        } finally {
          inFlightAvailabilityKeysRef.current.delete(key);

          if (!cancelled && lookupRunIdRef.current === runId) {
            setLoadingCount(pendingKeys.size);
          }
        }
      }

      while (!cancelled && lookupRunIdRef.current === runId) {
        const item = queue.shift();
        if (!item) {
          break;
        }

        await lookupMovie(item);

        if (queue.length > 0 && !cancelled && lookupRunIdRef.current === runId) {
          await delay(getLookupDelayMs(item.attempt, untrustedResultStreak));
        }
      }

      if (cancelled) {
        return;
      }

      setLoadingCount(0);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeList]);

  useEffect(() => {
    if (skipNextAvailabilityCacheWriteRef.current) {
      skipNextAvailabilityCacheWriteRef.current = false;
      return;
    }

    if (availabilityCacheWriteTimeoutRef.current) {
      window.clearTimeout(availabilityCacheWriteTimeoutRef.current);
    }

    availabilityCacheWriteTimeoutRef.current = window.setTimeout(() => {
      setAvailabilityCache(availabilityCacheRef.current);
      availabilityCacheWriteTimeoutRef.current = undefined;
    }, AVAILABILITY_CACHE_WRITE_DEBOUNCE_MS);

    return () => {
      if (availabilityCacheWriteTimeoutRef.current) {
        window.clearTimeout(availabilityCacheWriteTimeoutRef.current);
        availabilityCacheWriteTimeoutRef.current = undefined;
      }
    };
  }, [availabilityCache]);

  useEffect(() => {
    function flushAvailabilityCache() {
      if (availabilityCacheWriteTimeoutRef.current) {
        window.clearTimeout(availabilityCacheWriteTimeoutRef.current);
        availabilityCacheWriteTimeoutRef.current = undefined;
      }

      setAvailabilityCache(availabilityCacheRef.current);
    }

    function flushWhenHidden() {
      if (document.visibilityState === "hidden") {
        flushAvailabilityCache();
      }
    }

    window.addEventListener("pagehide", flushAvailabilityCache);
    document.addEventListener("visibilitychange", flushWhenHidden);

    return () => {
      window.removeEventListener("pagehide", flushAvailabilityCache);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, []);

  const visibleMovies = useMemo(
    () => filterMovies({ list: activeList, selectedServices, availabilityByMovieKey: availabilityCache, showAll }),
    [activeList, availabilityCache, selectedServices, showAll],
  );

  function handleToggleService(service: StreamingService) {
    const next = selectedServices.includes(service)
      ? selectedServices.filter((selected) => selected !== service)
      : [...selectedServices, service];
    setSelectedServicesState(next);
    setSelectedServices(next);
  }

  function handleImport(list: MovieList) {
    const next = [list, ...lists];
    setListsState(next);
    setLists(next);
    setLastUsedListIdState(list.id);
    setLastUsedListId(list.id);
    setShowAll(false);
  }

  function handleSelectList(listId: string) {
    setLastUsedListIdState(listId);
    setLastUsedListId(listId);
  }

  function handleDeleteList(listId: string) {
    const deletedIndex = lists.findIndex((list) => list.id === listId);
    if (deletedIndex === -1) {
      return;
    }

    const next = lists.filter((list) => list.id !== listId);
    setListsState(next);
    setLists(next);

    if (activeList?.id !== listId) {
      return;
    }

    const nextActiveList = next[deletedIndex] ?? next[deletedIndex - 1];
    setLastUsedListIdState(nextActiveList?.id);
    if (nextActiveList) {
      setLastUsedListId(nextActiveList.id);
    } else {
      clearLastUsedListId();
    }
    setShowAll(false);
  }

  return (
    <main>
      <header className="hero panel">
        <p className="eyebrow">Movie Night</p>
        <h1>What from your trusted lists can you stream right now?</h1>
        <p className="hero-copy">
          Import a list you already trust, filter it by your services, and jump out to watch in a few taps.
        </p>
      </header>

      <div className="stack-lg">
        <ServiceSelector selectedServices={selectedServices} onToggle={handleToggleService} />
        <ImportPanel onImport={handleImport} />
        <ListPicker lists={lists} activeListId={activeList?.id} onSelect={handleSelectList} onDelete={handleDeleteList} />
        <MovieListView
          list={activeList}
          movies={visibleMovies}
          selectedServices={selectedServices}
          showAll={showAll}
          onToggleShowAll={setShowAll}
          loadingCount={loadingCount}
        />
      </div>
    </main>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAvailability(movie: MovieItem): Promise<AvailabilityResult> {
  const response = await fetch(`/api/availability/${encodeURIComponent(movie.id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: movie.title, year: movie.year }),
    signal: createTimeoutSignal(AVAILABILITY_CLIENT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Lookup failed for ${movie.title}`);
  }

  return (await response.json()) as AvailabilityResult;
}

function getLookupDelayMs(attempt: number, untrustedResultStreak: number): number {
  if (untrustedResultStreak >= 3) {
    return AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS;
  }

  if (untrustedResultStreak > 0) {
    return AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS * attempt;
  }

  return AVAILABILITY_LOOKUP_SPACING_MS;
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
    matchConfidence: "low",
  };
}
