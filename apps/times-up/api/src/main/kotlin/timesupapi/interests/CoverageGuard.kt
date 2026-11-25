package timesupapi.interests

import org.springframework.stereotype.Service

data class GuardedItem(
    val id: String,
    val source: String,
    val hostFamily: String,
    val perspective: String,
    val score: Double,
)

data class GuardResult(val kept: List<GuardedItem>, val dropped: Int, val gapNote: String?)

@Service
class CoverageGuard {
    fun apply(
        items: List<GuardedItem>,
        perSource: Int,
        perHostFamily: Int,
        perPerspective: Int,
        cap: Int,
    ): GuardResult {
        val sorted = items.sortedByDescending { it.score }
        val kept = mutableListOf<GuardedItem>()
        val counts = Counts()
        var dropped = 0
        for (item in sorted) {
            if (kept.size < cap && !counts.exceeds(item, perSource, perHostFamily, perPerspective)) {
                kept.add(item)
                counts.increment(item)
            } else {
                dropped++
            }
        }
        val gapNote = if (dropped > 0) "$dropped items held back for source diversity" else null
        return GuardResult(kept, dropped, gapNote)
    }

    private class Counts {
        private val source = mutableMapOf<String, Int>()
        private val host = mutableMapOf<String, Int>()
        private val persp = mutableMapOf<String, Int>()

        fun exceeds(item: GuardedItem, perSource: Int, perHostFamily: Int, perPerspective: Int): Boolean =
            (source[item.source] ?: 0) >= perSource ||
                (host[item.hostFamily] ?: 0) >= perHostFamily ||
                (persp[item.perspective] ?: 0) >= perPerspective

        fun increment(item: GuardedItem) {
            source[item.source] = (source[item.source] ?: 0) + 1
            host[item.hostFamily] = (host[item.hostFamily] ?: 0) + 1
            persp[item.perspective] = (persp[item.perspective] ?: 0) + 1
        }
    }
}
