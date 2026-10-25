// Serialises read-modify-write access to the mock account database so the
// demo API and the paid booking routes never overwrite each other's changes.
let queue: Promise<unknown> = Promise.resolve();

export function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const work = queue.then(fn);
  queue = work.catch(() => {});
  return work;
}
