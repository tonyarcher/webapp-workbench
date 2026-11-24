package timesupapi.fetch
interface PageFetcher {
    fun fetchHtml(url: String): String
}
