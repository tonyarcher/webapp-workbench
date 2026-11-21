package rssapi.scrape

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class DiscoverBody(val url: String? = null)

/** Preview the feeds a site advertises before subscribing to one. */
@RestController
class FeedDiscoveryController(private val service: FeedDiscoveryService) {
    @PostMapping("/sources/discover", headers = ["X-Api-Version=1"])
    fun discover(@RequestBody body: DiscoverBody): DiscoveryResult = service.discover(body.url)
}
