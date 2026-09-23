export function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}
