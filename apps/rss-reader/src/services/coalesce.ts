/**
 * Elevator-button coalescing: extra calls while a job is in flight join the
 * same promise instead of starting a second job. Once the job settles it is
 * removed from the map, so a later call starts a fresh run.
 */
export function createCoalescer<K extends string, T>() {
    const inflight = new Map<K, Promise<T>>();

    function run(key: K, fn: () => Promise<T>): Promise<T> {
        const existing = inflight.get(key);
        if (existing) return existing;
        const job = fn();
        inflight.set(key, job);
        // Both settle branches clear the entry without leaking a rejection.
        const settled = () => {
            // Ownership check: a stale settle must not clear a newer entry.
            // fn must not reenter run() for the same key — that would start
            // two jobs; this only stops the older settle from deleting the
            // replacement.
            if (inflight.get(key) === job) inflight.delete(key);
        };
        void job.then(settled, settled);
        return job;
    }

    function get(key: K): Promise<T> | undefined {
        return inflight.get(key);
    }

    function has(key: K): boolean {
        return inflight.has(key);
    }

    function keys(): K[] {
        return Array.from(inflight.keys());
    }

    return {run, get, has, keys};
}
