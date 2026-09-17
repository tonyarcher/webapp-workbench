/** Bounded-parallel task pool for spawning child processes across CPUs. */
import os from "node:os";

export function poolSize() {
  const raw = (process.env.JOBS ?? "").trim();
  if (/^[1-9]\d*$/.test(raw)) return parseInt(raw, 10);
  const cpus = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  return Math.max(1, cpus || 4);
}

export async function runPool(items, run) {
  const pending = [...items];
  const failed = [];
  const workers = Array.from({ length: Math.min(poolSize(), pending.length) }, async () => {
    while (pending.length > 0) {
      const item = pending.shift();
      try {
        await run(item);
      } catch (error) {
        failed.push({ item, error });
      }
    }
  });
  await Promise.all(workers);
  return failed;
}
