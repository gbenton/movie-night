import type { DisplayMovie, StreamingService } from "../lib/types.ts";

interface MovieRowProps {
  movie: DisplayMovie;
  selectedServices: StreamingService[];
}

export function MovieRow({ movie, selectedServices }: MovieRowProps) {
  const availability = movie.availability;
  const serviceSet = selectedServices.length > 0 ? selectedServices : availability?.services ?? [];
  const matchedServices = availability?.services.filter((service) => serviceSet.includes(service)) ?? [];
  const displayServices = matchedServices.length > 0 ? matchedServices : availability?.services ?? [];
  const link = firstLink(availability?.providerLinks) ?? availability?.justWatchUrl;
  const unavailable = availability?.status !== "available";

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
            <span className="service-badge unavailable">{availability?.status === "unknown" ? "Lookup failed" : "Not on your services"}</span>
          )}
        </div>
      </div>
      {link ? (
        <a className="watch-link" href={link} target="_blank" rel="noreferrer">
          Watch
        </a>
      ) : null}
    </article>
  );
}

function firstLink(providerLinks?: Record<string, string>): string | undefined {
  if (!providerLinks) {
    return undefined;
  }

  return Object.values(providerLinks)[0];
}
