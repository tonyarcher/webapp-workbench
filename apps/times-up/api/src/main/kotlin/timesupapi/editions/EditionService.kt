package timesupapi.editions
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import timesupapi.ai.AiConfig
import timesupapi.ai.AiQuotaService
import timesupapi.ai.AiService
import timesupapi.ai.SummaryLength
import timesupapi.articles.ArticleListQuery
import timesupapi.articles.ArticleScope
import timesupapi.articles.ArticleSort
import timesupapi.articles.articleSpec
import timesupapi.feeds.AffinityId
import timesupapi.feeds.AffinityRepo
import timesupapi.feeds.FolderFeedRepo
import timesupapi.feeds.FolderRepo
import timesupapi.platform.ApiException
import timesupapi.platform.log.log
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

const val EDITION_MAX_CLUSTERS: Int = 12
const val EDITION_MAX_SECTIONS: Int = 12
const val EDITION_MAX_ARTICLES: Int = 300
const val EDITION_KEEP: Int = 7
const val EDITION_DEFAULT_WINDOW_HOURS: Long = 24
const val EDITION_EXCERPT_CHARS: Int = 500
const val EDITION_SECTION_EXCERPTS: Int = 6
const val EDITION_OPINION_TITLE: String = "Editorial opinion"
const val EDITION_OPINION_PROMPT: String =
    "Write a brief editorial opinion based ONLY on the section summaries below. " +
        "Begin your response with the label 'Opinion:'. Write in an opinion voice. " +
        "Do not invent facts beyond the summaries."
val EDITION_WEIGHTS: RankWeights = RankWeights(0.3, 0.3, 0.25, 0.15)

private data class Ranked(
    val cluster: Cluster,
    val score: Double,
    val topic: String?,
    val worthy: Double,
    val interest: Double,
    val newness: Double,
    val popularity: Double,
)
private data class SectionDraft(val item: Ranked, val summary: String?)

/**
 * Generated newspaper. Clusters the reader's window by syndication
 * key, summarizes each cluster once through [AiService], writes one labeled
 * editorial opinion over the top-3 summaries, ranks, and persists the edition
 * JSON. Quota is consumed once up front as a fail-fast gate (per-summary
 * metering stays inside [AiService]); a 429 aborts to `failed` with no body.
 * One bad cluster never fails the edition: its summary stays null.
 * Never logs titles, bodies, or prompts; only counts and durations.
 */
@Service
class EditionService(
    private val articles: ArticleListQuery,
    private val affinity: AffinityRepo,
    private val folders: FolderRepo,
    private val folderFeeds: FolderFeedRepo,
    private val editions: EditionRepo,
    private val ai: AiService,
    private val quotas: AiQuotaService,
    private val enrichment: EditionEnrichment,
    private val aiConfig: AiConfig,
) {
    internal var clock: Clock = Clock.systemUTC()
    private val mapper = ObjectMapper()

    fun buildEdition(userId: UUID, windowHours: Long, sectionCount: Int): EditionEntity {
        val now = clock.instant()
        val start = now.minus(Duration.ofHours(windowHours))
        val row = editions.save(
            EditionEntity(windowStart = start, windowEnd = now, status = EDITION_BUILDING, userId = userId),
        )
        try {
            return buildReady(userId, row, start, now, windowHours, sectionCount)
        } catch (err: ApiException) {
            failRow(row)
            throw err
        } catch (_: Exception) {
            failRow(row)
            throw ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "edition build failed")
        }
    }

    private fun buildReady(
        userId: UUID,
        row: EditionEntity,
        start: Instant,
        now: Instant,
        windowHours: Long,
        sectionCount: Int,
    ): EditionEntity {
        val started = System.currentTimeMillis()
        quotas.consume(userId, aiConfig.hourlyLimit, aiConfig.dailyLimit)
        val previous = editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(userId, EDITION_READY)
        val previousKeys = parseSectionKeys(previous?.body, mapper)
        val ranked = loadRanked(userId, start, now, windowHours).take(sectionCount)
        val sections = summarizeAll(userId, ranked)
        val opinion = opinionFor(userId, sections)
        finishReady(row, sections, opinion, now, previousKeys)
        log(
            "times-up-api",
            "info",
            "edition build ok",
            mapOf(
                "clusters" to ranked.size,
                "summaries" to sections.count { it.summary != null },
                "duration_ms" to (System.currentTimeMillis() - started),
            ),
        )
        return row
    }

    private fun loadRanked(userId: UUID, start: Instant, now: Instant, windowHours: Long): List<Ranked> {
        val spec = articleSpec(userId, ArticleScope.All, false, ArticleSort.NEWEST, null, start.toEpochMilli())
        val sort = Sort.by("publishedAt").descending().and(Sort.by("id").descending())
        val found = articles.findAll(spec, PageRequest.of(0, EDITION_MAX_ARTICLES, sort))
        val inputs = found.map { article ->
            EditionArticle(
                article.id, article.feedId, article.title, "", article.publishedAt,
                article.hot.toDouble(), article.popularity.toDouble(), article.engagement.toDouble(),
                article.domain, article.author, article.normLink,
            )
        }
        val keys = found.flatMapTo(mutableSetOf()) { affinityKeys(it.feedId, it.domain, it.author) }
        val affinities = affinity.findAllById(keys.map { AffinityId(userId, it) }).associate { it.key to it.value }
        val titles = feedTitles(userId, inputs)
        return sortClusters(clusterByStory(inputs), affinities, EDITION_WEIGHTS, now, windowHours)
            .take(EDITION_MAX_CLUSTERS)
            .map { cluster -> toRanked(cluster, affinities, titles, now, windowHours) }
    }

    private fun feedTitles(userId: UUID, inputs: List<EditionArticle>): Map<UUID, String?> {
        val feedIds = inputs.map { it.feedId }.toSet()
        if (feedIds.isEmpty()) return emptyMap()
        val links = folderFeeds.findByFeedIdIn(feedIds)
        if (links.isEmpty()) return emptyMap()
        val names = folders.findByUserIdAndIdIn(userId, links.map { it.folderId }.toSet())
        val byId = names.associate { it.id to it.title }
        return feedIds.associateWith { feed ->
            links.filter { it.feedId == feed }.mapNotNull { byId[it.folderId] }.minOrNull()
        }
    }

    private fun toRanked(
        cluster: Cluster,
        affinities: Map<String, Float>,
        titles: Map<UUID, String?>,
        now: Instant,
        windowHours: Long,
    ): Ranked {
        val enriched = enrichment.topic(cluster.articles.map { it.title })
        val topic = enriched ?: voteTopic(cluster.articles.mapNotNull { titles[it.feedId] })
        val (worthy, interest) = clusterScores(cluster, affinities)
        val rank = compositeRank(cluster, affinities, EDITION_WEIGHTS, now, windowHours)
        return Ranked(
            cluster,
            rank,
            topic,
            worthy,
            interest,
            clusterNewness(cluster, now, windowHours),
            clusterPopularity(cluster, affinities),
        )
    }

    /**
     * Ranking needs titles and signals, not body text. Load excerpts only for
     * the sections the edition actually cites, then fill them before the AI
     * call so a large candidate window never drags excerpt text along.
     */
    private fun summarizeAll(userId: UUID, ranked: List<Ranked>): List<SectionDraft> {
        val ids = ranked.flatMap { it.cluster.articles.map { article -> article.id } }
        val excerpts = articles.findExcerpts(ids)
        return ranked.map { item ->
            val cited = item.cluster.articles.map { article ->
                article.copy(excerpt = plainExcerpt(excerpts[article.id], EDITION_EXCERPT_CHARS))
            }
            val joined = cited.joinToString("\n\n") { "${it.title}\n${it.excerpt}" }
                .take(aiConfig.maxInputChars).trim()
            val summary = try {
                if (joined.isEmpty()) {
                    null
                } else {
                    ai.summarize(userId, cited.first().title, joined, SummaryLength.STANDARD)
                }
            } catch (_: Exception) {
                null
            }
            SectionDraft(item.copy(cluster = item.cluster.copy(articles = cited)), summary)
        }
    }

    private fun opinionFor(userId: UUID, sections: List<SectionDraft>): String? {
        val usable = sections.mapNotNull { it.summary }.take(3)
        if (usable.isEmpty()) return null
        val joined = usable.joinToString("\n\n---\n\n")
        val prompt = (EDITION_OPINION_PROMPT + "\n\n" + joined).take(aiConfig.maxInputChars)
        return try {
            ai.summarize(userId, EDITION_OPINION_TITLE, prompt, SummaryLength.STANDARD)
        } catch (_: Exception) {
            null
        }
    }

    private fun finishReady(
        row: EditionEntity,
        sections: List<SectionDraft>,
        opinion: String?,
        now: Instant,
        previousKeys: Set<String>,
    ) {
        row.body = mapper.writeValueAsString(
            mapOf(
                "sections" to sections.map { sectionJson(it, previousKeys) },
                "opinion" to opinion?.let { mapOf("text" to it) },
                "generatedAt" to now.toEpochMilli(),
                "model" to aiConfig.model,
                "deltaSince" to previousKeys.isNotEmpty(),
            ),
        )
        row.model = aiConfig.model
        row.status = EDITION_READY
        editions.save(row)
        editions.deleteOld(row.requireOwner(), EDITION_KEEP)
    }

    private fun sectionJson(section: SectionDraft, previousKeys: Set<String>): Map<String, Any?> = mapOf(
        "id" to section.item.cluster.key,
        "topic" to section.item.topic,
        "title" to section.item.cluster.articles.first().title,
        "summary" to section.summary,
        "articleIds" to section.item.cluster.articles.map { it.id },
        "excerpts" to section.item.cluster.articles.mapNotNull { article ->
            article.excerpt.takeIf { it.isNotBlank() }?.let { text ->
                mapOf("articleId" to article.id, "title" to article.title, "text" to text)
            }
        }.take(EDITION_SECTION_EXCERPTS),
        "scores" to mapOf(
            "worthy" to section.item.worthy,
            "interest" to section.item.interest,
            "newness" to section.item.newness,
            "popularity" to section.item.popularity,
        ),
        "delta" to if (section.item.cluster.key in previousKeys) "steady" else "new",
    )

    private fun failRow(row: EditionEntity) {
        row.status = EDITION_FAILED
        row.body = null
        editions.save(row)
        editions.deleteOld(row.requireOwner(), EDITION_KEEP)
    }
}

/** Owner is always set by [EditionService.buildEdition]; fail loud otherwise. */
private fun EditionEntity.requireOwner(): UUID =
    userId ?: throw ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "edition has no owner")

private fun parseSectionKeys(body: String?, mapper: com.fasterxml.jackson.databind.ObjectMapper): Set<String> {
    if (body.isNullOrBlank()) return emptySet()
    val node = mapper.readTree(body)
    val sections = node.path("sections")
    if (!sections.isArray) return emptySet()
    return sections.mapNotNull { it.path("id").takeIf { id -> id.isTextual }?.asText() }.toSet()
}
