package rssapi.frontpage

import org.springframework.stereotype.Component
import rssapi.domain.signalInterest
import rssapi.domain.signalPopularityOutlook
import rssapi.domain.signalReadability
import rssapi.domain.signalWorthy

/** Raw per-article inputs for scoring. All doubles are 0+ magnitudes; NaN maps to 0 downstream. */
data class SignalInput(
    val hot: Double,
    val popularity: Double,
    val engagement: Double,
    val affinity: Double,
    val wordCount: Int,
)

/** Scored signals, each 0..1. `topic` is set only by Jev; the signals path leaves it null. */
data class SignalScores(
    val worthy: Double,
    val interest: Double,
    val popularityOutlook: Double,
    val readability: Double,
    val topic: String? = null,
)

/**
 * Score seam: the service depends on the concrete [SignalScoreProvider] so
 * Spring never has to choose between it and [JevScoreProvider].
 * Do not inject this interface; do not add Jev code here.
 */
interface ScoreProvider {
    fun score(input: SignalInput): SignalScores
}

/** Deterministic blends from `domain/FrontPage.kt`. Sibling: [JevScoreProvider]. */
@Component
class SignalScoreProvider : ScoreProvider {
    override fun score(input: SignalInput): SignalScores = SignalScores(
        worthy = signalWorthy(input.hot, input.popularity, input.engagement, input.affinity),
        interest = signalInterest(input.hot, input.popularity, input.engagement, input.affinity),
        popularityOutlook = signalPopularityOutlook(input.hot, input.popularity, input.engagement, input.affinity),
        readability = signalReadability(input.wordCount),
    )
}
