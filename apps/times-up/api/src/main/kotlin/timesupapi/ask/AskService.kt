package timesupapi.ask

import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import timesupapi.articles.ArticleListQuery
import timesupapi.articles.ArticleSort
import timesupapi.articles.articleSpec
import timesupapi.articles.parseSearchQueryText
import java.util.UUID

private const val MAX_CANDIDATES = 200
private const val MAX_RESULTS = 12
private const val ASK_EXCERPT_CHARS = 500

@Service
class AskService(private val listQuery: ArticleListQuery) {
    fun ask(userId: UUID, question: String, limit: Int): List<AskResult> {
        val parsed = parseSearchQueryText(question)
        val tokens = if (parsed.tokens.isNotEmpty()) {
            parsed.tokens
        } else {
            question.lowercase().split(Regex("\\s+")).filter {
                it.length >=
                    3
            }
        }
        val spec =
            articleSpec(userId, timesupapi.articles.ArticleScope.All, false, ArticleSort.NEWEST, null, null, parsed)
        val rows = listQuery.findAll(spec, PageRequest.of(0, MAX_CANDIDATES, Sort.by("publishedAt").descending()))
        val excerpts = listQuery.findExcerpts(rows.map { it.id })
        val scored = scoreRows(rows, excerpts, tokens)
        val take = if (limit < 1) {
            1
        } else if (limit > MAX_RESULTS) {
            MAX_RESULTS
        } else {
            limit
        }
        return scored.sortedByDescending { it.score }.take(take)
    }

    private fun scoreRows(
        rows: List<timesupapi.articles.ArticleListRow>,
        excerpts: Map<String, String>,
        tokens: List<String>,
    ): List<AskResult> {
        val out = mutableListOf<AskResult>()
        for (row in rows) {
            val text = excerpts[row.id] ?: row.summary
            if (text.isNullOrBlank()) continue
            out.add(AskResult(row.id, row.title, text.take(ASK_EXCERPT_CHARS), score(tokens, row.title, text)))
        }
        return out
    }

    private fun score(tokens: List<String>, title: String, text: String): Double {
        if (tokens.isEmpty()) return 0.0
        val hay = (title + " " + text).lowercase()
        var hits = 0
        for (t in tokens) if (hay.contains(t.lowercase())) hits++
        return hits.toDouble() / tokens.size
    }
}
