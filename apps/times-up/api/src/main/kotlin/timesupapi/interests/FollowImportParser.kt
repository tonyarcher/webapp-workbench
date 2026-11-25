package timesupapi.interests

import java.text.Normalizer

private const val MAX_LINE = 200
private const val MAX_BATCH = 5000
private const val TOP_N = 10
private const val QUARANTINE_CAP = 20
private const val QUARANTINE_LABEL_LEN = 80

data class ParsedLabel(val display: String, val key: String, val count: Int)

data class ImportReport(
    val count: Int,
    val unique: Int,
    val duplicates: Int,
    val quarantined: Int,
    val top: List<String>,
    val quarantinedLabels: List<String>,
)

data class ImportResult(val fingerprint: String, val topics: ImportReport, val sources: ImportReport)

object FollowImportParser {
    fun parse(text: String): Pair<ImportReport, List<ParsedLabel>> {
        val lines = text.lines().take(MAX_BATCH)
        val seen = linkedMapOf<String, ParsedLabel>()
        val quarantined = mutableListOf<String>()
        var duplicates = 0
        for (raw in lines) {
            processLine(normalize(raw), seen, quarantined) { duplicates++ }
        }
        val top = seen.values.sortedByDescending { it.count }.take(TOP_N).map { it.display }
        val report = buildReport(lines, seen, quarantined, duplicates, top)
        return report to seen.values.toList()
    }

    private fun processLine(
        norm: String,
        seen: LinkedHashMap<String, ParsedLabel>,
        quarantined: MutableList<String>,
        onDuplicate: () -> Unit,
    ) {
        if (norm.isEmpty()) return
        if (norm.length > MAX_LINE) {
            quarantined.add(norm.take(QUARANTINE_LABEL_LEN))
            return
        }
        if (isJunk(norm)) {
            quarantined.add(norm)
            return
        }
        val key = norm.lowercase()
        val existing = seen[key]
        if (existing != null) {
            seen[key] = existing.copy(count = existing.count + 1)
            onDuplicate()
        } else {
            seen[key] = ParsedLabel(norm, key, 1)
        }
    }

    private fun buildReport(
        lines: List<String>,
        seen: LinkedHashMap<String, ParsedLabel>,
        quarantined: List<String>,
        duplicates: Int,
        top: List<String>,
    ): ImportReport = ImportReport(
        count = lines.count { it.trim().isNotEmpty() },
        unique = seen.size,
        duplicates = duplicates,
        quarantined = quarantined.size,
        top = top,
        quarantinedLabels = quarantined.take(QUARANTINE_CAP),
    )

    private fun normalize(raw: String): String =
        Normalizer.normalize(raw, Normalizer.Form.NFKC).trim().replace(Regex("\\s+"), " ")

    private fun isJunk(s: String): Boolean =
        s.contains("http://") || s.contains("https://") || s.all { it.isDigit() || it.isWhitespace() }
}
