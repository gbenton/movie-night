import test from "node:test";
import assert from "node:assert/strict";
import { fetchJustWatchAvailability } from "./justWatch";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchJustWatchAvailability parses streaming services from JustWatch JSON-LD", async () => {
  let requestedUrl = "";

  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      `
        <html>
          <head>
            <link rel="canonical" href="https://www.justwatch.com/us/movie/parasite-2019">
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Movie",
                "name": "Parasite",
                "dateCreated": "2019-05-30",
                "image": "https://images.justwatch.com/poster/parasite.jpg",
                "potentialAction": [
                  {
                    "@type": "WatchAction",
                    "target": { "@type": "EntryPoint", "urlTemplate": "https://www.kanopy.com/product/justwatch-11347306" },
                    "expectsAcceptanceOf": {
                      "@type": "Offer",
                      "businessFunction": "https://schema.org/ProvideService",
                      "offeredBy": { "@type": "Organization", "name": "Kanopy" }
                    }
                  },
                  {
                    "@type": "WatchAction",
                    "target": { "@type": "EntryPoint", "urlTemplate": "https://watch.amazon.com/detail" },
                    "expectsAcceptanceOf": {
                      "@type": "Offer",
                      "businessFunction": "https://schema.org/RentAction",
                      "offeredBy": { "@type": "Organization", "name": "Amazon Video" }
                    }
                  }
                ]
              }
            </script>
          </head>
        </html>
      `,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  };

  const result = await fetchJustWatchAvailability("parasite__2019", "Parasite", 2019);

  assert.equal(requestedUrl, "https://www.justwatch.com/us/movie/parasite-2019");
  assert.equal(result.status, "available");
  assert.deepEqual(result.services, ["Kanopy"]);
  assert.equal(result.providerLinks?.Kanopy, "https://www.kanopy.com/product/justwatch-11347306");
  assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/movie/parasite-2019");
  assert.equal(result.matchConfidence, "high");
});

test("fetchJustWatchAvailability ignores mismatched slug pages and checks the year-qualified URL", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));

    if (String(input).endsWith("/parasite-2019")) {
      return new Response("", { status: 404 });
    }

    return new Response(
      `
        <script type="application/ld+json">
          {
            "@type": "Movie",
            "name": "Parasite",
            "dateCreated": "1982-03-12",
            "potentialAction": []
          }
        </script>
      `,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  };

  const result = await fetchJustWatchAvailability("parasite__2019", "Parasite", 2019);

  assert.deepEqual(requestedUrls, [
    "https://www.justwatch.com/us/movie/parasite-2019",
    "https://www.justwatch.com/us/movie/parasite",
  ]);
  assert.equal(result.status, "unavailable");
  assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/search?q=parasite");
});
