package timesupapi.interests

import org.springframework.stereotype.Service

data class CorroborationInput(
    val articleId: String,
    val clusterSize: Int,
    val crossPostCount: Int,
    val clusterGrowth: Double,
)

data class CorroborationResult(val articleId: String, val boost: Double, val reason: String)

@Service
class CorroborationBoost {
    private val maxBoost = 0.3
    private val crossPostWeight = 0.1
    private val growthWeight = 0.05
    private val clusterWeight = 0.02

    fun boost(inputs: List<CorroborationInput>): List<CorroborationResult> = inputs.map { inp ->
        val raw = inp.crossPostCount * crossPostWeight +
            inp.clusterGrowth * growthWeight +
            (inp.clusterSize - 1) * clusterWeight
        val capped = raw.coerceAtMost(maxBoost)
        val reason = when {
            inp.crossPostCount > 1 -> "corroborated by ${inp.crossPostCount} sources"
            inp.clusterGrowth > 0.5 -> "developing story"
            inp.clusterSize > 1 -> "cluster of ${inp.clusterSize}"
            else -> "single source"
        }
        CorroborationResult(inp.articleId, capped, reason)
    }
}
