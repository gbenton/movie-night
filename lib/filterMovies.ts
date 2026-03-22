import { createMovieId } from "./normalize.ts";
import type { AvailabilityResult, DisplayMovie, MovieList, StreamingService } from "./types.ts";

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

  return list.movies
    .map((movie) => {
      const key = createMovieId(movie.title, movie.year);
      return {
        ...movie,
        availability: availabilityByMovieKey[key],
      } satisfies DisplayMovie;
    })
    .filter((movie) => {
      if (showAll) {
        return true;
      }

      const availability = movie.availability;
      if (!availability || availability.status !== "available") {
        return false;
      }

      if (selectedServices.length === 0) {
        return availability.services.length > 0;
      }

      return availability.services.some((service) => selectedServices.includes(service));
    });
}
