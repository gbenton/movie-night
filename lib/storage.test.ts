import test from "node:test";
import assert from "node:assert/strict";
import { getAvailabilityCache, getLists, getSelectedServices, setAvailabilityCache, setLists, setSelectedServices } from "./storage";

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

test("storage ignores stale or unknown selected services", () => {
  const store = new Map<string, string>([
    ["movie-night:selected-services", JSON.stringify(["Netflix", "Criterion Channel", "MUBI", "Kanopy", "Bogus"])],
  ]);
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

  assert.deepEqual(getSelectedServices(), ["Netflix", "Kanopy"]);

  // cleanup
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test("storage drops malformed lists from localStorage", () => {
  const store = new Map<string, string>([
    ["movie-night:lists", JSON.stringify([
      { id: "bad", name: "Bad", movies: null },
      { id: "good", name: "Good", ranked: false, createdAt: "now", updatedAt: "now", movies: [{ id: "1", title: "Heat", year: 1995 }] },
    ])],
  ]);
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

  assert.deepEqual(getLists().map((list) => list.id), ["good"]);

  // cleanup
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test("storage writes are best-effort when localStorage throws", () => {
  const localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    get length() {
      return 0;
    },
  } satisfies Storage;

  Object.assign(globalThis, { window: { localStorage } });

  assert.doesNotThrow(() => setAvailabilityCache({}));
  assert.doesNotThrow(() => setLists([]));

  // cleanup
  // @ts-expect-error test cleanup
  delete globalThis.window;
});
