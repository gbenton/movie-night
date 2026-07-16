import test from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "./lookupQueue";

test("runWithConcurrency processes a large list without exceeding its limit", async () => {
  let active = 0;
  let maxActive = 0;
  const completed: number[] = [];

  await runWithConcurrency(
    Array.from({ length: 250 }, (_, index) => index),
    8,
    async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      completed.push(item);
      active -= 1;
    },
  );

  assert.equal(completed.length, 250);
  assert.equal(new Set(completed).size, 250);
  assert.equal(maxActive, 8);
});

test("runWithConcurrency stops assigning work after cancellation", async () => {
  const controller = new AbortController();
  let completed = 0;

  await runWithConcurrency(
    Array.from({ length: 100 }, (_, index) => index),
    4,
    async () => {
      completed += 1;
      controller.abort();
    },
    controller.signal,
  );

  assert.equal(completed, 1);
});
