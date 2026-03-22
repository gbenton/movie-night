import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonImport } from "./parseJsonImport.ts";

test("parseJsonImport accepts valid structured imports", () => {
  const list = parseJsonImport(JSON.stringify({ listName: "Favorites", items: [{ rank: 1, title: "Heat", year: 1995 }] }));
  assert.equal(list.name, "Favorites");
  assert.equal(list.ranked, true);
  assert.equal(list.movies[0].title, "Heat");
});

test("parseJsonImport rejects payloads without items", () => {
  assert.throws(() => parseJsonImport(JSON.stringify({ listName: "Favorites" })), /items/);
});
