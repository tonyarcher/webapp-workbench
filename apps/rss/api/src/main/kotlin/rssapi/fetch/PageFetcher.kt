package rssapi.fetch

interface PageFetcher {
    fun fetchHtml(url: String): String
}
