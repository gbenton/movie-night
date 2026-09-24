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

/** A missing title gets a short cache lifetime, but repeating the same search now will not help. */
export function shouldRetryAvailabilityNow(entry: AvailabilityResult): boolean {
  return entry.status === "unknown";
}

/** Keep the last confirmed answer visible if a refresh cannot reach the provider. */
export function shouldReplaceAvailability(previous: AvailabilityResult | undefined, next: AvailabilityResult): boolean {
  return next.status !== "unknown" || !previous || previous.status === "unknown";
}
