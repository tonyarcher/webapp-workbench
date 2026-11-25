package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.scrape.FeedDiscoveryService

data class CandidateFeed(val label: String, val host: String, val url: String, val title: String, val type: String)

data class CandidateResult(val label: String, val host: String?, val feeds: List<CandidateFeed>)

@Service
class CandidateService(private val resolver: ResolutionService, private val discovery: FeedDiscoveryService) {
    fun candidates(labels: List<String>): List<CandidateResult> {
        val out = mutableListOf<CandidateResult>()
        for (label in labels) {
            val host = resolver.resolve(label)
            if (host == null) {
                out.add(CandidateResult(label, null, emptyList()))
                continue
            }
            val url = "https://$host"
            val feeds = try {
                discovery.discover(url).feeds.map { f ->
                    CandidateFeed(label, host, f.url, f.title, f.type)
                }
            } catch (_: Exception) {
                emptyList()
            }
            out.add(CandidateResult(label, host, feeds))
        }
        return out
    }
}
