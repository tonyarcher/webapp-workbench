package timesupapi.interests

import org.springframework.stereotype.Service
import java.util.UUID

private const val SOURCE_BOOST = 0.1
private const val SOURCE_TOPIC_BOOST = 0.25

@Service
class SourceSignalService(private val sources: SourceRepo) {
    fun followedSourceBoost(userId: UUID, matchedInterest: String?): Pair<Double, String?> {
        val validated = sources.findByUserId(userId).filter { it.validated && it.host != null }
        if (validated.isEmpty()) return 0.0 to null
        // A source matters because of its perspective on a topic. When the
        // promoted row already matches an interest, a validated source that
        // covers that topic is a stronger signal than a bare followed source.
        val topicSource = validated.firstOrNull { src ->
            matchedInterest != null && src.label.lowercase().contains(matchedInterest.lowercase())
        }
        return if (topicSource != null) {
            SOURCE_TOPIC_BOOST to "followed source on $matchedInterest"
        } else {
            SOURCE_BOOST to "followed source"
        }
    }
}
