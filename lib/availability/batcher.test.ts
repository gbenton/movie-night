import test from "node:test";
import assert from "node:assert/strict";
import { createBatcher } from "./batcher";

test("createBatcher collapses a large burst into one flush", async () => {
  const flushes: number[][] = [];
  const batcher = createBatcher<number>((values) => flushes.push(values), 5);

  for (let index = 0; index < 250; index += 1) {
    batcher.add(index);
  }

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].length, 250);
});

test("createBatcher can flush immediately", () => {
  const flushes: string[][] = [];
  const batcher = createBatcher<string>((values) => flushes.push(values), 1_000);

  batcher.add("Heat");
  batcher.add("Moneyball");
  batcher.flush();

  assert.deepEqual(flushes, [["Heat", "Moneyball"]]);
});
