import { createMovieId } from "./normalize";
import type { AvailabilityResult, DisplayMovie, MovieList, StreamingService } from "./types";

interface FilterOptions {
  list?: MovieList;
  selectedServices: StreamingService[];
  availabilityByMovieKey: Record<string, AvailabilityResult>;
  showAll: boolean;
}

export function filterMovies({ list, selectedServices, availabilityByMovieKey, showAll }: FilterOptions): DisplayMovie[] {
  if (!list) {
    return [];
  }

  const filteredMovies: DisplayMovie[] = [];
  const selectedServiceSet = new Set(selectedServices);

  for (const movie of list.movies) {
    const key = createMovieId(movie.title, movie.year);
    const displayMovie = {
      ...movie,
      availability: availabilityByMovieKey[key],
    } satisfies DisplayMovie;

    if (showAll) {
      filteredMovies.push(displayMovie);
      continue;
    }

    const availability = displayMovie.availability;
    if (!availability || availability.status !== "available") {
      continue;
    }

    if (selectedServices.length === 0) {
      if (availability.services.length > 0) {
        filteredMovies.push(displayMovie);
      }
      continue;
    }

    if (availability.services.some((service) => selectedServiceSet.has(service))) {
      filteredMovies.push(displayMovie);
    }
  }

  return filteredMovies;
}
