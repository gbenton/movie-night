import type { DisplayMovie, StreamingService } from "../lib/types";
import { selectProviderLink } from "../lib/providerLinks";

interface MovieRowProps {
  movie: DisplayMovie;
  selectedServices: StreamingService[];
}

export function MovieRow({ movie, selectedServices }: MovieRowProps) {
  const availability = movie.availability;
  const serviceSet = selectedServices.length > 0 ? selectedServices : availability?.services ?? [];
  const matchedServices = availability?.services.filter((service) => serviceSet.includes(service)) ?? [];
  const displayServices = matchedServices.length > 0 ? matchedServices : availability?.services ?? [];
  const link = selectProviderLink(availability?.providerLinks, availability?.services ?? [], selectedServices) ?? availability?.justWatchUrl;
  const unavailable = availability?.status !== "available";
  const watchLabel = availability?.providerLinks ? "Watch" : link ? "Search" : undefined;
  const emptyServiceLabel = getEmptyServiceLabel(availability);

  return (
    <article className={`movie-row ${unavailable ? "muted" : ""}`}>
      <div className="movie-copy">
        <div className="title-row">
          {typeof movie.rank === "number" ? <span className="rank-badge">#{movie.rank}</span> : null}
          <div>
            <h3>{movie.title}</h3>
            <p>{movie.year ?? "Year unknown"}</p>
          </div>
        </div>
        <div className="badge-row">
          {displayServices.length > 0 ? (
            displayServices.map((service) => (
              <span key={`${movie.id}-${service}`} className="service-badge">
                {service}
              </span>
            ))
          ) : (
            <span className="service-badge unavailable">{emptyServiceLabel}</span>
          )}
        </div>
      </div>
      {link && watchLabel ? (
        <a className="watch-link" href={link}>
          {watchLabel}
        </a>
      ) : null}
    </article>
  );
}

function getEmptyServiceLabel(availability: DisplayMovie["availability"]): string {
  if (!availability || (availability.status === "unavailable" && !availability.justWatchUrl && !availability.providerLinks)) {
    return "Checking availability";
  }

  if (availability.status === "unknown") {
    return "Availability unknown";
  }

  return "Not on your services";
}
