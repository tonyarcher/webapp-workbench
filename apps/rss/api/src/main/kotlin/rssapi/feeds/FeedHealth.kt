package rssapi.feeds
/**
 * Derived, coarse status for the sidebar. "unreachable" means repeated
 * failures, "stale" means a single failed fetch or a long silence; "ok" is
 * normal. A quiet low-volume feed is not an error on its own.
 */
object FeedHealth {
    const val OK = "ok"
    const val STALE = "stale"
    const val UNREACHABLE = "unreachable"

    private const val DAY_MS = 24L * 60L * 60L * 1_000L
    const val STALE_AFTER_MS: Long = 7L * DAY_MS
    private const val UNREACHABLE_AFTER = 2

    fun statusOf(lastError: String?, failures: Int, lastFetchedAt: Long?, now: Long): String = when {
        failures >= UNREACHABLE_AFTER -> UNREACHABLE
        lastError != null -> STALE
        lastFetchedAt != null && now - lastFetchedAt > STALE_AFTER_MS -> STALE
        else -> OK
    }
}
