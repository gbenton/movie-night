"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ImportPanel } from "./ImportPanel";
import { ListPicker } from "./ListPicker";
import { MovieListView } from "./MovieListView";
import { ServiceSelector } from "./ServiceSelector";
import { AVAILABILITY_LOOKUP_MAX_ATTEMPTS, useAvailabilityLookupQueue } from "./useAvailabilityLookupQueue";
import { createBatcher, type Batcher } from "../lib/availability/batcher";
import { filterMovies } from "../lib/filterMovies";
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
import type { AvailabilityResult, MovieList, StreamingService } from "../lib/types";

const AVAILABILITY_CACHE_WRITE_DEBOUNCE_MS = 2_000;
const AVAILABILITY_UI_BATCH_MS = 120;

interface AppShellState {
  selectedServices: StreamingService[];
  lists: MovieList[];
  lastUsedListId?: string;
  availabilityCache: Record<string, AvailabilityResult>;
  showAll: boolean;
  loadingCount: number;
  retryCount: number;
  retryAttempt: number;
}

interface QueuedAvailabilityUpdate {
  movieKey: string;
  availability: AvailabilityResult;
}

type AppShellAction =
  | { type: "hydrate"; state: AppShellState }
  | { type: "toggleService"; service: StreamingService }
  | { type: "importList"; list: MovieList }
  | { type: "selectList"; listId: string }
  | { type: "deleteList"; listId: string; activeList?: MovieList }
  | { type: "setShowAll"; showAll: boolean }
  | { type: "setLoadingCount"; loadingCount: number }
  | { type: "setRetryCount"; retryCount: number }
  | { type: "setRetryAttempt"; retryAttempt: number }
  | { type: "setAvailabilityBatch"; updates: QueuedAvailabilityUpdate[] };

export function AppShell() {
  const [state, dispatch] = useReducer(appShellReducer, undefined, createEmptyAppShellState);
  const skipNextAvailabilityCacheWriteRef = useRef(true);
  const availabilityCacheRef = useRef<Record<string, AvailabilityResult>>(state.availabilityCache);
  const availabilityCacheWriteTimeoutRef = useRef<number | undefined>(undefined);
  const availabilityBatcherRef = useRef<Batcher<QueuedAvailabilityUpdate> | undefined>(undefined);

  if (!availabilityBatcherRef.current) {
    availabilityBatcherRef.current = createBatcher((updates) => {
      const nextAvailabilityCache = { ...availabilityCacheRef.current };
      for (const { movieKey, availability } of updates) {
        nextAvailabilityCache[movieKey] = availability;
      }
      availabilityCacheRef.current = nextAvailabilityCache;
      dispatch({ type: "setAvailabilityBatch", updates });
    }, AVAILABILITY_UI_BATCH_MS);
  }

  useEffect(() => {
    const hydratedState = createInitialAppShellState();
    availabilityCacheRef.current = hydratedState.availabilityCache;
    dispatch({ type: "hydrate", state: hydratedState });
  }, []);

  useEffect(() => {
    availabilityCacheRef.current = state.availabilityCache;
  }, [state.availabilityCache]);

  const activeList = useMemo(
    () => state.lists.find((list) => list.id === state.lastUsedListId) ?? state.lists[0],
    [state.lists, state.lastUsedListId],
  );

  const handleAvailability = useCallback((movieKey: string, availability: AvailabilityResult) => {
    availabilityBatcherRef.current?.add({ movieKey, availability });
  }, []);
  const handleLoadingCountChange = useCallback((loadingCount: number) => {
    dispatch({ type: "setLoadingCount", loadingCount });
  }, []);
  const handleRetryAttemptChange = useCallback((retryAttempt: number) => {
    dispatch({ type: "setRetryAttempt", retryAttempt });
  }, []);
  const handleRetryCountChange = useCallback((retryCount: number) => {
    dispatch({ type: "setRetryCount", retryCount });
  }, []);

  useAvailabilityLookupQueue({
    activeList,
    availabilityCache: state.availabilityCache,
    onAvailability: handleAvailability,
    onLoadingCountChange: handleLoadingCountChange,
    onRetryAttemptChange: handleRetryAttemptChange,
    onRetryCountChange: handleRetryCountChange,
  });

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
      availabilityBatcherRef.current?.flush();
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
      availabilityBatcherRef.current?.cancel();
    };
  }, []);

  const visibleMovies = useMemo(
    () => filterMovies({
      list: activeList,
      selectedServices: state.selectedServices,
      availabilityByMovieKey: state.availabilityCache,
      showAll: state.showAll,
      includePending: state.loadingCount > 0 || state.retryCount > 0,
    }),
    [activeList, state.availabilityCache, state.loadingCount, state.retryCount, state.selectedServices, state.showAll],
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
          retryCount={state.retryCount}
          retryAttempt={state.retryAttempt}
          retryAttemptLimit={AVAILABILITY_LOOKUP_MAX_ATTEMPTS}
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
    retryCount: 0,
    retryAttempt: 0,
  };
}

function createEmptyAppShellState(): AppShellState {
  return {
    selectedServices: [],
    lists: [],
    availabilityCache: {},
    showAll: false,
    loadingCount: 0,
    retryCount: 0,
    retryAttempt: 0,
  };
}

function appShellReducer(state: AppShellState, action: AppShellAction): AppShellState {
  switch (action.type) {
    case "hydrate":
      return action.state;
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
    case "setRetryCount":
      return state.retryCount === action.retryCount
        ? state
        : { ...state, retryCount: action.retryCount };
    case "setRetryAttempt":
      return state.retryAttempt === action.retryAttempt
        ? state
        : { ...state, retryAttempt: action.retryAttempt };
    case "setAvailabilityBatch": {
      const availabilityCache = { ...state.availabilityCache };
      for (const { movieKey, availability } of action.updates) {
        availabilityCache[movieKey] = availability;
      }
      return { ...state, availabilityCache };
    }
    default:
      return state;
  }
}
