package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import rssapi.fetch.PageFetcher
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.util.UUID

@WebMvcTest(ScrapeSourceController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ScrapeSourceControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var feeds: FeedRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    @MockitoBean
    lateinit var sync: IngestSync

    @MockitoBean
    lateinit var ingest: IngestService

    @MockitoBean
    lateinit var pages: PageFetcher

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("aud", listOf("rss-reader"))
                .build(),
        )
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = UUID.randomUUID(), label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun create(body: String) = mvc.post("/sources") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer good")
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun missingAuthIsRejected() {
        mvc.post("/sources") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun reportsFetchFailure() {
        stubAuth()
        whenever(pages.fetchHtml("https://example.com/blog")).thenThrow(IllegalStateException("down"))
        create("""{"url":"https://example.com/blog"}""").andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("Could not fetch page: down") }
        }
    }

    @Test
    fun reusesAnExistingWatchedPage() {
        stubAuth()
        val existing = FeedEntity(
            id = UUID.randomUUID(),
            xmlUrl = "https://example.com/blog",
            sourceKind = "scrape",
            pageUrl = "https://example.com/blog",
        )
        whenever(pages.fetchHtml(existing.xmlUrl)).thenReturn("<title>old</title>")
        whenever(feeds.findByXmlUrl(existing.xmlUrl)).thenReturn(existing)
        whenever(subs.existsByUserIdAndFeedId(any(), any())).thenReturn(true)
        create("""{"url":"${existing.xmlUrl}"}""").andExpect { status { isOk() } }
        verify(feeds, org.mockito.kotlin.never()).save(any())
        verify(ingest).scrapeAndIngest(existing)
    }

    @Test
    fun doesNotReuseARssFeedAtTheSameUrl() {
        stubAuth()
        val rss = FeedEntity(id = UUID.randomUUID(), xmlUrl = "https://example.com/blog", sourceKind = "rss")
        whenever(pages.fetchHtml(rss.xmlUrl)).thenReturn("<title>Blog</title>")
        whenever(feeds.findByXmlUrl(rss.xmlUrl)).thenReturn(rss)
        whenever(feeds.save(any<FeedEntity>())).thenAnswer {
            val entity: FeedEntity = it.getArgument(0)
            entity.id = UUID.randomUUID()
            entity
        }
        create("""{"url":"${rss.xmlUrl}","selector":"  "}""").andExpect {
            status { isOk() }
            jsonPath("$.sourceKind") { value("scrape") }
        }
    }

    @Test
    fun missingVersionIsNotRouted() {
        stubAuth()
        mvc.post("/sources") {
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun rejectsNonHttpUrl() {
        stubAuth()
        create("""{"url":"javascript:alert(1)"}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun createsWatchedPage() {
        stubAuth()
        val url = "https://example.com/blog"
        whenever(pages.fetchHtml(url)).thenReturn("<html><head><title>Blog</title></head><body></body></html>")
        whenever(feeds.findByXmlUrl(url)).thenReturn(null)
        val saved = FeedEntity(
            id = UUID.randomUUID(),
            xmlUrl = url,
            title = "Blog",
            sourceKind = "scrape",
            pageUrl = url,
            itemSelector = ".post",
        )
        whenever(feeds.save(any<FeedEntity>())).thenReturn(saved)

        create("""{"url":"$url","selector":".post"}""").andExpect {
            status { isOk() }
            jsonPath("$.sourceKind") { value("scrape") }
            jsonPath("$.itemSelector") { value(".post") }
            jsonPath("$.title") { value("Blog") }
        }
        verify(ingest).scrapeAndIngest(saved)
    }
}
