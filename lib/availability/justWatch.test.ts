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
    "https://www.justwatch.com/us/search?q=Parasite",
  ]);
  assert.equal(result.status, "unavailable");
  assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/search?q=parasite");
});

test("fetchJustWatchAvailability falls back to search results for alternate JustWatch slugs", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes("/search?")) {
      return new Response(
        `
          <a href="/us/movie/hua-yang-nian-hua">In the Mood for Love</a>
          {"fullPath":"\\u002Fus\\u002Fmovie\\u002Fat-in-the-mood-for-love"}
        `,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    if (url.endsWith("/hua-yang-nian-hua")) {
      return new Response(
        `
          <html>
            <head>
              <link rel="canonical" href="https://www.justwatch.com/us/movie/hua-yang-nian-hua">
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Movie",
                  "name": "In the Mood for Love",
                  "dateCreated": "2000-09-29",
                  "potentialAction": {
                    "@type": "WatchAction",
                    "target": { "@type": "EntryPoint", "urlTemplate": "https://play.hbomax.com/show/in-the-mood-for-love" },
                    "expectsAcceptanceOf": {
                      "@type": "Offer",
                      "businessFunction": "https://schema.org/ProvideService",
                      "offeredBy": { "@type": "Organization", "name": "Max" }
                    }
                  }
                }
              </script>
            </head>
          </html>
        `,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    return new Response("", { status: 404 });
  };

  const result = await fetchJustWatchAvailability("in-the-mood-for-love__2000", "In the Mood for Love", 2000);

  assert.deepEqual(requestedUrls, [
    "https://www.justwatch.com/us/movie/in-the-mood-for-love-2000",
    "https://www.justwatch.com/us/movie/in-the-mood-for-love",
    "https://www.justwatch.com/us/search?q=In%20the%20Mood%20for%20Love",
    "https://www.justwatch.com/us/movie/hua-yang-nian-hua",
  ]);
  assert.equal(result.status, "available");
  assert.deepEqual(result.services, ["Max"]);
  assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/movie/hua-yang-nian-hua");
});

test("fetchJustWatchAvailability prefers a stronger search result over a weak direct slug match", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.endsWith("/marie-antoinette-2006")) {
      return new Response(
        `
          <script type="application/ld+json">
            {
              "@type": "Movie",
              "name": "Marie-Antoinette",
              "dateCreated": "2006-01-01",
              "potentialAction": {
                "@type": "WatchAction",
                "target": { "@type": "EntryPoint", "urlTemplate": "https://www.raiplay.it/programmi/mariaantonietta-lastoriavera" },
                "expectsAcceptanceOf": {
                  "@type": "Offer",
                  "businessFunction": "https://schema.org/ProvideService",
                  "offeredBy": { "@type": "Organization", "name": "Rai Play" }
                }
              }
            }
          </script>
        `,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    if (url.endsWith("/marie-antoinette")) {
      return new Response("", { status: 404 });
    }

    if (url.includes("/search?")) {
      return new Response(
        `
          <a href="/us/movie/marie-antoinette-2006-0">Marie Antoinette</a>
          <a href="/us/movie/marie-antoinette-2006">Marie-Antoinette</a>
        `,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    if (url.endsWith("/marie-antoinette-2006-0")) {
      return new Response(
        `
          <head>
            <link rel="canonical" href="https://www.justwatch.com/us/movie/marie-antoinette-2006-0">
            <script type="application/ld+json">
              {
                "@type": "Movie",
                "name": "Marie Antoinette",
                "dateCreated": "2006-05-24",
                "potentialAction": {
                  "@type": "WatchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": "https://play.hbomax.com/show/marie-antoinette" },
                  "expectsAcceptanceOf": {
                    "@type": "Offer",
                    "businessFunction": "https://schema.org/ProvideService",
                    "offeredBy": { "@type": "Organization", "name": "HBO Max" }
                  }
                }
              }
            </script>
          </head>
        `,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    return new Response("", { status: 404 });
  };

  const result = await fetchJustWatchAvailability("marie-antoinette__2006", "Marie Antoinette", 2006);

  assert.deepEqual(requestedUrls, [
    "https://www.justwatch.com/us/movie/marie-antoinette-2006",
    "https://www.justwatch.com/us/movie/marie-antoinette",
    "https://www.justwatch.com/us/search?q=Marie%20Antoinette",
    "https://www.justwatch.com/us/movie/marie-antoinette-2006-0",
  ]);
  assert.equal(result.status, "available");
  assert.deepEqual(result.services, ["Max"]);
  assert.equal(result.providerLinks?.Max, "https://play.hbomax.com/show/marie-antoinette");
  assert.equal(result.justWatchUrl, "https://www.justwatch.com/us/movie/marie-antoinette-2006-0");
  assert.equal(result.matchConfidence, "high");
});
