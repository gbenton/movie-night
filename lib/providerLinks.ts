import type { StreamingService } from "./types";

const PROVIDER_NAME_MAP: Record<string, StreamingService> = {
  netflix: "Netflix",
  "netflix standard with ads": "Netflix",
  hulu: "Hulu",
  "amazon prime video": "Prime Video",
  "prime video": "Prime Video",
  max: "Max",
  "hbo max": "Max",
  "disney plus": "Disney+",
  "disney+": "Disney+",
  "apple tv plus": "Apple TV+",
  "apple tv+": "Apple TV+",
  "peacock premium": "Peacock",
  peacock: "Peacock",
  paramount: "Paramount+",
  "paramount plus": "Paramount+",
  "paramount plus essential": "Paramount+",
  "paramount plus premium": "Paramount+",
  "paramount+": "Paramount+",
  "paramount+ amazon channel": "Paramount+",
  kanopy: "Kanopy",
};

export function mapProviderName(providerName: string): StreamingService {
  return PROVIDER_NAME_MAP[providerName.trim().toLowerCase()] ?? "Other";
}

export function selectProviderLink(
  providerLinks: Record<string, string> | undefined,
  availableServices: StreamingService[],
  selectedServices: StreamingService[],
): string | undefined {
  if (!providerLinks) {
    return undefined;
  }

  const canonicalLinks = canonicalizeProviderLinks(providerLinks);
  const preferredServices = selectedServices.length > 0
    ? selectedServices.filter((service) => availableServices.includes(service))
    : availableServices;

  for (const service of preferredServices) {
    const link = canonicalLinks[service];
    if (link) {
      return link;
    }
  }

  return Object.values(canonicalLinks)[0];
}

function canonicalizeProviderLinks(providerLinks: Record<string, string>): Partial<Record<StreamingService, string>> {
  const canonicalLinks: Partial<Record<StreamingService, string>> = {};

  for (const [providerName, url] of Object.entries(providerLinks)) {
    const service = mapProviderName(providerName);
    canonicalLinks[service] ??= url;
  }

  return canonicalLinks;
}
