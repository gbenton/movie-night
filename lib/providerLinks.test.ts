import test from "node:test";
import assert from "node:assert/strict";
import { mapProviderName, selectProviderLink } from "./providerLinks";

test("selectProviderLink prefers a checked service over the first provider link", () => {
  const link = selectProviderLink(
    {
      Hulu: "https://www.hulu.com/movie/marie-antoinette",
      "HBO Max": "https://play.hbomax.com/show/marie-antoinette",
    },
    ["Hulu", "Max"],
    ["Max"],
  );

  assert.equal(link, "https://play.hbomax.com/show/marie-antoinette");
});

test("selectProviderLink falls back to available services when nothing is checked", () => {
  const link = selectProviderLink(
    {
      Hulu: "https://www.hulu.com/movie/heat",
      Netflix: "https://www.netflix.com/title/heat",
    },
    ["Netflix"],
    [],
  );

  assert.equal(link, "https://www.netflix.com/title/heat");
});

test("mapProviderName canonicalizes common JustWatch subscription variants", () => {
  assert.equal(mapProviderName("Netflix Standard with Ads"), "Netflix");
  assert.equal(mapProviderName("Paramount Plus Premium"), "Paramount+");
  assert.equal(mapProviderName("Paramount Plus Essential"), "Paramount+");
  assert.equal(mapProviderName("Paramount+ Amazon Channel"), "Paramount+");
});
