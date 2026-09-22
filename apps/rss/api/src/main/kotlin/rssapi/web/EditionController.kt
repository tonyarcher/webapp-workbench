package rssapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import java.util.UUID
import org.springframework.data.domain.Sort
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.clampPageLimit
import rssapi.edition.EDITION_DEFAULT_WINDOW_HOURS
import rssapi.edition.EDITION_MAX_SECTIONS
import rssapi.edition.EditionService
import rssapi.persist.EDITION_READY as READY_STATUS
import rssapi.persist.EditionEntity
import rssapi.persist.EditionRepo

data class EditionBuildJson(val id: UUID?, val status: String)

data class EditionSectionScoresJson(
    val worthy: Double,
    val interest: Double,
    val newness: Double? = null,
    val popularity: Double? = null,
)

data class EditionSectionJson(
    val id: String,
    val topic: String? = null,
    val title: String,
    val summary: String? = null,
    val articleIds: List<String>,
    val scores: EditionSectionScoresJson? = null,
)

data class EditionDetailJson(
    val id: UUID?,
    val status: String,
    val windowHours: Long,
    val generatedAt: Long,
    val model: String?,
    val opinion: String?,
    val sections: List<EditionSectionJson>,
)

data class EditionMetaJson(
    val id: UUID?,
    val status: String,
    val windowHours: Long,
    val generatedAt: Long,
    val createdAt: Long,
    val model: String?,
)

data class EditionListJson(val editions: List<EditionMetaJson>)

@RestController
class EditionController(
    private val user: IdentityUser,
    private val service: EditionService,
    private val editions: EditionRepo,
) {
    /**
     * Builds an edition synchronously. Model calls may take ~1-2 min;
     * callers should allow a long timeout.
     */
    @PostMapping("/editions/build", headers = ["X-Api-Version=1"])
    fun build(
        @RequestParam(required = false) windowHours: String?,
        @RequestParam(required = false) sectionCount: String?,
    ): EditionBuildJson {
        val row = service.buildEdition(user.id, parseWindowHours(windowHours), parseSectionCount(sectionCount))
        return EditionBuildJson(row.id, row.status)
    }

    @GetMapping("/editions/latest", headers = ["X-Api-Version=1"])
    fun latest(): EditionDetailJson {
        val row = editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(user.id, READY_STATUS)
            ?: throw ApiException(404, "no edition yet")
        return row.toDetail()
    }

    @GetMapping("/editions/{id}", headers = ["X-Api-Version=1"])
    fun byId(@PathVariable id: UUID): EditionDetailJson {
        val row = editions.findById(id).orElse(null)?.takeIf { it.userId == user.id }
            ?: throw ApiException(404, "no such edition")
        return row.toDetail()
    }

    @GetMapping("/editions", headers = ["X-Api-Version=1"])
    fun list(@RequestParam(required = false) limit: String?): EditionListJson {
        val take = clampPageLimit(limit?.toDoubleOrNull())
        val rows = editions.findByUserId(user.id, Sort.by("createdAt").descending()).take(take)
        return EditionListJson(rows.map { it.toMeta() })
    }
}

private fun parseWindowHours(raw: String?): Long {
    if (raw == null) return EDITION_DEFAULT_WINDOW_HOURS
    val hours = raw.toLongOrNull() ?: throw ApiException(400, "invalid windowHours")
    if (hours < 1 || hours > 168) throw ApiException(400, "invalid windowHours")
    return hours
}

private fun parseSectionCount(raw: String?): Int {
    if (raw == null) return EDITION_MAX_SECTIONS
    val count = raw.toIntOrNull() ?: throw ApiException(400, "invalid sectionCount")
    if (count < 1 || count > EDITION_MAX_SECTIONS) throw ApiException(400, "invalid sectionCount")
    return count
}

private val detailMapper = ObjectMapper()

private fun windowHoursOf(row: EditionEntity): Long =
    (row.windowEnd.toEpochMilli() - row.windowStart.toEpochMilli()) / 3_600_000

private fun EditionEntity.toDetail(): EditionDetailJson {
    val body = try {
        body?.let { detailMapper.readTree(it) }
    } catch (_: Exception) {
        null
    }
    return EditionDetailJson(
        id = id,
        status = status,
        windowHours = windowHoursOf(this),
        generatedAt = createdAt.toEpochMilli(),
        model = model,
        opinion = body?.path("opinion")?.path("text")?.takeIf { it.isTextual }?.asText(),
        sections = body?.path("sections")?.takeIf { it.isArray }?.map(::detailSection) ?: emptyList(),
    )
}

private fun detailSection(node: com.fasterxml.jackson.databind.JsonNode): EditionSectionJson = EditionSectionJson(
    id = node.path("id").asText(""),
    topic = node.path("topic").takeIf { it.isTextual }?.asText(),
    title = node.path("title").asText("(untitled)"),
    summary = node.path("summary").takeIf { it.isTextual }?.asText(),
    articleIds = node.path("articleIds").takeIf { it.isArray }?.map { it.asText() } ?: emptyList(),
    scores = detailScores(node.path("scores")),
)

private fun detailScores(node: com.fasterxml.jackson.databind.JsonNode): EditionSectionScoresJson? {
    if (!node.path("worthy").isNumber || !node.path("interest").isNumber) return null
    return EditionSectionScoresJson(
        node.path("worthy").asDouble(),
        node.path("interest").asDouble(),
        node.path("newness").takeIf { it.isNumber }?.asDouble(),
        node.path("popularity").takeIf { it.isNumber }?.asDouble(),
    )
}

private fun EditionEntity.toMeta(): EditionMetaJson = EditionMetaJson(
    id = id,
    status = status,
    windowHours = windowHoursOf(this),
    generatedAt = createdAt.toEpochMilli(),
    createdAt = createdAt.toEpochMilli(),
    model = model,
)
