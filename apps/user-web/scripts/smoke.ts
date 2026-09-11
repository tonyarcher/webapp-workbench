import {healthzUrl, isHealthOk, USER_API_PREFIX} from '../src/services/api.ts';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

assert(USER_API_PREFIX === '/user-api', 'api prefix is origin-absolute');
assert(healthzUrl() === '/user-api/healthz', 'healthz url');
assert(isHealthOk({ok: true}), 'health body ok');
assert(!isHealthOk({ok: false}), 'health body not ok');
assert(!isHealthOk(null), 'null is not health');
assert(!isHealthOk('ok'), 'string is not health');
console.log('user-web smoke ok');
