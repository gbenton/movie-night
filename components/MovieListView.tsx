import { MovieRow } from "./MovieRow.tsx";
import { ShowAllToggle } from "./ShowAllToggle.tsx";
import type { DisplayMovie, MovieList, StreamingService } from "../lib/types.ts";

interface MovieListViewProps {
  list?: MovieList;
  movies: DisplayMovie[];
  selectedServices: StreamingService[];
  showAll: boolean;
  onToggleShowAll: (nextValue: boolean) => void;
  loadingCount: number;
}

export function MovieListView({
  list,
  movies,
  selectedServices,
  showAll,
  onToggleShowAll,
  loadingCount,
}: MovieListViewProps) {
  return (
    <section className="panel list-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Now watching</p>
          <h2>{list?.name ?? "No list selected"}</h2>
        </div>
        <div className="heading-side">
          <ShowAllToggle checked={showAll} onChange={onToggleShowAll} />
        </div>
      </div>
      {loadingCount > 0 ? <p className="helper-text">Checking availability for {loadingCount} title(s)…</p> : null}
      {!list ? (
        <div className="empty-state">
          <h3>No lists yet</h3>
          <p>Import a trusted list to start filtering by what you can stream right now.</p>
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
        <div className="movie-list">
          {movies.map((movie) => (
            <MovieRow key={movie.id} movie={movie} selectedServices={selectedServices} />
          ))}
        </div>
      )}
    </section>
  );
}
