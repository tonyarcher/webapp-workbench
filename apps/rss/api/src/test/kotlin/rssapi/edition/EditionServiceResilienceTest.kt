package rssapi.edition

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.never
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
import rssapi.persist.AffinityId
import rssapi.persist.AffinityRepo
import rssapi.persist.AiQuotaEntity
import rssapi.persist.AiQuotaRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.EDITION_FAILED
import rssapi.persist.EDITION_READY
import rssapi.persist.EditionEntity
import rssapi.persist.EditionRepo
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.web.ApiException

private val RESILIENCE_NOW: Instant = Instant.parse("2026-09-13T12:00:00Z")
private val RESILIENCE_UID: UUID = UUID.fromString("33333333-3333-3333-3333-333333333333")

@ExtendWith(MockitoExtension::class)
class EditionServiceResilienceTest {
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

    private fun service(): EditionService {
        val config = AiConfig(
            provider = "ollama",
            baseUrl = "http://ollama:11434",
            model = "test-model",
            hourlyLimit = 30,
            dailyLimit = 100,
            maxInputChars = 8_000,
        )
        val quotas = AiQuotaService(quotaRepo)
        quotas.clock = Clock.fixed(RESILIENCE_NOW, ZoneOffset.UTC)
        val enrichment = SignalEnrichment()
        val out = EditionService(articles, affinity, folders, folderFeeds, editions, ai, quotas, enrichment, config)
        out.clock = Clock.fixed(RESILIENCE_NOW, ZoneOffset.UTC)
        return out
    }

    private fun article(id: String): ArticleEntity = ArticleEntity(
        id = id,
        feedId = UUID.randomUUID(),
        guid = "g-$id",
        title = "t-$id",
        normLink = "story-$id",
        summary = "summary $id",
        publishedAt = RESILIENCE_NOW.minusSeconds(3_600),
        fetchedAt = RESILIENCE_NOW.minusSeconds(3_600),
    )

    private fun stubQuota() {
        whenever(quotaRepo.findById(any())).thenReturn(Optional.empty())
        whenever(quotaRepo.saveAndFlush(any<AiQuotaEntity>())).thenAnswer { it.getArgument(0) }
    }

    private fun bodyOf(row: EditionEntity) = ObjectMapper().readTree(row.body!!)

    @Test
    fun quota429AbortsToFailedWithNoBody() {
        val spent = AiQuotaEntity(RESILIENCE_UID, RESILIENCE_NOW, 30, RESILIENCE_NOW, 1)
        whenever(quotaRepo.findById(RESILIENCE_UID)).thenReturn(Optional.of(spent))
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }

        val err = assertFailsWith<ApiException> { service().buildEdition(RESILIENCE_UID, 24, 12) }

        assertEquals(429, err.status)
        verify(ai, never()).summarize(any(), anyOrNull(), any(), any())
        val saved = argumentCaptor<EditionEntity>()
        verify(editions, times(2)).save(saved.capture())
        assertEquals(EDITION_FAILED, saved.lastValue.status)
        assertNull(saved.lastValue.body)
    }

    @Test
    fun unexpectedFailureMarksFailedAs500() {
        stubQuota()
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenThrow(RuntimeException("db down"))
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }

        val err = assertFailsWith<ApiException> { service().buildEdition(RESILIENCE_UID, 24, 12) }

        assertEquals(500, err.status)
        val saved = argumentCaptor<EditionEntity>()
        verify(editions, times(2)).save(saved.capture())
        assertEquals(EDITION_FAILED, saved.lastValue.status)
    }

    @Test
    fun pruneKeepsSevenNewest() {
        stubQuota()
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(listOf(article("a1"))))
        whenever(affinity.findAllById(any<Iterable<AffinityId>>())).thenReturn(emptyList())
        whenever(folderFeeds.findByFeedIdIn(any<Collection<UUID>>())).thenReturn(emptyList())
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenReturn("s")
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        val old = (1..8).map {
            EditionEntity(status = EDITION_READY, createdAt = RESILIENCE_NOW.minusSeconds(it * 60L))
        }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(old)
        doCallRealMethod().whenever(editions).deleteOld(any(), any())

        val row = service().buildEdition(RESILIENCE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        val deleted = argumentCaptor<MutableIterable<EditionEntity>>()
        verify(editions).deleteAll(deleted.capture())
        assertEquals(1, deleted.firstValue.toList().size)
    }

    @Test
    fun emptyWindowStillBuildsReady() {
        stubQuota()
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(emptyList()))
        whenever(affinity.findAllById(any<Iterable<AffinityId>>())).thenReturn(emptyList())
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(emptyList())
        doCallRealMethod().whenever(editions).deleteOld(any(), any())

        val row = service().buildEdition(RESILIENCE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        val body = bodyOf(row)
        assertEquals(0, body.path("sections").size())
        assertTrue(body.path("opinion").isNull)
        verify(ai, never()).summarize(any(), anyOrNull(), any(), any())
    }

    @Test
    fun articlesWithoutFoldersGetNullTopic() {
        stubQuota()
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(listOf(article("a1"))))
        whenever(affinity.findAllById(any<Iterable<AffinityId>>())).thenReturn(emptyList())
        whenever(folderFeeds.findByFeedIdIn(any<Collection<UUID>>())).thenReturn(emptyList())
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenReturn("s")
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(emptyList())
        doCallRealMethod().whenever(editions).deleteOld(any(), any())

        val row = service().buildEdition(RESILIENCE_UID, 24, 12)

        assertTrue(bodyOf(row).path("sections")[0].path("topic").isNull)
    }

    @Test
    fun opinionFailureLeavesNullOpinion() {
        stubQuota()
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(listOf(article("a1"))))
        whenever(affinity.findAllById(any<Iterable<AffinityId>>())).thenReturn(emptyList())
        whenever(folderFeeds.findByFeedIdIn(any<Collection<UUID>>())).thenReturn(emptyList())
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenAnswer { inv ->
            if ((inv.getArgument<String?>(1) ?: "") == "Editorial opinion") throw ApiException(502, "server AI failed")
            "section summary"
        }
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(emptyList())
        doCallRealMethod().whenever(editions).deleteOld(any(), any())

        val row = service().buildEdition(RESILIENCE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        assertTrue(bodyOf(row).path("opinion").isNull)
    }

    @Test
    fun blankArticleSkipsAiEntirely() {
        stubQuota()
        val blank = ArticleEntity(
            id = "blank",
            feedId = UUID.randomUUID(),
            guid = "g-blank",
            title = "",
            publishedAt = RESILIENCE_NOW.minusSeconds(3_600),
            fetchedAt = RESILIENCE_NOW.minusSeconds(3_600),
        )
        whenever(articles.findAll(any<Specification<ArticleEntity>>(), any<Pageable>()))
            .thenReturn(PageImpl(listOf(blank)))
        whenever(affinity.findAllById(any<Iterable<AffinityId>>())).thenReturn(emptyList())
        whenever(folderFeeds.findByFeedIdIn(any<Collection<UUID>>())).thenReturn(emptyList())
        whenever(editions.save(any<EditionEntity>())).thenAnswer { it.getArgument<EditionEntity>(0) }
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(emptyList())
        doCallRealMethod().whenever(editions).deleteOld(any(), any())

        val row = service().buildEdition(RESILIENCE_UID, 24, 12)

        assertEquals(EDITION_READY, row.status)
        assertTrue(bodyOf(row).path("sections")[0].path("summary").isNull)
        verify(ai, never()).summarize(any(), anyOrNull(), any(), any())
    }

    @Test
    fun signalEnrichmentAbstains() {
        val enrichment = SignalEnrichment()
        assertNull(enrichment.topic(listOf("a", "b")))
        assertEquals(false, enrichment.mergeJudgment(listOf("a"), listOf("b")))
        assertTrue(enrichment.verifyClaims("c", listOf("claim"), listOf("evidence")).isEmpty())
    }
}
