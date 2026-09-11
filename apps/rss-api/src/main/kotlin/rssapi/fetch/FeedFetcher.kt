package rssapi.fetch

data class FetchResult(
    val status: Int,
    val text: String? = null,
    val etag: String? = null,
    val lastModified: String? = null,
)

interface FeedFetcher {
    fun fetch(url: String, etag: String? = null, lastModified: String? = null): FetchResult
}
