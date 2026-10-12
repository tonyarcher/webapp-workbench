package rssapi.frontpage

import rssapi.persist.ArticleScoreEntity
import java.time.Instant

/** One model's share of stored front-page judgments. */
data class ModelEvidence(val model: String?, val rows: Int, val newestAt: Instant?, val oldestAt: Instant?)

/**
 * Stored judgments grouped by producing model, most rows first. Reads only;
 * it never scores, so inspecting evidence cannot trigger a refresh.
 */
fun modelEvidenceOf(rows: List<ArticleScoreEntity>): List<ModelEvidence> =
    rows.groupBy { it.model }.map { (model, group) ->
        val times = group.mapNotNull { it.scoredAt }
        ModelEvidence(
            model = model,
            rows = group.size,
            newestAt = times.maxOrNull(),
            oldestAt = times.minOrNull(),
        )
    }.sortedWith(compareByDescending<ModelEvidence> { it.rows }.thenBy { it.model ?: "" })
