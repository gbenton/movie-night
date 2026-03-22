import test from "node:test";
import assert from "node:assert/strict";
import { getAvailabilityCache, getLists, getSelectedServices, setLists, setSelectedServices } from "./storage.ts";

test("storage returns safe defaults when window is unavailable", () => {
  assert.deepEqual(getSelectedServices(), []);
  assert.deepEqual(getLists(), []);
  assert.deepEqual(getAvailabilityCache(), {});
});

test("storage round-trips with a mocked localStorage", () => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage;

  Object.assign(globalThis, { window: { localStorage } });

  setSelectedServices(["Netflix"]);
  setLists([{ id: "1", name: "Test", ranked: false, createdAt: "now", updatedAt: "now", movies: [] }]);

  assert.deepEqual(getSelectedServices(), ["Netflix"]);
  assert.equal(getLists()[0]?.name, "Test");

  // cleanup
  // @ts-expect-error test cleanup
  delete globalThis.window;
});
