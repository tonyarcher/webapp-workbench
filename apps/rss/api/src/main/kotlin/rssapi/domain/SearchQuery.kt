package rssapi.domain

import java.time.LocalDate
import java.time.ZoneOffset

data class SearchOperators(
    val authors: List<String> = emptyList(),
    val feeds: List<String> = emptyList(),
    val folders: List<String> = emptyList(),
    val afterMs: Long? = null,
    val beforeMs: Long? = null,
    val isStarred: Boolean? = null,
    val isUnread: Boolean? = null,
    val isRead: Boolean? = null,
    val hasVideo: Boolean? = null,
    val minReadMinutes: Int? = null,
)

data class ParsedSearchQuery(val text: String, val tokens: List<String>, val operators: SearchOperators) {
    fun hasAnyOperator(): Boolean = operators.authors.isNotEmpty() ||
        operators.feeds.isNotEmpty() ||
        operators.folders.isNotEmpty() ||
        operators.afterMs != null ||
        operators.beforeMs != null ||
        operators.isStarred != null ||
        operators.isUnread != null ||
        operators.isRead != null ||
        operators.hasVideo != null ||
        operators.minReadMinutes != null

    /** Operators the server can enforce in the DB query. */
    fun hasEnforceableOperator(): Boolean = operators.authors.isNotEmpty() ||
        operators.feeds.isNotEmpty() ||
        operators.folders.isNotEmpty() ||
        operators.afterMs != null ||
        operators.beforeMs != null ||
        operators.isStarred != null ||
        operators.isUnread != null ||
        operators.isRead != null
}

private val OPERATOR_RE =
    Regex("""(^|\s)(author|feed|folder|after|before|has|is|min):(?:"([^"]+)"|(\S+))""", RegexOption.IGNORE_CASE)

private fun parseDateStartMs(raw: String): Long? = try {
    LocalDate.parse(raw.trim()).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
} catch (_: Exception) {
    null
}

private fun parseDateEndMs(raw: String): Long? = try {
    LocalDate.parse(raw.trim()).plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() - 1
} catch (_: Exception) {
    null
}

private fun parseMinRead(raw: String): Int? {
    val m =
        Regex("""^(\d+)(?:m|min|mins|minute|minutes)?$""", RegexOption.IGNORE_CASE).matchEntire(raw.trim())
            ?: return null
    return m.groupValues[1].toIntOrNull()?.coerceAtLeast(0)
}

fun parseSearchQueryText(query: String): ParsedSearchQuery {
    val authors = mutableListOf<String>()
    val feeds = mutableListOf<String>()
    val folders = mutableListOf<String>()
    var afterMs: Long? = null
    var beforeMs: Long? = null
    var isStarred: Boolean? = null
    var isUnread: Boolean? = null
    var isRead: Boolean? = null
    var hasVideo: Boolean? = null
    var minReadMinutes: Int? = null

    val text = StringBuffer()
    var last = 0
    for (m in OPERATOR_RE.findAll(query)) {
        text.append(query.substring(last, m.range.first))
        val lead = m.groupValues[1]
        val key = m.groupValues[2].lowercase()
        val value = (m.groupValues[3].ifEmpty { m.groupValues[4] }).trim()
        if (value.isNotEmpty()) {
            when (key) {
                "author" -> authors.add(value)

                "feed" -> feeds.add(value)

                "folder" -> folders.add(value)

                "after" -> afterMs = parseDateStartMs(value) ?: afterMs

                "before" -> beforeMs = parseDateEndMs(value) ?: beforeMs

                "has" -> if (value.equals("video", ignoreCase = true)) hasVideo = true

                "is" -> when (value.lowercase()) {
                    "starred" -> isStarred = true

                    "unread" -> {
                        isUnread = true
                        isRead = null
                    }

                    "read" -> {
                        isRead = true
                        isUnread = null
                    }
                }

                "min" -> {
                    val rt = Regex("""^readtime(?::|=)?(\d+)$""", RegexOption.IGNORE_CASE).matchEntire(value)
                    minReadMinutes = if (rt != null) rt.groupValues[1].toIntOrNull() else parseMinRead(value)
                }
            }
        }
        text.append(lead)
        last = m.range.last + 1
    }
    text.append(query.substring(last))
    val cleaned = text.toString().replace(Regex("""\s+"""), " ").trim()
    val tokens = cleaned.lowercase().split(Regex("[^a-z0-9]+")).filter { it.length >= 2 }
    return ParsedSearchQuery(
        text = cleaned,
        tokens = tokens,
        operators = SearchOperators(
            authors = authors,
            feeds = feeds,
            folders = folders,
            afterMs = afterMs,
            beforeMs = beforeMs,
            isStarred = isStarred,
            isUnread = isUnread,
            isRead = isRead,
            hasVideo = hasVideo,
            minReadMinutes = minReadMinutes,
        ),
    )
}
