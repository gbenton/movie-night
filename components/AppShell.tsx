"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
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

const AVAILABILITY_LOOKUP_SPACING_MS = 1_000;
const AVAILABILITY_CLIENT_TIMEOUT_MS = 20_000;
const AVAILABILITY_LOOKUP_MAX_ATTEMPTS = 5;
const AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS = 8_000;
const AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS = 30_000;
const AVAILABILITY_CACHE_WRITE_DEBOUNCE_MS = 2_000;

interface LookupQueueItem {
  movie: MovieItem;
  attempt: number;
}

interface AppShellState {
  selectedServices: StreamingService[];
  lists: MovieList[];
  lastUsedListId?: string;
  availabilityCache: Record<string, AvailabilityResult>;
  showAll: boolean;
  loadingCount: number;
}

type AppShellAction =
  | { type: "toggleService"; service: StreamingService }
  | { type: "importList"; list: MovieList }
  | { type: "selectList"; listId: string }
  | { type: "deleteList"; listId: string; activeList?: MovieList }
  | { type: "setShowAll"; showAll: boolean }
  | { type: "setLoadingCount"; loadingCount: number }
  | { type: "setAvailability"; movieKey: string; availability: AvailabilityResult };

export function AppShell() {
  const [state, dispatch] = useReducer(appShellReducer, undefined, createInitialAppShellState);
  const lookupRunIdRef = useRef(0);
  const inFlightAvailabilityKeysRef = useRef<Set<string> | null>(null);
  const skipNextAvailabilityCacheWriteRef = useRef(true);
  const availabilityCacheRef = useRef<Record<string, AvailabilityResult>>({});
  const availabilityCacheWriteTimeoutRef = useRef<number | undefined>(undefined);

  if (inFlightAvailabilityKeysRef.current === null) {
    inFlightAvailabilityKeysRef.current = new Set<string>();
  }

  useEffect(() => {
    availabilityCacheRef.current = state.availabilityCache;
  }, [state.availabilityCache]);

  const activeList = useMemo(
    () => state.lists.find((list) => list.id === state.lastUsedListId) ?? state.lists[0],
    [state.lists, state.lastUsedListId],
  );

  useEffect(() => {
    if (!activeList) {
      lookupRunIdRef.current += 1;
      dispatch({ type: "setLoadingCount", loadingCount: 0 });
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
        !inFlightAvailabilityKeysRef.current?.has(key) &&
        !isAvailabilityFresh(availability)
      ) {
        staleMovieByKey.set(key, movie);
      }
    }

    const staleMovies = Array.from(staleMovieByKey.values());
    if (staleMovies.length === 0) {
      dispatch({ type: "setLoadingCount", loadingCount: 0 });
      return;
    }

    let cancelled = false;
    const foregroundPendingKeys = new Set(staleMovies.map((movie) => createMovieId(movie.title, movie.year)));
    dispatch({ type: "setLoadingCount", loadingCount: foregroundPendingKeys.size });

    (async () => {
      const queue: LookupQueueItem[] = staleMovies.map((movie) => ({ movie, attempt: 1 }));
      let untrustedResultStreak = 0;

      async function lookupMovie({ movie, attempt }: LookupQueueItem) {
        const key = createMovieId(movie.title, movie.year);
        inFlightAvailabilityKeysRef.current?.add(key);

        try {
          await waitForDocumentVisible(() => cancelled || lookupRunIdRef.current !== runId);
          if (cancelled || lookupRunIdRef.current !== runId) {
            return;
          }

          const update = await fetchAvailability(movie);
          const trusted = isAvailabilityFresh(update);
          const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;
          dispatch({ type: "setAvailability", movieKey: key, availability: update });
          markForegroundLookupFinished(key);

          if (!trusted && !exhausted) {
            queue.push({ movie, attempt: attempt + 1 });
          }

          untrustedResultStreak = trusted ? 0 : untrustedResultStreak + 1;
        } catch {
          const exhausted = attempt >= AVAILABILITY_LOOKUP_MAX_ATTEMPTS;
          markForegroundLookupFinished(key);

          if (attempt === 1 || exhausted) {
            dispatch({ type: "setAvailability", movieKey: key, availability: buildUnknownAvailability(movie) });
          }

          if (!exhausted) {
            queue.push({ movie, attempt: attempt + 1 });
          }

          untrustedResultStreak += 1;
        } finally {
          inFlightAvailabilityKeysRef.current?.delete(key);

          if (!cancelled && lookupRunIdRef.current === runId) {
            dispatch({ type: "setLoadingCount", loadingCount: foregroundPendingKeys.size });
          }
        }
      }

      function markForegroundLookupFinished(key: string) {
        if (foregroundPendingKeys.has(key)) {
          foregroundPendingKeys.delete(key);
        }
      }

      async function processNextQueuedMovie(): Promise<void> {
        if (cancelled || lookupRunIdRef.current !== runId) {
          return;
        }

        const item = queue.shift();
        if (!item) {
          return;
        }

        await lookupMovie(item);

        if (queue.length > 0 && !cancelled && lookupRunIdRef.current === runId) {
          await delay(getLookupDelayMs(item.attempt, untrustedResultStreak));
        }

        return processNextQueuedMovie();
      }

      await processNextQueuedMovie();

      if (cancelled) {
        return;
      }

      dispatch({ type: "setLoadingCount", loadingCount: 0 });
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
  }, [state.availabilityCache]);

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
    () => filterMovies({
      list: activeList,
      selectedServices: state.selectedServices,
      availabilityByMovieKey: state.availabilityCache,
      showAll: state.showAll,
    }),
    [activeList, state.availabilityCache, state.selectedServices, state.showAll],
  );

  function handleToggleService(service: StreamingService) {
    const next = state.selectedServices.includes(service)
      ? state.selectedServices.filter((selected) => selected !== service)
      : [...state.selectedServices, service];
    dispatch({ type: "toggleService", service });
    setSelectedServices(next);
  }

  function handleImport(list: MovieList) {
    const next = [list, ...state.lists];
    dispatch({ type: "importList", list });
    setLists(next);
    setLastUsedListId(list.id);
  }

  function handleSelectList(listId: string) {
    dispatch({ type: "selectList", listId });
    setLastUsedListId(listId);
  }

  function handleDeleteList(listId: string) {
    const deletedIndex = state.lists.findIndex((list) => list.id === listId);
    if (deletedIndex === -1) {
      return;
    }

    const next = state.lists.filter((list) => list.id !== listId);
    dispatch({ type: "deleteList", listId, activeList });
    setLists(next);

    if (activeList?.id !== listId) {
      return;
    }

    const nextActiveList = next[deletedIndex] ?? next[deletedIndex - 1];
    if (nextActiveList) {
      setLastUsedListId(nextActiveList.id);
    } else {
      clearLastUsedListId();
    }
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
        <ServiceSelector selectedServices={state.selectedServices} onToggle={handleToggleService} />
        <ImportPanel onImport={handleImport} />
        <ListPicker lists={state.lists} activeListId={activeList?.id} onSelect={handleSelectList} onDelete={handleDeleteList} />
        <MovieListView
          list={activeList}
          movies={visibleMovies}
          selectedServices={state.selectedServices}
          showAll={state.showAll}
          onToggleShowAll={(showAll) => dispatch({ type: "setShowAll", showAll })}
          loadingCount={state.loadingCount}
        />
      </div>
    </main>
  );
}

function createInitialAppShellState(): AppShellState {
  return {
    selectedServices: getSelectedServices(),
    lists: getLists(),
    lastUsedListId: getLastUsedListId(),
    availabilityCache: getAvailabilityCache(),
    showAll: false,
    loadingCount: 0,
  };
}

function appShellReducer(state: AppShellState, action: AppShellAction): AppShellState {
  switch (action.type) {
    case "toggleService": {
      const selectedServices = state.selectedServices.includes(action.service)
        ? state.selectedServices.filter((selected) => selected !== action.service)
        : [...state.selectedServices, action.service];
      return { ...state, selectedServices };
    }
    case "importList":
      return {
        ...state,
        lists: [action.list, ...state.lists],
        lastUsedListId: action.list.id,
        showAll: false,
      };
    case "selectList":
      return { ...state, lastUsedListId: action.listId };
    case "deleteList": {
      const deletedIndex = state.lists.findIndex((list) => list.id === action.listId);
      if (deletedIndex === -1) {
        return state;
      }

      const lists = state.lists.filter((list) => list.id !== action.listId);
      if (action.activeList?.id !== action.listId) {
        return { ...state, lists };
      }

      const nextActiveList = lists[deletedIndex] ?? lists[deletedIndex - 1];
      return {
        ...state,
        lists,
        lastUsedListId: nextActiveList?.id,
        showAll: false,
      };
    }
    case "setShowAll":
      return { ...state, showAll: action.showAll };
    case "setLoadingCount":
      return state.loadingCount === action.loadingCount
        ? state
        : { ...state, loadingCount: action.loadingCount };
    case "setAvailability":
      return {
        ...state,
        availabilityCache: {
          ...state.availabilityCache,
          [action.movieKey]: action.availability,
        },
      };
    default:
      return state;
  }
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
  if (attempt === 1) {
    return AVAILABILITY_LOOKUP_SPACING_MS;
  }

  if (untrustedResultStreak >= 3) {
    return AVAILABILITY_UNTRUSTED_STREAK_COOLDOWN_MS;
  }

  if (untrustedResultStreak > 0) {
    return AVAILABILITY_UNTRUSTED_RETRY_DELAY_MS * (attempt - 1);
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
