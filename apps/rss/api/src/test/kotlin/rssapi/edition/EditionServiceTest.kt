package rssapi.edition

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import rssapi.ai.AiConfig
import rssapi.ai.AiQuotaService
import rssapi.ai.AiService
import rssapi.persist.AffinityRepo
import rssapi.persist.AiQuotaRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.EDITION_READY
import rssapi.persist.EditionEntity
import rssapi.persist.EditionRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.web.ApiException
import rssapi.persist.AiQuotaEntity

private val SERVICE_NOW: Instant = Instant.parse("2026-09-13T12:00:00Z")
private val SERVICE_UID: UUID = UUID.fromString("22222222-2222-2222-2222-222222222222")

private fun serviceArticle(
    id: String,
    norm: String?,
    feed: UUID,
    hoursAgo: Long = 1,
    title: String = "t-$id",
): ArticleEntity {
    val at = SERVICE_NOW.minus(Duration.ofHours(hoursAgo))
    return ArticleEntity(
        id = id,
        feedId = feed,
        guid = "g-$id",
        title = title,
        normLink = norm,
        summary = "summary $id",
        publishedAt = at,
        fetchedAt = at,
        popularity = 5f,
        engagement = 2f,
        hot = 6_300f,
    )
}

@ExtendWith(MockitoExtension::class)
class EditionServiceTest {
    @Mock
    lateinit var articles: ArticleRepo

    @Mock
    lateinit var affinity: AffinityRepo

    @Mock
    lateinit var folders: FolderRepo

    @Mock
    lateinit var folderFeeds: FolderFeedRepo

    @Mock
    lateinit var editions: EditionRepo

    @Mock
    lateinit var ai: AiService

    @Mock
    lateinit var quotaRepo: AiQuotaRepo

    private fun service(enrichment: EditionEnrichment = SignalEnrichment()): EditionService {
        val config = AiConfig(
            provider = "ollama",
            baseUrl = "http://ollama:11434",
            model = "test-model",
            hourlyLimit = 30,
            dailyLimit = 100,
            maxInputChars = 8_000,
        )
        val quotas = AiQuotaService(quotaRepo)
        quotas.clock = Clock.fixed(SERVICE_NOW, ZoneOffset.UTC)
        val out = EditionService(articles, affinity, folders, folderFeeds, editions, ai, quotas, enrichment, config)
        out.clock = Clock.fixed(SERVICE_NOW, ZoneOffset.UTC)
        return out
    }

    private fun stubQuota() {
        whenever(quotaRepo.findById(any())).thenReturn(Optional.empty())
        whenever(quotaRepo.saveAndFlush(any<AiQuotaEntity>())).thenAnswer { it.getArgument(0) }
    }

    private fun stubWindow(
        rows: List<ArticleEntity>,
        links: List<FolderFeedEntity> = emptyList(),
        folderRows: List<FolderEntity> = emptyList(),
    ) {
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(rows))
        whenever(affinity.findAllById(any<Iterable<rssapi.persist.AffinityId>>())).thenReturn(emptyList())
        whenever(folderFeeds.findByFeedIdIn(any<Collection<UUID>>())).thenReturn(links)
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(emptyList())
        doCallRealMethod().whenever(editions).deleteOld(any(), any())
        if (links.isNotEmpty()) {
            whenever(folders.findByUserIdAndIdIn(any(), any<Collection<UUID>>())).thenReturn(folderRows)
        }
    }

    private fun stubAi(responses: Map<String, String> = emptyMap(), failTitles: Set<String> = emptySet()) {
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenAnswer { inv ->
            val title = inv.getArgument<String?>(1) ?: ""
            if (title in failTitles) throw ApiException(502, "server AI failed")
            responses[title] ?: "summary for $title"
        }
    }

    private fun bodyOf(row: EditionEntity) = ObjectMapper().readTree(row.body!!)

    @Test
    fun buildsReadyEditionWithSectionsAndOpinion() {
        val feed = UUID.randomUUID()
        stubQuota()
        stubWindow(listOf(
            serviceArticle("a1", "story-1", feed, hoursAgo = 2),
            serviceArticle("a2", "story-1", feed, hoursAgo = 1),
            serviceArticle("b1", null, feed, hoursAgo = 3),
        ))
        stubAi(mapOf("Editorial opinion" to "Opinion: a quiet day."))

        val row = service().buildEdition(SERVICE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        assertEquals("test-model", row.model)
        val body = bodyOf(row)
        assertEquals(2, body.path("sections").size())
        assertEquals("Opinion: a quiet day.", body.path("opinion").path("text").asText())
        assertEquals(SERVICE_NOW.toEpochMilli(), body.path("generatedAt").asLong())
        assertEquals("test-model", body.path("model").asText())
        val titles = body.path("sections").map { it.path("title").asText() }.toSet()
        assertEquals(setOf("t-a2", "t-b1"), titles)
    }

    @Test
    fun buildStampsOwnerAndPrunesOnlyTheirs() {
        stubQuota()
        stubWindow(listOf(serviceArticle("a1", "story-1", UUID.randomUUID())))
        stubAi()

        val row = service().buildEdition(SERVICE_UID, 24, 12)

        assertEquals(SERVICE_UID, row.userId)
        verify(editions).deleteOld(eq(SERVICE_UID), eq(7))
    }

    @Test
    fun sectionCountCapsPublishedSections() {
        stubQuota()
        stubWindow(listOf(
            serviceArticle("a1", "story-1", UUID.randomUUID()),
            serviceArticle("b1", "story-2", UUID.randomUUID()),
        ))
        stubAi()

        val row = service().buildEdition(SERVICE_UID, 24, 1)

        assertEquals(1, bodyOf(row).path("sections").size())
    }

    @Test
    fun consumesQuotaExactlyOnce() {
        stubQuota()
        stubWindow(listOf(serviceArticle("a1", "story-1", UUID.randomUUID())))
        stubAi()

        service().buildEdition(SERVICE_UID, 24, 12)

        verify(quotaRepo, times(1)).saveAndFlush(any<AiQuotaEntity>())
    }

    @Test
    fun failedClusterContinuesWithNullSummary() {
        val feed = UUID.randomUUID()
        stubQuota()
        stubWindow(listOf(
            serviceArticle("a1", "story-1", feed, title = "Alpha"),
            serviceArticle("b1", "story-2", feed, title = "Beta"),
        ))
        stubAi(failTitles = setOf("Alpha"))

        val row = service().buildEdition(SERVICE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        val body = bodyOf(row)
        val byTitle = body.path("sections").associate { it.path("title").asText() to it }
        assertTrue(byTitle["Alpha"]!!.path("summary").isNull)
        assertEquals("summary for Beta", byTitle["Beta"]!!.path("summary").asText())
    }

    @Test
    fun folderTitleBecomesProvisionalTopic() {
        val feedA = UUID.randomUUID()
        val feedB = UUID.randomUUID()
        val folder = UUID.randomUUID()
        stubQuota()
        stubWindow(
            listOf(
                serviceArticle("a1", "story-1", feedA),
                serviceArticle("a2", "story-1", feedB),
            ),
            links = listOf(FolderFeedEntity(folder, feedA), FolderFeedEntity(folder, feedB)),
            folderRows = listOf(FolderEntity(id = folder, userId = SERVICE_UID, title = "Tech")),
        )
        stubAi()

        val row = service().buildEdition(SERVICE_UID, 24, 12)

        assertEquals("Tech", bodyOf(row).path("sections")[0].path("topic").asText())
    }

    @Test
    fun enrichmentTopicWinsOverFolderVote() {
        stubQuota()
        stubWindow(listOf(serviceArticle("a1", "story-1", UUID.randomUUID())))
        stubAi()
        val enriched = object : EditionEnrichment {
            override fun topic(clusterTitles: List<String>): String? = "Enriched"
            override fun mergeJudgment(aTitles: List<String>, bTitles: List<String>): Boolean = false
            override fun verifyClaims(
                clusterId: String,
                claims: List<String>,
                evidence: List<String>,
            ): Map<String, Boolean> = emptyMap()
        }

        val row = service(enriched).buildEdition(SERVICE_UID, 24, 12)

        assertEquals("Enriched", bodyOf(row).path("sections")[0].path("topic").asText())
    }

    @Test
    fun opinionIsStoredLabeled() {
        stubQuota()
        stubWindow(listOf(serviceArticle("a1", "story-1", UUID.randomUUID())))
        stubAi(mapOf("Editorial opinion" to "Opinion: markets rallied."))

        val row = service().buildEdition(SERVICE_UID, 24, 12)

        val opinion = bodyOf(row).path("opinion").path("text").asText()
        assertTrue(opinion.startsWith("Opinion:"), "opinion carries its label")
    }
}
