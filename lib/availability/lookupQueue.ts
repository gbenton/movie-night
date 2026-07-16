export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;

  async function runWorker() {
    while (!signal?.aborted) {
      const item = items[nextIndex];
      nextIndex += 1;

      if (item === undefined) {
        return;
      }

      await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => runWorker()),
  );
}
