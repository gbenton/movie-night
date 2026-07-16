export interface Batcher<T> {
  add: (value: T) => void;
  flush: () => void;
  cancel: () => void;
}

export function createBatcher<T>(onFlush: (values: T[]) => void, delayMs: number): Batcher<T> {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (pending.length === 0) {
      return;
    }

    const values = pending;
    pending = [];
    onFlush(values);
  }

  return {
    add(value) {
      pending.push(value);
      timer ??= setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending = [];
    },
  };
}
