"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MovieRow } from "./MovieRow";
import { ShowAllToggle } from "./ShowAllToggle";
import { normalizeMovieSearch, selectMoviePage } from "../lib/moviePages";
import type { DisplayMovie, MovieList, StreamingService } from "../lib/types";

interface MovieListViewProps {
  list?: MovieList;
  movies: DisplayMovie[];
  selectedServices: StreamingService[];
  showAll: boolean;
  onToggleShowAll: (nextValue: boolean) => void;
  loadingCount: number;
  retryCount: number;
  retryAttempt: number;
  retryAttemptLimit: number;
}

export function MovieListView({
  list,
  movies,
  selectedServices,
  showAll,
  onToggleShowAll,
  loadingCount,
  retryCount,
  retryAttempt,
  retryAttemptLimit,
}: MovieListViewProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeMovieSearch(deferredQuery);
  const filterKey = JSON.stringify([list?.id, selectedServices, showAll, normalizedQuery]);
  const [pagination, setPagination] = useState({ filterKey, page: 0 });
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setQuery("");
  }, [list?.id]);

  useEffect(() => {
    setPagination((current) => current.filterKey === filterKey ? current : { filterKey, page: 0 });
  }, [filterKey]);

  const { movies: displayedMovies, total, page, pageCount, start } = useMemo(
    () => selectMoviePage(movies, normalizedQuery, pagination.filterKey === filterKey ? pagination.page : 0),
    [movies, normalizedQuery, pagination, filterKey],
  );
  const availabilityStatus = getAvailabilityStatus(
    list?.movies.length ?? 0,
    loadingCount,
    retryCount,
    retryAttempt,
    retryAttemptLimit,
  );
  const isChecking = loadingCount > 0 || retryCount > 0;

  function goToPage(nextPage: number) {
    setPagination({ filterKey, page: nextPage });
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start" });
  }

  const pageControls = pageCount > 1 ? (
    <div className="pagination">
      <button type="button" className="page-button" disabled={page === 0} onClick={() => goToPage(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pageCount}</span>
      <button type="button" className="page-button" disabled={page === pageCount - 1} onClick={() => goToPage(page + 1)}>Next</button>
    </div>
  ) : null;

  return (
    <section className="panel list-panel" data-testid="movie-list-panel">
      <div className="section-heading list-heading">
        <div>
          <p className="eyebrow">Now watching</p>
          <h2 ref={headingRef} tabIndex={-1}>{list?.name ?? "No list selected"}</h2>
        </div>
        <div className="heading-side">
          <ShowAllToggle checked={showAll} onChange={onToggleShowAll} />
        </div>
      </div>
      {list ? (
        <label className="stack-sm movie-search">
          <span className="field-label">Search this list</span>
          <input type="search" value={query} placeholder="Title or year" onChange={(event) => setQuery(event.target.value)} />
        </label>
      ) : null}
      {isChecking && availabilityStatus ? (
        <div className="lookup-progress" role="status" aria-live="polite" data-testid="lookup-progress">
          <div className="progress-copy">
            <strong>{availabilityStatus}</strong>
            <span>Results are ready to use as they arrive.</span>
          </div>
          <progress aria-label={availabilityStatus} />
        </div>
      ) : availabilityStatus ? <p className="helper-text">{availabilityStatus}</p> : null}
      {!list ? (
        <div className="empty-state">
          <h3>No lists yet</h3>
          <p>Import a trusted list to start filtering by what you can stream right now.</p>
        </div>
      ) : total === 0 && isChecking ? (
        <div className="empty-state">
          <h3>Finding matches…</h3>
          <p>The first results will appear here as soon as they are ready.</p>
        </div>
      ) : total === 0 ? (
        <div className="empty-state">
          <h3>Nothing matches yet</h3>
          <p>{normalizedQuery
            ? "Try another title or year, or turn on Show all to search every title."
            : "Try Show all to see unavailable titles, or adjust your selected services."}</p>
        </div>
      ) : (
        <>
          <div className="results-summary" data-testid="results-summary">
            <span role="status">Showing {start + 1}–{start + displayedMovies.length} of {total} {showAll ? "titles" : "matches"}{deferredQuery.trim() ? ` for “${deferredQuery.trim()}”` : ""}.</span>
            {loadingCount > 0 ? <span>{loadingCount} still checking</span> : null}
            {loadingCount === 0 && retryCount > 0 ? <span>{retryCount} retrying</span> : null}
          </div>
          {!showAll && !normalizedQuery && total < list.movies.length ? (
            <button type="button" className="browse-all-button" onClick={() => onToggleShowAll(true)}>
              Browse all {list.movies.length} titles
            </button>
          ) : null}
          {pageCount > 1 ? <nav aria-label="Movie pages">{pageControls}</nav> : null}
          <div className="movie-list" data-testid="movie-list" aria-busy={query !== deferredQuery}>
            {displayedMovies.map((movie) => (
              <MovieRow key={movie.id} movie={movie} selectedServices={selectedServices} />
            ))}
          </div>
          {pageCount > 1 ? <nav aria-label="Movie pages, bottom">{pageControls}</nav> : null}
        </>
      )}
    </section>
  );
}

function getAvailabilityStatus(
  movieCount: number,
  loadingCount: number,
  retryCount: number,
  retryAttempt: number,
  retryAttemptLimit: number,
): string | undefined {
  if (loadingCount > 0) {
    if (retryCount > 0) {
      return `Checking ${loadingCount} title(s); ${retryCount} limited or uncertain title(s) queued for retry.`;
    }

    return `Checking availability for ${loadingCount} title(s).`;
  }

  if (retryCount > 0) {
    if (retryAttempt > 1) {
      return `Retry pass ${retryAttempt - 1} of ${retryAttemptLimit - 1} for ${retryCount} limited or uncertain title(s).`;
    }

    return `First pass complete. Retrying ${retryCount} limited or uncertain title(s) in the background.`;
  }

  if (movieCount > 0) {
    return "Availability complete.";
  }

  return undefined;
}
