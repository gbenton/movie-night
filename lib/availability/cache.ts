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

  const ttl = isAvailabilityTrusted(entry) ? AVAILABILITY_TTL_MS : AVAILABILITY_RETRY_TTL_MS;
  return Date.now() - checkedAt < ttl;
}

export function isAvailabilityTrusted(entry?: AvailabilityResult): boolean {
  if (!entry || entry.status === "unknown") {
    return false;
  }

  if (entry.status !== "unavailable" || entry.services.length > 0) {
    return true;
  }

  if (!entry.justWatchUrl && !entry.providerLinks) {
    return false;
  }

  return entry.matchConfidence !== "low";
}
