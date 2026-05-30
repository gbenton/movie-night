import test from "node:test";
import assert from "node:assert/strict";
import { createTimeoutSignal } from "./timeoutSignal";

test("createTimeoutSignal uses native AbortSignal.timeout when available", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
  let timeoutMs: number | undefined;
  const signal = new AbortController().signal;

  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    value: (ms: number) => {
      timeoutMs = ms;
      return signal;
    },
  });

  try {
    assert.equal(createTimeoutSignal(1234), signal);
    assert.equal(timeoutMs, 1234);
  } finally {
    restoreAbortSignalTimeout(originalDescriptor);
  }
});

test("createTimeoutSignal falls back when AbortSignal.timeout is unavailable", async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");

  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    value: undefined,
  });

  try {
    const signal = createTimeoutSignal(1);
    assert.ok(signal);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(signal.aborted, true);
  } finally {
    restoreAbortSignalTimeout(originalDescriptor);
  }
});

function restoreAbortSignalTimeout(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(AbortSignal, "timeout", descriptor);
  } else {
    delete (AbortSignal as { timeout?: unknown }).timeout;
  }
}
