package userapi.http

import java.util.concurrent.ConcurrentHashMap

/** Default: 30 attempts per 10 minutes. */
private const val DEFAULT_WINDOW_MS = 10 * 60 * 1000L

class RateLimiter(
    private val limit: Int = 30,
    private val windowMs: Long = DEFAULT_WINDOW_MS,
    private val nowMs: () -> Long = System::currentTimeMillis,
) {
    private val buckets = ConcurrentHashMap<String, Bucket>()

    fun allow(key: String): Boolean {
        val now = nowMs()
        val bucket = buckets.compute(key) { _, existing -> nextBucket(existing, now) }
        return bucket != null && bucket.count <= limit
    }

    private fun nextBucket(existing: Bucket?, now: Long): Bucket {
        if (existing == null || now - existing.start >= windowMs) return Bucket(now, 1)
        return Bucket(existing.start, existing.count + 1)
    }
}

private data class Bucket(val start: Long, val count: Int)
