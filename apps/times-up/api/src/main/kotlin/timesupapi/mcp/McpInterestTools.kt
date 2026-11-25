package timesupapi.mcp

import org.springframework.stereotype.Component
import timesupapi.interests.InterestService
import timesupapi.interests.PromotionLaneService
import java.util.UUID

@Component
class McpInterestTools(private val interests: InterestService, private val lane: PromotionLaneService) {
    fun interests(userId: UUID): Any = mapOf(
        "interests" to interests.list(userId).map {
            mapOf("kind" to it.kind, "label" to it.label, "key" to it.key, "weight" to it.weight, "origin" to it.origin)
        },
    )

    fun promotions(userId: UUID): Any {
        val r = lane.build(userId)
        return mapOf(
            "builtAt" to r.builtAt,
            "rows" to r.rows.map {
                mapOf("articleId" to it.articleId, "score" to it.score, "reason" to it.reason)
            },
        )
    }
}
