package timesupapi.ask

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import timesupapi.articles.ArticleListQuery
import timesupapi.articles.ArticleListRow
import java.time.Instant
import java.util.UUID

class AskServiceTest {
    private val listQuery: ArticleListQuery = mock()
    private val service = AskService(listQuery)

    @Test
    fun askReturnsEmptyWhenNoRows() {
        whenever(listQuery.findAll(any(), any())).thenReturn(emptyList())
        assertTrue(service.ask(UUID.randomUUID(), "grid storage", 5).isEmpty())
    }

    @Test
    fun askReturnsScoredExcerpts() {
        val uid = UUID.randomUUID()
        val row = article("a1", "Grid storage advances")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(mapOf("a1" to "grid storage excerpt text"))
        val out = service.ask(uid, "grid storage", 5)
        assertEquals(1, out.size)
        assertEquals("a1", out.first().articleId)
    }

    @Test
    fun askFallsBackToQuestionTokens() {
        val uid = UUID.randomUUID()
        val row = article("a3", "Grid storage advances")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(mapOf("a3" to "grid storage excerpt text"))
        assertEquals(1, service.ask(uid, "x", 5).size)
    }

    @Test
    fun askClampsLimit() {
        val uid = UUID.randomUUID()
        val row = article("a4", "Grid storage advances")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(mapOf("a4" to "grid storage excerpt text"))
        assertEquals(1, service.ask(uid, "grid storage", 0).size)
        assertEquals(1, service.ask(uid, "grid storage", 100).size)
    }

    @Test
    fun askSkipsBlankText() {
        val uid = UUID.randomUUID()
        val row = article("a5", "Blank text")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(mapOf("a5" to "   "))
        assertTrue(service.ask(uid, "grid storage", 5).isEmpty())
    }

    @Test
    fun askScoresZeroOnNoMatch() {
        val uid = UUID.randomUUID()
        val row = article("a6", "Unrelated title")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(mapOf("a6" to "nothing relevant here"))
        val out = service.ask(uid, "grid storage", 5)
        assertEquals(1, out.size)
        assertEquals(0.0, out.first().score)
    }

    @Test
    fun askUsesSummaryWhenNoExcerpt() {
        val uid = UUID.randomUUID()
        val row = article("a7", "Grid storage advances")
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(row))
        whenever(listQuery.findExcerpts(any())).thenReturn(emptyMap())
        val out = service.ask(uid, "grid storage", 5)
        assertEquals(1, out.size)
    }

    private fun article(id: String, title: String): ArticleListRow = ArticleListRow(
        id,
        UUID.randomUUID(),
        "g",
        title,
        null,
        null,
        null,
        null,
        "summary",
        null,
        null,
        null,
        Instant.now(),
        Instant.now(),
        1f,
        0f,
        0f,
    )
}
