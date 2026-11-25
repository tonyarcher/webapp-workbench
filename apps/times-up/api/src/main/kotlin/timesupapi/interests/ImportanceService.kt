package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.ai.AiService
import timesupapi.ai.SummaryLength
import java.security.MessageDigest
import java.util.UUID

data class ImportanceInput(val articleId: String, val title: String, val excerpt: String, val interests: List<String>)
data class ImportanceResult(val articleId: String, val score: Double, val matchedInterest: String?)

@Service
class ImportanceService(private val ai: AiService) {
    private val cache = mutableMapOf<String, ImportanceResult>()

    fun score(userId: UUID, inputs: List<ImportanceInput>): List<ImportanceResult> {
        val out = mutableListOf<ImportanceResult>()
        for (inp in inputs) {
            val key = fingerprint(inp)
            val cached = cache[key]
            if (cached != null) {
                out.add(cached)
                continue
            }
            val result = scoreOne(userId, inp)
            cache[key] = result
            out.add(result)
        }
        return out
    }

    private fun scoreOne(userId: UUID, inp: ImportanceInput): ImportanceResult {
        val joined = inp.interests.joinToString(", ")
        val prompt = buildPrompt(joined, inp)
        return try {
            val raw = ai.summarize(userId, inp.title, prompt, SummaryLength.BRIEF)
            val score = parseScore(raw)
            val matched = inp.interests.firstOrNull {
                inp.title.lowercase().contains(it.lowercase()) ||
                    inp.excerpt.lowercase().contains(it.lowercase())
            }
            ImportanceResult(inp.articleId, score, matched)
        } catch (_: Exception) {
            val hay = (inp.title + " " + inp.excerpt).lowercase()
            val hits = inp.interests.count { hay.contains(it.lowercase()) }
            val score = if (inp.interests.isEmpty()) 0.0 else hits.toDouble() / inp.interests.size
            val matched = inp.interests.firstOrNull { hay.contains(it.lowercase()) }
            ImportanceResult(inp.articleId, score, matched)
        }
    }

    private fun buildPrompt(joined: String, inp: ImportanceInput): String {
        val head = "Rate 0.0-1.0 how much this article matters to these interests: $joined."
        val body = "Title: ${inp.title}\nExcerpt: ${inp.excerpt.take(400)}"
        return "$head\n$body"
    }

    private fun parseScore(raw: String): Double {
        val m = Regex("""(\d+(?:\.\d+)?)""").find(raw) ?: return 0.5
        val v = m.groupValues[1].toDoubleOrNull() ?: 0.5
        return v.coerceIn(0.0, 1.0)
    }

    private fun fingerprint(inp: ImportanceInput): String {
        val md = MessageDigest.getInstance("SHA-256")
        val s = inp.articleId + "|" + inp.interests.sorted().joinToString(",")
        return md.digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
