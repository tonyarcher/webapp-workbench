package timesupapi.scrape
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class ScrapePreviewBody(val url: String? = null, val selector: String? = null)

/** Preview a page-as-source before any of its articles are saved. */
@RestController
class ScrapeController(private val service: PageScrapeService) {
    @PostMapping("/sources/preview", headers = ["X-Api-Version=1"])
    fun preview(@RequestBody body: ScrapePreviewBody): ScrapePreviewResult = service.preview(body.url, body.selector)
}
