"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImportPanel } from "./ImportPanel";
import { ListPicker } from "./ListPicker";
import { MovieListView } from "./MovieListView";
import { ServiceSelector } from "./ServiceSelector";
import { isAvailabilityFresh } from "../lib/availability/cache";
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

const AVAILABILITY_LOOKUP_CONCURRENCY = 2;
const AVAILABILITY_LOOKUP_SPACING_MS = 200;
const AVAILABILITY_CLIENT_TIMEOUT_MS = 12_000;

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

  useEffect(() => {
    setSelectedServicesState(getSelectedServices());
    setListsState(getLists());
    setLastUsedListIdState(getLastUsedListId());
    setAvailabilityCacheState(getAvailabilityCache());
  }, []);

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

    const staleMovieByKey = new Map<string, MovieItem>();
    for (const movie of activeList.movies) {
      const key = createMovieId(movie.title, movie.year);
      const availability = availabilityCache[key];
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
    setLoadingCount(staleMovies.length);

    (async () => {
      let nextMovieIndex = 0;

      async function lookupMovie(movie: MovieItem) {
        const key = createMovieId(movie.title, movie.year);
        inFlightAvailabilityKeysRef.current.add(key);
        let update: AvailabilityResult;

        try {
          const response = await fetch(`/api/availability/${encodeURIComponent(movie.id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: movie.title, year: movie.year }),
            signal: AbortSignal.timeout(AVAILABILITY_CLIENT_TIMEOUT_MS),
          });

          if (!response.ok) {
            throw new Error(`Lookup failed for ${movie.title}`);
          }

          update = (await response.json()) as AvailabilityResult;
        } catch {
          update = {
            movieId: movie.id,
            title: movie.title,
            year: movie.year,
            services: [],
            lastCheckedAt: new Date().toISOString(),
            status: "unknown",
            matchConfidence: "low",
          };
        } finally {
          inFlightAvailabilityKeysRef.current.delete(key);

          setAvailabilityCacheState((current) => {
            const next = { ...current, [key]: update };
            return next;
          });

          if (!cancelled && lookupRunIdRef.current === runId) {
            setLoadingCount((current) => Math.max(current - 1, 0));
          }
        }
      }

      async function lookupNextMovie() {
        while (!cancelled) {
          const movie = staleMovies[nextMovieIndex];
          nextMovieIndex += 1;

          if (!movie) {
            return;
          }

          await lookupMovie(movie);
          await delay(AVAILABILITY_LOOKUP_SPACING_MS);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(AVAILABILITY_LOOKUP_CONCURRENCY, staleMovies.length) }, () => lookupNextMovie()),
      );

      if (cancelled) {
        return;
      }
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

    setAvailabilityCache(availabilityCache);
  }, [availabilityCache]);

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
