package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Instant
import java.util.UUID

data class LaneRow(val articleId: String, val title: String, val score: Double, val reason: String)

data class LaneResult(val builtAt: Long, val rows: List<LaneRow>)

@Service
class PromotionLaneService(
    private val interests: InterestRepo,
    private val matcher: InterestMatcher,
    private val importance: ImportanceService,
) {
    internal var clock: Clock = Clock.systemUTC()
    private val cache = mutableMapOf<String, LaneResult>()

    fun build(userId: UUID, limit: Int = 20): LaneResult {
        val dayKey = "$userId:${clock.instant().toString().take(10)}"
        val cached = cache[dayKey]
        if (cached != null) return cached
        val now = clock.instant()
        val sinceMs = now.minusSeconds(7 * 24 * 3600).toEpochMilli()
        val rows = interests.findByUserIdAndEnabled(userId, true)
        val keys = rows.map { it.key }.toSet()
        val matched = matcher.matchingArticles(keys, sinceMs)
        val inputs = matched.take(100).map { id ->
            ImportanceInput(id, id, "", rows.map { it.label })
        }
        val scores = importance.score(userId, inputs)
        val lane = scores.sortedByDescending { it.score }.take(limit).map { r ->
            val interest = r.matchedInterest ?: rows.firstOrNull()?.label ?: "interest"
            LaneRow(r.articleId, r.articleId, r.score, "matched: $interest")
        }
        val result = LaneResult(now.toEpochMilli(), lane)
        cache[dayKey] = result
        return result
    }
}
