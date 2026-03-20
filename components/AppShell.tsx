"use client";

import { useEffect, useMemo, useState } from "react";
import { ImportPanel } from "./ImportPanel.tsx";
import { ListPicker } from "./ListPicker.tsx";
import { MovieListView } from "./MovieListView.tsx";
import { ServiceSelector } from "./ServiceSelector.tsx";
import { isAvailabilityFresh } from "../lib/availability/cache.ts";
import { filterMovies } from "../lib/filterMovies.ts";
import { createMovieId } from "../lib/normalize.ts";
import {
  getAvailabilityCache,
  getLastUsedListId,
  getLists,
  getSelectedServices,
  setAvailabilityCache,
  setLastUsedListId,
  setLists,
  setSelectedServices,
} from "../lib/storage.ts";
import type { AvailabilityResult, MovieList, StreamingService } from "../lib/types.ts";

export function AppShell() {
  const [selectedServices, setSelectedServicesState] = useState<StreamingService[]>([]);
  const [lists, setListsState] = useState<MovieList[]>([]);
  const [lastUsedListId, setLastUsedListIdState] = useState<string>();
  const [availabilityCache, setAvailabilityCacheState] = useState<Record<string, AvailabilityResult>>({});
  const [showAll, setShowAll] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [lookupError, setLookupError] = useState<string>();

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
      return;
    }

    if (activeList.id !== lastUsedListId) {
      setLastUsedListIdState(activeList.id);
      setLastUsedListId(activeList.id);
    }
  }, [activeList, lastUsedListId]);

  useEffect(() => {
    if (!activeList) {
      return;
    }

    const staleMovies = activeList.movies.filter((movie) => !isAvailabilityFresh(availabilityCache[createMovieId(movie.title, movie.year)]));
    if (staleMovies.length === 0) {
      return;
    }

    let cancelled = false;
    setLoadingCount(staleMovies.length);
    setLookupError(undefined);

    (async () => {
      const updates: Record<string, AvailabilityResult> = {};

      for (const movie of staleMovies) {
        const key = createMovieId(movie.title, movie.year);
        try {
          const response = await fetch(`/api/availability/${encodeURIComponent(movie.id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: movie.title, year: movie.year }),
          });

          if (!response.ok) {
            throw new Error(`Lookup failed for ${movie.title}`);
          }

          updates[key] = (await response.json()) as AvailabilityResult;
        } catch {
          updates[key] = {
            movieId: movie.id,
            title: movie.title,
            year: movie.year,
            services: [],
            lastCheckedAt: new Date().toISOString(),
            status: "unknown",
            matchConfidence: "low",
          };
          if (!cancelled) {
            setLookupError("Some availability checks failed. You can still browse the rest of the list.");
          }
        } finally {
          if (!cancelled) {
            setLoadingCount((current) => Math.max(current - 1, 0));
          }
        }
      }

      if (cancelled) {
        return;
      }

      setAvailabilityCacheState((current) => {
        const next = { ...current, ...updates };
        setAvailabilityCache(next);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeList, availabilityCache]);

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
        <ListPicker lists={lists} activeListId={activeList?.id} onSelect={handleSelectList} />
        <MovieListView
          list={activeList}
          movies={visibleMovies}
          selectedServices={selectedServices}
          showAll={showAll}
          onToggleShowAll={setShowAll}
          loadingCount={loadingCount}
          error={lookupError}
        />
      </div>
    </main>
  );
}
