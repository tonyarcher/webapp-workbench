package rssapi.frontpage

import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import rssapi.ai.AiConfig
import rssapi.ai.AiException
import rssapi.ai.AiQuotaService
import rssapi.ai.HttpPoster
import rssapi.ai.HttpResult
import rssapi.ai.JevBackend
import rssapi.persist.AffinityEntity
import rssapi.persist.AffinityRepo
import rssapi.persist.AiQuotaEntity
import rssapi.persist.AiQuotaRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleScoreEntity
import rssapi.persist.ArticleScoreRepo
import rssapi.persist.ArticleStateRepo
import rssapi.web.ApiException

@ExtendWith(MockitoExtension::class)
class FrontPageServiceTest {
    @Mock
    lateinit var articles: ArticleRepo

    @Mock
    lateinit var states: ArticleStateRepo

    @Mock
    lateinit var affinity: AffinityRepo

    @Mock
    lateinit var scoreRows: ArticleScoreRepo

    private val scorer = SignalScoreProvider()

    private val service: FrontPageService by lazy {
        FrontPageService(articles, states, affinity, scoreRows, scorer)
    }

    private val uid: UUID = UUID.randomUUID()

    private fun article(
        id: String,
        feedId: UUID = UUID.randomUUID(),
        hot: Float = 6_300f,
        popularity: Float = 2f,
        engagement: Float = 1f,
    ): ArticleEntity = ArticleEntity(
        id = id,
        feedId = feedId,
        guid = "g-$id",
        title = "t-$id",
        hot = hot,
        popularity = popularity,
        engagement = engagement,
    )

    private fun stored(
        id: String,
        worthy: Double?,
        scoredAt: Instant?,
        interest: Double? = 0.5,
        outlook: Double? = 0.5,
        readability: Double? = 0.5,
    ): ArticleScoreEntity = ArticleScoreEntity(
        articleId = id,
        worthy = worthy,
        interest = interest,
        topic = null,
        popularityOutlook = outlook,
        readability = readability,
        scoredAt = scoredAt,
        model = SCORE_MODEL,
    )

    private fun stubCandidates(vararg rows: ArticleEntity) {
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(rows.toList()))
        whenever(states.findByUserIdAndArticleIdIn(eq(uid), anyOrNull())).thenReturn(emptyList())
    }

    @Test
    fun emptyWindowReturnsEmpty() {
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(emptyList()))
        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)
        assertTrue(out.isEmpty())
        verify(states, never()).findByUserIdAndArticleIdIn(any(), any())
    }

    @Test
    fun missingScoresAreComputedAndSaved() {
        val low = article("low", popularity = 0f, engagement = 0f, hot = 6_000f)
        val high = article("high", popularity = 40f, engagement = 40f, hot = 6_400f)
        stubCandidates(low, high)
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(listOf("high", "low"), out.map { it.article.id })
        assertTrue(out[0].scores.worthy > out[1].scores.worthy)
        verify(scoreRows).saveAll(any<Iterable<ArticleScoreEntity>>())
        val row = out[0].scoreRow
        assertEquals(SCORE_MODEL, row.model)
        assertNotNull(row.scoredAt)
        assertNull(row.topic)
    }

    @Test
    fun freshScoresAreReusedWithoutSave() {
        val high = article("high", popularity = 40f, hot = 6_400f)
        val low = article("low", popularity = 0f, hot = 6_000f)
        stubCandidates(high, low)
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(
            listOf(stored("high", null, Instant.now(), null, null, null), stored("low", 0.4, Instant.now())),
        )

        val out = service.frontPage(uid, null, true, 10)

        assertEquals(listOf("low", "high"), out.map { it.article.id })
        assertEquals(0.0, out[1].scores.worthy)
        assertEquals(0.0, out[1].scores.interest)
        assertEquals(0.0, out[1].scores.popularityOutlook)
        assertEquals(0.0, out[1].scores.readability)
        verify(scoreRows, never()).saveAll(any<Iterable<ArticleScoreEntity>>())
    }

    @Test
    fun staleScoresAreRefreshed() {
        val row = article("a1")
        stubCandidates(row)
        val previous = Instant.now().minusSeconds(2 * 3_600)
        val old = stored("a1", 0.99, previous)
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(listOf(old))
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(1, out.size)
        assertTrue(out[0].scoreRow.scoredAt!!.isAfter(previous))
        assertTrue(out[0].scores.worthy < 0.99)
        verify(scoreRows).saveAll(any<Iterable<ArticleScoreEntity>>())
    }

    @Test
    fun nullScoredAtIsRefreshed() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(listOf(stored("a1", 0.2, null)))
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertNotNull(out[0].scoreRow.scoredAt)
        verify(scoreRows).saveAll(any<Iterable<ArticleScoreEntity>>())
    }

    @Test
    fun affinityLiftsInterest() {
        val feedA = UUID.randomUUID()
        val bare = article("bare")
        val liked = article("liked", feedId = feedA)
        stubCandidates(bare, liked)
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(affinity.findAllById(any<Iterable<rssapi.persist.AffinityId>>())).thenReturn(
            mutableListOf(AffinityEntity(userId = uid, key = "aff:feed:$feedA", value = 20f)),
        )
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)
        val byId = out.associateBy { it.article.id }

        assertTrue(byId["liked"]!!.scores.interest > byId["bare"]!!.scores.interest)
        assertEquals("liked", out[0].article.id)
    }

    @Test
    fun equalWorthyFallsBackToIdOrderAndLimitApplies() {
        val second = article("a-2")
        val first = article("a-1")
        stubCandidates(second, first)
        val now = Instant.now()
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(
            listOf(stored("a-2", 0.7, now), stored("a-1", 0.7, now)),
        )

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 1)

        assertEquals(listOf("a-1"), out.map { it.article.id })
    }

    @Test
    fun wordCounts() {
        assertEquals(0, wordCountOf(ArticleEntity(id = "x")))
        assertEquals(0, wordCountOf(ArticleEntity(id = "x", summary = "   ")))
        assertEquals(0, wordCountOf(ArticleEntity(id = "x", contentHtml = "<br/>")))
        assertEquals(2, wordCountOf(ArticleEntity(id = "x", contentHtml = "<p>hello <b>world</b></p>")))
        assertEquals(3, wordCountOf(ArticleEntity(id = "x", summary = "one two", contentHtml = "<p>three</p>")))
    }

    private fun openQuota(): Pair<AiQuotaService, AiQuotaRepo> {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(any())).thenReturn(Optional.empty())
        whenever(repo.saveAndFlush(any())).thenAnswer { it.getArgument<AiQuotaEntity>(0) }
        return AiQuotaService(repo) to repo
    }

    private fun jevReply(vararg ids: String): String {
        val answers = ids.flatMap { id ->
            listOf(
                """"${id}_worthy":{"type":"noul","noul":0.9}""",
                """"${id}_interest":{"type":"score","score":1.8}""",
                """"${id}_topic":{"type":"choice","choice":"tech"}""",
            )
        }.joinToString(",")
        return """{"model":"jev-latest","answers":{$answers},"usage":{"input_tokens":1,"output_tokens":1}}"""
    }

    private fun jevService(poster: HttpPoster, quotas: AiQuotaService, model: String = ""): FrontPageService {
        val config = AiConfig(provider = "jev", jevApiKey = "test-key", model = model)
        val provider = JevScoreProvider(JevBackend(config, poster), SignalScoreProvider())
        return FrontPageService(articles, states, affinity, scoreRows, scorer, config, quotas, provider)
    }

    @Test
    fun jevSuccessStoresJevModel() {
        stubCandidates(article("fresh"), article("stale-a"), article("stale-b"))
        val now = Instant.now()
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(listOf(stored("fresh", 0.1, now)))
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val (quotas, quotaRepo) = openQuota()
        val poster = FrontPageJevPoster(jevReply("stale-a", "stale-b"))

        val out = jevService(poster, quotas).frontPage(uid, 1_700_000_000_000L, false, 10)
            .associateBy { it.article.id }

        assertEquals("jev-latest", out.getValue("stale-a").scoreRow.model)
        assertEquals("jev-latest", out.getValue("stale-b").scoreRow.model)
        assertEquals(0.9, out.getValue("stale-a").scores.worthy, 1e-9)
        assertEquals(0.9, out.getValue("stale-a").scores.interest, 1e-9)
        assertEquals("tech", out.getValue("stale-a").scores.topic)
        assertEquals("tech", out.getValue("stale-a").scoreRow.topic)
        assertEquals(SCORE_MODEL, out.getValue("fresh").scoreRow.model)
        assertEquals(0.1, out.getValue("fresh").scores.worthy, 1e-9)
        assertNull(out.getValue("fresh").scoreRow.topic)
        verify(quotaRepo).saveAndFlush(any())
        assertEquals(1, poster.calls.size)
    }

    @Test
    fun jevThrowFallsBackToSignals() {
        stubCandidates(article("a1"), article("a2"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val (quotas, _) = openQuota()
        val poster = FrontPageJevPoster("", fail = true)

        val out = jevService(poster, quotas).frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(2, out.size)
        assertTrue(out.all { it.scoreRow.model == SCORE_MODEL })
    }

    @Test
    fun providerWithoutJevSkipsJevAndQuota() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val repo: AiQuotaRepo = mock()
        val quotas = AiQuotaService(repo)
        val poster = FrontPageJevPoster(jevReply("a1"))
        val config = AiConfig(provider = "ollama", baseUrl = "http://x", model = "m")
        val provider = JevScoreProvider(JevBackend(config, poster))
        val service = FrontPageService(articles, states, affinity, scoreRows, scorer, config, quotas, provider)

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(1, out.size)
        assertEquals(SCORE_MODEL, out[0].scoreRow.model)
        verify(repo, never()).saveAndFlush(any())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun blankJevKeySkipsJevAndQuota() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val repo: AiQuotaRepo = mock()
        val quotas = AiQuotaService(repo)
        val poster = FrontPageJevPoster(jevReply("a1"))
        val config = AiConfig(provider = "jev")
        val provider = JevScoreProvider(JevBackend(config, poster))
        val service = FrontPageService(articles, states, affinity, scoreRows, scorer, config, quotas, provider)

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(1, out.size)
        assertEquals(SCORE_MODEL, out[0].scoreRow.model)
        verify(repo, never()).saveAndFlush(any())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun jevWithoutQuotaServiceFallsBackToSignals() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val poster = FrontPageJevPoster(jevReply("a1"))
        val config = AiConfig(provider = "jev", jevApiKey = "test-key")
        val provider = JevScoreProvider(JevBackend(config, poster), SignalScoreProvider())
        val service = FrontPageService(articles, states, affinity, scoreRows, scorer, config, null, provider)

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(1, out.size)
        assertEquals(SCORE_MODEL, out[0].scoreRow.model)
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun jevWithoutProviderFallsBackToSignals() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val quotas = AiQuotaService(mock())
        val config = AiConfig(provider = "jev", jevApiKey = "test-key")
        val service = FrontPageService(articles, states, affinity, scoreRows, scorer, config, quotas, null)

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(1, out.size)
        assertEquals(SCORE_MODEL, out[0].scoreRow.model)
    }

    @Test
    fun jevBatchKeepsFreshAndFallsBackMissing() {
        stubCandidates(article("fresh"), article("stale-a"), article("stale-b"))
        val now = Instant.now()
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(listOf(stored("fresh", 0.1, now)))
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val (quotas, _) = openQuota()
        val poster = FrontPageJevPoster(jevReply("stale-a"))
        val service = jevService(poster, quotas)

        val out = service.frontPage(uid, 1_700_000_000_000L, false, 10)
            .associateBy { it.article.id }

        assertEquals(SCORE_MODEL, out.getValue("fresh").scoreRow.model)
        assertEquals("jev-latest", out.getValue("stale-a").scoreRow.model)
        assertEquals(SCORE_MODEL, out.getValue("stale-b").scoreRow.model)
    }

    @Test
    fun quota429Passthrough() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(uid)).thenReturn(Optional.of(AiQuotaEntity(uid, Instant.now(), 30, Instant.now(), 5)))
        val quotas = AiQuotaService(repo)
        val poster = FrontPageJevPoster(jevReply("a1"))

        val err = assertFailsWith<ApiException> {
            jevService(poster, quotas).frontPage(uid, 1_700_000_000_000L, false, 10)
        }

        assertEquals(429, err.status)
        verify(repo, never()).saveAndFlush(any())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun allFreshRowsSkipQuotaAndJev() {
        stubCandidates(article("a1"))
        val now = Instant.now()
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(listOf(stored("a1", 0.3, now)))
        val repo: AiQuotaRepo = mock()
        val quotas = AiQuotaService(repo)
        val poster = FrontPageJevPoster(jevReply("a1"))

        val out = jevService(poster, quotas).frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals(0.3, out.single().scores.worthy, 1e-9)
        verify(repo, never()).saveAndFlush(any())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun modelOverrideUsedForJevRows() {
        stubCandidates(article("a1"))
        whenever(scoreRows.findAllById(anyOrNull())).thenReturn(emptyList())
        whenever(scoreRows.saveAll(any<Iterable<ArticleScoreEntity>>()))
            .thenAnswer { it.getArgument<List<ArticleScoreEntity>>(0) }
        val (quotas, _) = openQuota()
        val poster = FrontPageJevPoster(jevReply("a1"))

        val out = jevService(poster, quotas, model = "custom-jev").frontPage(uid, 1_700_000_000_000L, false, 10)

        assertEquals("custom-jev", out.single().scoreRow.model)
    }
}

private class FrontPageJevPoster(private val reply: String, private val fail: Boolean = false) : HttpPoster {
    val calls = mutableListOf<String>()
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("front-page jev only POSTs")
    }
    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        if (fail) throw AiException("jev down")
        return HttpResult(200, reply)
    }
    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("front-page jev only POSTs")
    }
}
