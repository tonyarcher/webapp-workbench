package rssapi.frontpage

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import rssapi.ai.AiConfig
import rssapi.ai.AiQuotaService
import rssapi.ai.DECISION_DEFAULT_MODEL
import rssapi.ai.aiConfigFromEnv
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.affinityKeys
import rssapi.log.log
import rssapi.persist.AffinityId
import rssapi.persist.AffinityRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleScoreEntity
import rssapi.persist.ArticleScoreRepo
import rssapi.persist.ArticleStateEntity
import rssapi.persist.ArticleStateRepo
import rssapi.web.articleSpec
import java.time.Duration
import java.time.Instant
import java.util.UUID

const val FRONT_PAGE_MAX_ROWS: Int = 500
const val SCORE_TTL_HOURS: Long = 1L
const val SCORE_MODEL: String = "signals-v1"
const val DEFAULT_WINDOW_DAYS: Long = 7L

private val TAG_STRIP = Regex("<[^>]*>")
private val WS_SPLIT = Regex("\\s+")

/** One candidate article with its read state and resolved scores. */
data class ScoredArticle(
    val article: ArticleEntity,
    val state: ArticleStateEntity?,
    val scores: SignalScores,
    val scoreRow: ArticleScoreEntity,
)

/**
 * Front page: scores the reader's candidate window with [ScoreProvider]
 * and caches results in `article_scores` for [SCORE_TTL_HOURS]. Never logs
 * article text; only ids and counts leave this service.
 *
 * When [AiConfig.provider] is `"decision"` and a TypeSafe key is present,
 * stale rows are refreshed through [DecisionScoreProvider] behind the per-user AI
 * quota instead. Quota exhaustion answers 429; any decision-model failure falls back to
 * signals for the whole batch, so the page never 500s because the model is down.
 */
@Service
class FrontPageService(
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
    private val affinity: AffinityRepo,
    private val scoreRows: ArticleScoreRepo,
    private val scorer: SignalScoreProvider,
    private val aiConfig: AiConfig = aiConfigFromEnv(),
    private val quotas: AiQuotaService? = null,
    private val decision: DecisionScoreProvider? = null,
) {
    /**
     * Reads run without a transaction (rows are flat, with no lazy
     * relations); the decision-model HTTP batch and quota consume also run outside any
     * transaction so a 90s model call never holds a DB connection. Only the
     * final [persistScores] write is transactional.
     */
    fun frontPage(userId: UUID, sinceMs: Long?, unreadOnly: Boolean, limit: Int): List<ScoredArticle> {
        val windowStart = sinceMs ?: Instant.now().minus(Duration.ofDays(DEFAULT_WINDOW_DAYS)).toEpochMilli()
        val spec = articleSpec(userId, ArticleScope.All, unreadOnly, ArticleSort.NEWEST, null, windowStart)
        val sort = Sort.by("publishedAt").descending().and(Sort.by("id").descending())
        val candidates = articles.findAll(spec, PageRequest.of(0, FRONT_PAGE_MAX_ROWS, sort)).content
        if (candidates.isEmpty()) return emptyList()
        val ids = candidates.map { it.id }
        val stateMap = states.findByUserIdAndArticleIdIn(userId, ids).associateBy { it.articleId }
        val affinityMap = loadAffinity(userId, candidates)
        val stored = scoreRows.findAllById(ids).associateBy { it.articleId }
        val now = Instant.now()
        val staleIds = candidates.filter { stored[it.id]?.isStale(now) ?: true }.map { it.id }.toSet()
        val scored = scoreAll(userId, candidates, stateMap, affinityMap, stored, now)
        val dirty = scored.filter { it.article.id in staleIds }.map { it.scoreRow }
        if (dirty.isNotEmpty()) persistScores(dirty)
        return scored
            .sortedWith(compareByDescending<ScoredArticle> { it.scores.worthy }.thenBy { it.article.id })
            .take(limit)
    }

    /**
     * Not transactional on purpose: [scoreRows] runs each call in its own
     * transaction, so a duplicate-key from a concurrent serve surfaces here
     * (not at some outer commit) where the catch below absorbs it. An outer
     * @Transactional would defer the violation past the try and leave the
     * transaction rollback-only.
     */
    fun persistScores(rows: List<ArticleScoreEntity>): List<ArticleScoreEntity> {
        if (rows.isEmpty()) return rows
        return try {
            scoreRows.saveAll(rows)
        } catch (_: DataIntegrityViolationException) {
            // Lost a race with a concurrent serve inserting the same new
            // rows: their content is identical and our scores are already
            // computed in memory, so return what we have.
            log("rss-api", "warn", "front-page score race", mapOf("rows" to rows.size))
            rows
        }
    }

    private fun scoreAll(
        userId: UUID,
        candidates: List<ArticleEntity>,
        stateMap: Map<String, ArticleStateEntity>,
        affinityMap: Map<String, Float>,
        stored: Map<String, ArticleScoreEntity>,
        now: Instant,
    ): List<ScoredArticle> {
        val enabled = aiConfig.provider == "decision" && aiConfig.decisionApiKey.isNotEmpty()
        val staleExists = candidates.any { stored[it.id]?.isStale(now) ?: true }
        if (enabled && staleExists) {
            val quotaService = quotas
            val decisionProvider = decision
            if (quotaService != null && decisionProvider != null) {
                // Consume-before-call, like AiService.summarize: a failed decision
                // batch still costs one quota unit while the page falls back
                // to signals, because the model bills attempts, not successes.
                quotaService.consume(userId, aiConfig.hourlyLimit, aiConfig.dailyLimit)
                try {
                    return scoreWithDecision(decisionProvider, candidates, stateMap, stored, affinityMap, now)
                } catch (_: Exception) {
                    log("rss-api", "warn", "front-page decision fallback", mapOf("candidates" to candidates.size))
                }
            }
        }
        return candidates.map { scoreOne(it, stateMap[it.id], stored[it.id], affinityMap, now) }
    }

    private fun scoreWithDecision(
        provider: DecisionScoreProvider,
        candidates: List<ArticleEntity>,
        stateMap: Map<String, ArticleStateEntity>,
        stored: Map<String, ArticleScoreEntity>,
        affinityMap: Map<String, Float>,
        now: Instant,
    ): List<ScoredArticle> {
        val started = System.currentTimeMillis()
        val inputs = candidates.associate { it.id to signalInputOf(it, affinityMap) }
        val stale = candidates.filter { stored[it.id]?.isStale(now) ?: true }
        val worth = stale.associate { it.id to scorer.score(inputs.getValue(it.id)).worthy }
        val top = stale.sortedByDescending { worth.getValue(it.id) }.take(DECISION_BATCH_MAX)
        val batchInputs = top.map { decisionCandidateOf(it, inputs.getValue(it.id)) }
        val batch = provider.scoreBatch(topWordsOf(affinityMap), affinityMap, batchInputs)
        val out = candidates.map {
            writeDecisionRow(it, stateMap[it.id], stored[it.id], inputs.getValue(it.id), batch, now)
        }
        val fields = mapOf("decision_rows" to batch.size, "duration_ms" to (System.currentTimeMillis() - started))
        log("rss-api", "info", "front-page decision ok", fields)
        return out
    }

    private fun writeDecisionRow(
        article: ArticleEntity,
        state: ArticleStateEntity?,
        existing: ArticleScoreEntity?,
        input: SignalInput,
        batch: Map<String, SignalScores>,
        now: Instant,
    ): ScoredArticle {
        val fresh = existing?.takeUnless { it.isStale(now) }
        if (fresh != null) return toScored(article, state, fresh)
        val decisionScores = batch[article.id]
        val model = if (decisionScores != null) aiConfig.model.ifEmpty { DECISION_DEFAULT_MODEL } else SCORE_MODEL
        return toScored(article, state, refresh(article, input, existing, now, decisionScores, model))
    }

    private fun toScored(article: ArticleEntity, state: ArticleStateEntity?, row: ArticleScoreEntity): ScoredArticle =
        ScoredArticle(
            article,
            state,
            SignalScores(
                row.worthy ?: 0.0,
                row.interest ?: 0.0,
                row.popularityOutlook ?: 0.0,
                row.readability ?: 0.0,
                row.topic,
            ),
            row,
        )

    private fun scoreOne(
        article: ArticleEntity,
        state: ArticleStateEntity?,
        existing: ArticleScoreEntity?,
        affinityMap: Map<String, Float>,
        now: Instant,
    ): ScoredArticle {
        val row = existing?.takeUnless { it.isStale(now) }
            ?: refresh(article, signalInputOf(article, affinityMap), existing, now)
        return toScored(article, state, row)
    }

    private fun refresh(
        article: ArticleEntity,
        input: SignalInput,
        existing: ArticleScoreEntity?,
        now: Instant,
        computed: SignalScores? = null,
        model: String = SCORE_MODEL,
    ): ArticleScoreEntity {
        val scores = computed ?: scorer.score(input)
        val row = existing ?: ArticleScoreEntity(articleId = article.id)
        row.worthy = scores.worthy
        row.interest = scores.interest
        row.topic = scores.topic
        row.popularityOutlook = scores.popularityOutlook
        row.readability = scores.readability
        row.scoredAt = now
        row.model = model
        return row
    }

    private fun loadAffinity(userId: UUID, candidates: List<ArticleEntity>): Map<String, Float> {
        val keys = candidates.flatMapTo(mutableSetOf()) { article ->
            affinityKeys(article.feedId, article.domain, article.author)
        }
        return affinity.findAllById(keys.map { AffinityId(userId, it) }).associate { it.key to it.value }
    }

    /**
     * Stored-judgment evidence for review: rows scored in the current window,
     * grouped by producing model. Reads only; unlike [frontPage] it never
     * refreshes stale rows, so inspecting past judgments costs no model calls.
     */
    fun modelEvidence(now: Instant): List<ModelEvidence> {
        val since = now.minus(Duration.ofDays(DEFAULT_WINDOW_DAYS))
        return modelEvidenceOf(scoreRows.findAllByScoredAtAfter(since))
    }
}

private fun ArticleScoreEntity.isStale(now: Instant): Boolean {
    val at = scoredAt
    return at == null || at.isBefore(now.minus(Duration.ofHours(SCORE_TTL_HOURS)))
}

/** Counts whitespace-separated words after stripping tags; null bodies count as zero. */
internal fun wordCountOf(article: ArticleEntity): Int {
    val text = listOfNotNull(article.summary, article.contentHtml).joinToString(" ")
    return TAG_STRIP.replace(text, " ").split(WS_SPLIT).count { it.isNotBlank() }
}
