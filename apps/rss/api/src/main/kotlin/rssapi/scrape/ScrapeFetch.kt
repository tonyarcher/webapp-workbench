package rssapi.scrape
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.http.HttpStatus
import rssapi.fetch.PageFetcher
import rssapi.platform.ApiException
import rssapi.platform.safeHttpUrl
/** Shared page fetch for every source preview, so URL and transport rules stay in one place. */
object ScrapeFetch {
    fun target(url: String?): String = safeHttpUrl(url)
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "Invalid URL (must be http/https)")

    fun doc(pages: PageFetcher, url: String): Document {
        val html = try {
            pages.fetchHtml(url)
        } catch (err: IllegalStateException) {
            throw ApiException(HttpStatus.BAD_REQUEST, "Could not fetch page: ${err.message ?: "error"}", err)
        }
        return Jsoup.parse(html, url)
    }
}
