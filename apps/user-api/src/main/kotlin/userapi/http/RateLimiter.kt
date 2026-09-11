package userapi.http

import java.util.concurrent.ConcurrentHashMap

class RateLimiter(
    private val limit: Int = 30,
    private val windowMs: Long = 10 * 60 * 1000L,
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
