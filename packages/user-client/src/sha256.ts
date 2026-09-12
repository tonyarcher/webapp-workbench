// Pure-TypeScript SHA-256 (FIPS 180-4). Fallback for plain-HTTP origins,
// which have no WebCrypto (`crypto.subtle`). Same S256, no new dependency.

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

function rotr(x: number, n: number): number {
    return ((x >>> n) | (x << (32 - n))) >>> 0
}

// All schedule/state indexes are provably in range; the fallback keeps
// consumers with noUncheckedIndexedAccess happy without `!` assertions.
function at(words: Uint32Array | number[], i: number): number {
    return words[i] ?? 0
}

function paddedMessage(data: Uint8Array): DataView {
    const paddedLen = (((data.length + 8) >> 6) + 1) << 6
    const msg = new Uint8Array(paddedLen)
    msg.set(data)
    msg[data.length] = 0x80
    const view = new DataView(msg.buffer)
    view.setUint32(paddedLen - 8, Math.floor(data.length / 0x20000000))
    view.setUint32(paddedLen - 4, (data.length << 3) >>> 0)
    return view
}

function expandSchedule(view: DataView, off: number, w: Uint32Array): void {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
        const s0 = (rotr(at(w, i - 15), 7) ^ rotr(at(w, i - 15), 18) ^ (at(w, i - 15) >>> 3)) >>> 0
        const s1 = (rotr(at(w, i - 2), 17) ^ rotr(at(w, i - 2), 19) ^ (at(w, i - 2) >>> 10)) >>> 0
        w[i] = (at(w, i - 16) + s0 + at(w, i - 7) + s1) >>> 0
    }
}

function roundStep(v: Uint32Array, wi: number, ki: number): void {
    const s1 = (rotr(at(v, 4), 6) ^ rotr(at(v, 4), 11) ^ rotr(at(v, 4), 25)) >>> 0
    const ch = ((at(v, 4) & at(v, 5)) ^ (~at(v, 4) & at(v, 6))) >>> 0
    const t1 = (at(v, 7) + s1 + ch + ki + wi) >>> 0
    const s0 = (rotr(at(v, 0), 2) ^ rotr(at(v, 0), 13) ^ rotr(at(v, 0), 22)) >>> 0
    const maj = ((at(v, 0) & at(v, 1)) ^ (at(v, 0) & at(v, 2)) ^ (at(v, 1) & at(v, 2))) >>> 0
    const t2 = (s0 + maj) >>> 0
    v[7] = at(v, 6)
    v[6] = at(v, 5)
    v[5] = at(v, 4)
    v[4] = (at(v, 3) + t1) >>> 0
    v[3] = at(v, 2)
    v[2] = at(v, 1)
    v[1] = at(v, 0)
    v[0] = (t1 + t2) >>> 0
}

function compressBlock(h: Uint32Array, w: Uint32Array): void {
    const v = Uint32Array.from(h)
    for (let i = 0; i < 64; i++) roundStep(v, at(w, i), at(K, i))
    for (let i = 0; i < 8; i++) h[i] = (at(h, i) + at(v, i)) >>> 0
}

export function sha256Bytes(data: Uint8Array): Uint8Array {
    const h = Uint32Array.from(H0)
    const w = new Uint32Array(64)
    const view = paddedMessage(data)
    for (let off = 0; off < view.byteLength; off += 64) {
        expandSchedule(view, off, w)
        compressBlock(h, w)
    }
    const out = new Uint8Array(32)
    const outView = new DataView(out.buffer)
    for (let i = 0; i < 8; i++) outView.setUint32(i * 4, at(h, i))
    return out
}
