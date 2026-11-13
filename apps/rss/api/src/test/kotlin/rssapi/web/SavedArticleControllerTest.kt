package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.SavedArticleEntity
import rssapi.persist.SavedArticleRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID

private fun savedJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(SavedArticleController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class SavedArticleControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var saved: SavedArticleRepo

    @MockitoBean
    lateinit var articles: ArticleRepo

    @MockitoBean
    lateinit var feeds: FeedRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    private val uid = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    private fun auth() {
        whenever(decoder.decode(any())).thenReturn(savedJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun row(articleId: String = "a1") = SavedArticleEntity(
        id = UUID.randomUUID(),
        userId = uid,
        articleId = articleId,
        feedId = feedId,
        feedTitle = "Feed",
        title = "Saved title",
        savedAt = Instant.ofEpochMilli(1_000),
    )

    private fun article() = ArticleEntity(
        id = "a1",
        feedId = feedId,
        guid = "g1",
        title = "Article title",
        publishedAt = Instant.ofEpochMilli(1_000),
    )

    private fun subscribed() {
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(
            feeds.findById(feedId),
        ).thenReturn(Optional.of(FeedEntity(id = feedId, xmlUrl = "https://f.example/rss", title = "Feed")))
    }

    @Test
    fun listReturnsSnapshots() {
        auth()
        whenever(saved.findByUserIdOrderBySavedAtDesc(uid)).thenReturn(listOf(row()))
        mvc.get("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.items[0].articleId") { value("a1") }
            jsonPath("$.items[0].title") { value("Saved title") }
        }
    }

    @Test
    fun saveRequiresArticleId() {
        auth()
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"  "}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun saveReturnsExistingRow() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(row())
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.articleId") { value("a1") }
        }
        verify(articles, never()).findById(any())
    }

    @Test
    fun saveRejectsUnknownArticle() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(null)
        whenever(articles.findById("a1")).thenReturn(Optional.empty())
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isNotFound() }
        }
    }

    @Test
    fun saveRejectsUnsubscribedFeed() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(null)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isNotFound() }
        }
    }

    @Test
    fun saveSnapshotsSubscribedArticle() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(null)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        subscribed()
        whenever(saved.save(any<SavedArticleEntity>())).thenAnswer { inv ->
            (inv.arguments[0] as SavedArticleEntity).apply { id = UUID.randomUUID() }
        }
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.feedTitle") { value("Feed") }
            jsonPath("$.title") { value("Article title") }
        }
    }

    @Test
    fun saveToleratesMissingFeedRow() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(null)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(feeds.findById(feedId)).thenReturn(Optional.empty())
        whenever(saved.save(any<SavedArticleEntity>())).thenAnswer { inv ->
            (inv.arguments[0] as SavedArticleEntity).apply { id = UUID.randomUUID() }
        }
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isOk() }
        }
    }

    @Test
    fun saveReturnsExistingRowAfterRace() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1"))
            .thenReturn(null)
            .thenReturn(row())
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        subscribed()
        whenever(saved.save(any<SavedArticleEntity>())).thenThrow(DataIntegrityViolationException("duplicate"))
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.articleId") { value("a1") }
        }
    }

    @Test
    fun saveAnswersConflictWhenRaceWinnerMissing() {
        auth()
        whenever(saved.findByUserIdAndArticleId(uid, "a1")).thenReturn(null)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        subscribed()
        whenever(saved.save(any<SavedArticleEntity>())).thenThrow(DataIntegrityViolationException("duplicate"))
        mvc.post("/saved-articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isConflict() }
        }
    }

    @Test
    fun removeRejectsBlankId() {
        auth()
        mvc.delete("/saved-articles/%20") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun removeDeletesById() {
        auth()
        mvc.delete("/saved-articles/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
        }
        verify(saved).deleteByUserIdAndArticleId(uid, "a1")
    }
}
