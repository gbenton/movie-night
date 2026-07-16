import { AVAILABILITY_RETRY_TTL_MS, AVAILABILITY_TTL_MS } from "../constants";
import type { AvailabilityResult } from "../types";

export function isAvailabilityFresh(entry?: AvailabilityResult): boolean {
  if (!entry) {
    return false;
  }

  const checkedAt = Date.parse(entry.lastCheckedAt);
  if (Number.isNaN(checkedAt)) {
    return false;
  }

  const age = Date.now() - checkedAt;
  const shouldRetrySoon = (
    entry.status === "unknown"
    || (entry.status === "unavailable" && entry.services.length === 0 && !entry.justWatchUrl && !entry.providerLinks)
    || (entry.status === "unavailable" && entry.services.length === 0 && entry.matchConfidence === "low")
  );

  return age < (shouldRetrySoon ? AVAILABILITY_RETRY_TTL_MS : AVAILABILITY_TTL_MS);
}
