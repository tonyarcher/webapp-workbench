package rssapi.frontpage

import org.junit.jupiter.api.Test
import rssapi.persist.ArticleScoreEntity
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ModelEvidenceTest {
    private fun row(model: String?, at: Instant?): ArticleScoreEntity =
        ArticleScoreEntity(articleId = "${model}_$at", worthy = 0.5, scoredAt = at, model = model)

    @Test
    fun emptyRowsGiveEmptyEvidence() {
        assertTrue(modelEvidenceOf(emptyList()).isEmpty())
    }

    @Test
    fun groupsByModelWithNewestAndOldest() {
        val first = Instant.ofEpochMilli(1_000L)
        val second = Instant.ofEpochMilli(2_000L)
        val third = Instant.ofEpochMilli(3_000L)
        val evidence = modelEvidenceOf(
            listOf(
                row("jev-latest", first),
                row("jev-latest", third),
                row("signals-v1", second),
                row(null, null),
            ),
        )
        assertEquals(3, evidence.size)
        val decision = evidence.first { it.model == "jev-latest" }
        assertEquals(2, decision.rows)
        assertEquals(third, decision.newestAt)
        assertEquals(first, decision.oldestAt)
        val unmodelled = evidence.first { it.model == null }
        assertEquals(1, unmodelled.rows)
        assertNull(unmodelled.newestAt)
        assertNull(unmodelled.oldestAt)
    }

    @Test
    fun ordersByRowCountThenModel() {
        val evidence = modelEvidenceOf(
            listOf(row("b", null), row("a", null), row("a", null), row("c", null)),
        )
        assertEquals(listOf("a", "b", "c"), evidence.map { it.model })
    }
}
