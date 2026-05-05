import { AVAILABILITY_TTL_MS } from "../constants";
import type { AvailabilityResult } from "../types";

export function isAvailabilityFresh(entry?: AvailabilityResult): boolean {
  if (!entry) {
    return false;
  }

  if (entry.status === "unknown") {
    return false;
  }

  if (entry.status === "unavailable" && entry.services.length === 0 && !entry.justWatchUrl && !entry.providerLinks) {
    return false;
  }

  const checkedAt = Date.parse(entry.lastCheckedAt);
  if (Number.isNaN(checkedAt)) {
    return false;
  }

  return Date.now() - checkedAt < AVAILABILITY_TTL_MS;
}
