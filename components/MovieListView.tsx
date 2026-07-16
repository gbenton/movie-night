"use client";

import { useEffect, useMemo, useState } from "react";
import { MovieRow } from "./MovieRow";
import { ShowAllToggle } from "./ShowAllToggle";
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

const MOVIES_PER_PAGE = 24;

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
  const [visibleLimit, setVisibleLimit] = useState(MOVIES_PER_PAGE);
  const serviceKey = selectedServices.join("|");

  useEffect(() => {
    setVisibleLimit(MOVIES_PER_PAGE);
  }, [list?.id, serviceKey, showAll]);

  const displayedMovies = useMemo(() => movies.slice(0, visibleLimit), [movies, visibleLimit]);
  const availabilityStatus = getAvailabilityStatus(
    list?.movies.length ?? 0,
    loadingCount,
    retryCount,
    retryAttempt,
    retryAttemptLimit,
  );
  const isChecking = loadingCount > 0 || retryCount > 0;

  return (
    <section className="panel list-panel" data-testid="movie-list-panel">
      <div className="section-heading list-heading">
        <div>
          <p className="eyebrow">Now watching</p>
          <h2>{list?.name ?? "No list selected"}</h2>
        </div>
        <div className="heading-side">
          <ShowAllToggle checked={showAll} onChange={onToggleShowAll} />
        </div>
      </div>
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
      ) : movies.length === 0 && isChecking ? (
        <div className="empty-state">
          <h3>Finding matches…</h3>
          <p>The first results will appear here as soon as they are ready.</p>
        </div>
      ) : movies.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing matches yet</h3>
          <p>
            {selectedServices.length === 0
              ? "Pick one or more services above, or turn on Show all to see the full list."
              : "Try Show all to see unavailable titles, or adjust your selected services."}
          </p>
        </div>
      ) : (
        <>
          <div className="results-summary" data-testid="results-summary">
            <span>Showing {displayedMovies.length} of {movies.length}</span>
            {loadingCount > 0 ? <span>{loadingCount} still checking</span> : null}
            {loadingCount === 0 && retryCount > 0 ? <span>{retryCount} retrying</span> : null}
          </div>
          <div className="movie-list" data-testid="movie-list">
            {displayedMovies.map((movie) => (
              <MovieRow key={movie.id} movie={movie} selectedServices={selectedServices} />
            ))}
          </div>
          {displayedMovies.length < movies.length ? (
            <button
              className="secondary-button load-more-button"
              type="button"
              onClick={() => setVisibleLimit((current) => current + MOVIES_PER_PAGE)}
            >
              Show {Math.min(MOVIES_PER_PAGE, movies.length - displayedMovies.length)} more
            </button>
          ) : null}
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
