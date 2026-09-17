import assert from "node:assert/strict";
import { test } from "node:test";
import { poolSize, runPool } from "./pool.mjs";

function withJobs(value, fn) {
  const prev = process.env.JOBS;
  return (async () => {
    if (value === undefined) delete process.env.JOBS;
    else process.env.JOBS = value;
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.JOBS;
      else process.env.JOBS = prev;
    }
  })();
}

test("poolSize honors JOBS and defaults sanely", async () => {
  let def = 1;
  await withJobs(undefined, async () => {
    def = poolSize();
    assert.ok(Number.isInteger(def) && def >= 1);
  });
  await withJobs("3", async () => {
    assert.equal(poolSize(), 3);
  });
  await withJobs("0", async () => {
    assert.equal(poolSize(), def);
  });
  await withJobs("2x", async () => {
    assert.equal(poolSize(), def);
  });
  await withJobs(" 4 ", async () => {
    assert.equal(poolSize(), 4);
  });
});

test("runPool runs everything within the limit", async () => {
  await withJobs("2", async () => {
    let live = 0;
    let peak = 0;
    const seen = [];
    const failed = await runPool([1, 2, 3, 4, 5], async (n) => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((resolve) => setTimeout(resolve, 5));
      live -= 1;
      seen.push(n);
    });
    assert.deepEqual(failed, []);
    assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
    assert.equal(peak, 2);
  });
});

test("runPool collects failures and keeps going", async () => {
  await withJobs("1", async () => {
    const seen = [];
    const failed = await runPool(["a", "b", "c"], async (item) => {
      seen.push(item);
      if (item === "b") throw new Error("boom");
    });
    assert.deepEqual(seen, ["a", "b", "c"]);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].item, "b");
    assert.match(failed[0].error.message, /boom/);
  });
});

test("runPool handles an empty list", async () => {
  assert.deepEqual(await runPool([], async () => {
    throw new Error("must not run");
  }), []);
});
