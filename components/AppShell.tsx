"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImportPanel } from "./ImportPanel";
import { ListPicker } from "./ListPicker";
import { MovieListView } from "./MovieListView";
import { ServiceSelector } from "./ServiceSelector";
import { createBatcher, type Batcher } from "../lib/availability/batcher";
import { isAvailabilityFresh } from "../lib/availability/cache";
import { runWithConcurrency } from "../lib/availability/lookupQueue";
import { filterMovies } from "../lib/filterMovies";
import { createMovieId } from "../lib/normalize";
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

const AVAILABILITY_LOOKUP_CONCURRENCY = 8;
const AVAILABILITY_CLIENT_TIMEOUT_MS = 8_000;
const AVAILABILITY_UI_BATCH_MS = 120;
const AVAILABILITY_CACHE_WRITE_MS = 750;

interface LookupProgress {
  total: number;
  remaining: number;
}

interface QueuedAvailabilityUpdate {
  key: string;
  value: AvailabilityResult;
}

export function AppShell() {
  const [selectedServices, setSelectedServicesState] = useState<StreamingService[]>([]);
  const [lists, setListsState] = useState<MovieList[]>([]);
  const [lastUsedListId, setLastUsedListIdState] = useState<string>();
  const [availabilityCache, setAvailabilityCacheState] = useState<Record<string, AvailabilityResult>>({});
  const [showAll, setShowAll] = useState(false);
  const [lookupProgress, setLookupProgress] = useState<LookupProgress>({ total: 0, remaining: 0 });
  const lookupRunIdRef = useRef(0);
  const inFlightAvailabilityKeysRef = useRef(new Set<string>());
  const availabilityCacheRef = useRef<Record<string, AvailabilityResult>>({});
  const lookupProgressRef = useRef<LookupProgress>({ total: 0, remaining: 0 });
  const cacheWriteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const availabilityBatcherRef = useRef<Batcher<QueuedAvailabilityUpdate> | undefined>(undefined);

  if (!availabilityBatcherRef.current) {
    availabilityBatcherRef.current = createBatcher((updates) => {
      const mergedUpdates = Object.fromEntries(updates.map(({ key, value }) => [key, value]));
      const nextCache = { ...availabilityCacheRef.current, ...mergedUpdates };
      availabilityCacheRef.current = nextCache;
      setAvailabilityCacheState(nextCache);
      setLookupProgress({ ...lookupProgressRef.current });
      scheduleAvailabilityCacheWrite();
    }, AVAILABILITY_UI_BATCH_MS);
  }

  useEffect(() => {
    setSelectedServicesState(getSelectedServices());
    setListsState(getLists());
    setLastUsedListIdState(getLastUsedListId());
    const storedAvailability = getAvailabilityCache();
    availabilityCacheRef.current = storedAvailability;
    setAvailabilityCacheState(storedAvailability);
  }, []);

  useEffect(() => {
    function persistBeforeLeaving() {
      availabilityBatcherRef.current?.flush();
      setAvailabilityCache(availabilityCacheRef.current);
    }

    window.addEventListener("pagehide", persistBeforeLeaving);
    return () => {
      window.removeEventListener("pagehide", persistBeforeLeaving);
      availabilityBatcherRef.current?.cancel();
      if (cacheWriteTimerRef.current) {
        clearTimeout(cacheWriteTimerRef.current);
      }
    };
  }, []);

  const activeList = useMemo(
    () => lists.find((list) => list.id === lastUsedListId) ?? lists[0],
    [lists, lastUsedListId],
  );

  useEffect(() => {
    if (!activeList) {
      lookupRunIdRef.current += 1;
      lookupProgressRef.current = { total: 0, remaining: 0 };
      setLookupProgress(lookupProgressRef.current);
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
      lookupProgressRef.current = { total: 0, remaining: 0 };
      setLookupProgress(lookupProgressRef.current);
      return;
    }

    const runId = lookupRunIdRef.current + 1;
    lookupRunIdRef.current = runId;
    const inFlightAvailabilityKeys = inFlightAvailabilityKeysRef.current;

    const staleMovieByKey = new Map<string, MovieItem>();
    for (const movie of activeList.movies) {
      const key = createMovieId(movie.title, movie.year);
      const availability = availabilityCacheRef.current[key];
      if (
        !inFlightAvailabilityKeys.has(key) &&
        !isAvailabilityFresh(availability)
      ) {
        staleMovieByKey.set(key, movie);
      }
    }

    const staleMovies = Array.from(staleMovieByKey.values());
    if (staleMovies.length === 0) {
      lookupProgressRef.current = { total: 0, remaining: 0 };
      setLookupProgress(lookupProgressRef.current);
      return;
    }

    const controller = new AbortController();
    lookupProgressRef.current = { total: staleMovies.length, remaining: staleMovies.length };
    setLookupProgress(lookupProgressRef.current);

    void runWithConcurrency(
      staleMovies,
      AVAILABILITY_LOOKUP_CONCURRENCY,
      async (movie: MovieItem) => {
        const key = createMovieId(movie.title, movie.year);
        inFlightAvailabilityKeys.add(key);
        let update: AvailabilityResult | undefined;

        try {
          const response = await fetch(`/api/availability/${encodeURIComponent(movie.id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: movie.title, year: movie.year }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(AVAILABILITY_CLIENT_TIMEOUT_MS),
            ]),
          });

          if (!response.ok) {
            throw new Error(`Lookup failed for ${movie.title}`);
          }

          update = (await response.json()) as AvailabilityResult;
        } catch {
          if (!controller.signal.aborted) {
            update = {
              movieId: movie.id,
              title: movie.title,
              year: movie.year,
              services: [],
              lastCheckedAt: new Date().toISOString(),
              status: "unknown",
              matchConfidence: "low",
            };
          }
        } finally {
          inFlightAvailabilityKeys.delete(key);

          if (update) {
            if (!controller.signal.aborted && lookupRunIdRef.current === runId) {
              lookupProgressRef.current = {
                ...lookupProgressRef.current,
                remaining: Math.max(lookupProgressRef.current.remaining - 1, 0),
              };
            }
            availabilityBatcherRef.current?.add({ key, value: update });
          }
        }
      },
      controller.signal,
    );

    return () => {
      controller.abort();
      inFlightAvailabilityKeys.clear();
    };
  }, [activeList]);

  const visibleMovies = useMemo(
    () => filterMovies({
      list: activeList,
      selectedServices,
      availabilityByMovieKey: availabilityCache,
      showAll,
      includePending: lookupProgress.remaining > 0,
    }),
    [activeList, availabilityCache, lookupProgress.remaining, selectedServices, showAll],
  );

  function scheduleAvailabilityCacheWrite() {
    if (cacheWriteTimerRef.current) {
      return;
    }

    cacheWriteTimerRef.current = setTimeout(() => {
      cacheWriteTimerRef.current = undefined;
      setAvailabilityCache(availabilityCacheRef.current);
    }, AVAILABILITY_CACHE_WRITE_MS);
  }

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
          loadingCount={lookupProgress.remaining}
          loadingTotal={lookupProgress.total}
        />
      </div>
    </main>
  );
}
