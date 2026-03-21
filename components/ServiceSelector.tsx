import { STREAMING_SERVICES } from "../lib/constants";
import type { StreamingService } from "../lib/types";

interface ServiceSelectorProps {
  selectedServices: StreamingService[];
  onToggle: (service: StreamingService) => void;
}

export function ServiceSelector({ selectedServices, onToggle }: ServiceSelectorProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Your services</h2>
        </div>
        <p className="section-copy">Pick the streamers you actually pay for.</p>
      </div>
      <div className="chip-grid">
        {STREAMING_SERVICES.map((service) => {
          const active = selectedServices.includes(service);
          return (
            <label key={service} className={`service-chip ${active ? "active" : ""}`}>
              <input
                className="sr-only"
                type="checkbox"
                checked={active}
                onChange={() => onToggle(service)}
              />
              <span>{service}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
