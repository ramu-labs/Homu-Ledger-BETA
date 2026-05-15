// Race a promise against a timeout. Resolves to the promise's value if it
// settles in time; rejects with a TimeoutError otherwise.
//
// Motivation: on iOS Safari running as an installed PWA, `navigator.onLine`
// is unreliable in airplane mode (often returns `true` even when there's no
// connectivity) AND fetches initiated in that state get queued by the OS
// rather than rejecting fast. Without a timeout, awaiting a server action
// hangs the UI indefinitely — the original bug that motivated this util.

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
