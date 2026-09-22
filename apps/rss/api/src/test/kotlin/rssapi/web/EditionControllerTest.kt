package rssapi.web

import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.data.domain.Sort
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.edition.EditionService
import rssapi.persist.EDITION_FAILED
import rssapi.persist.EDITION_READY
import rssapi.persist.EditionEntity
import rssapi.persist.EditionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun editionJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(EditionController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class EditionControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var service: EditionService

    @MockitoBean
    lateinit var editions: EditionRepo

    private val now: Instant = Instant.parse("2026-09-13T12:00:00Z")

    private fun auth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(editionJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    private fun row(status: String, body: String? = """{"sections":[]}""", owner: UUID? = null): EditionEntity =
        EditionEntity(
            id = UUID.randomUUID(),
            windowStart = now.minusSeconds(24 * 3_600),
            windowEnd = now,
            status = status,
            body = body,
            model = "test-model",
            createdAt = now,
            userId = owner,
        )

    @Test
    fun buildReturnsIdAndStatus() {
        val uid = UUID.randomUUID()
        auth(uid)
        val built = row(EDITION_READY)
        whenever(service.buildEdition(any(), any(), any())).thenReturn(built)

        mvc.post("/editions/build?windowHours=48") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(built.id.toString()) }
            jsonPath("$.status") { value(EDITION_READY) }
        }
        verify(service).buildEdition(eq(uid), eq(48L), eq(12))
    }

    @Test
    fun buildDefaultsTo24Hours() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(service.buildEdition(any(), any(), any())).thenReturn(row(EDITION_READY))

        mvc.post("/editions/build") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect { status { isOk() } }
        verify(service).buildEdition(eq(uid), eq(24L), eq(12))
    }

    @Test
    fun buildRejectsBadWindow() {
        auth(UUID.randomUUID())
        whenever(service.buildEdition(any(), any(), any())).thenReturn(row(EDITION_READY))

        for (raw in listOf("0", "169", "abc")) {
            val res = mvc.post("/editions/build?windowHours=$raw") {
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(400, res.response.status, "windowHours=$raw")
            assertEquals("""{"error":"invalid windowHours"}""", res.response.contentAsString)
        }
    }

    @Test
    fun buildRejectsBadSectionCount() {
        auth(UUID.randomUUID())
        whenever(service.buildEdition(any(), any(), any())).thenReturn(row(EDITION_READY))

        for (raw in listOf("0", "13", "abc")) {
            val res = mvc.post("/editions/build?sectionCount=$raw") {
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(400, res.response.status, "sectionCount=$raw")
            assertEquals("""{"error":"invalid sectionCount"}""", res.response.contentAsString)
        }
    }

    @Test
    fun buildAcceptsSectionCount() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(service.buildEdition(any(), any(), any())).thenReturn(row(EDITION_READY))

        mvc.post("/editions/build?sectionCount=5") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect { status { isOk() } }
        verify(service).buildEdition(eq(uid), eq(24L), eq(5))
    }

    @Test
    fun latestReturnsReadyEdition() {
        auth(UUID.randomUUID())
        val ready = row(EDITION_READY)
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(EDITION_READY))).thenReturn(ready)

        mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(ready.id.toString()) }
            jsonPath("$.status") { value(EDITION_READY) }
            jsonPath("$.windowHours") { value(24) }
            jsonPath("$.generatedAt") { isNumber() }
            jsonPath("$.sections") { isArray() }
            jsonPath("$.model") { value("test-model") }
        }
    }

    @Test
    fun latestWithoutEditionIs404() {
        auth(UUID.randomUUID())
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(EDITION_READY))).thenReturn(null)

        val res = mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()

        assertEquals(404, res.response.status)
        assertEquals("""{"error":"no edition yet"}""", res.response.contentAsString)
    }

    @Test
    fun latestWithoutBodyRendersEmpty() {
        auth(UUID.randomUUID())
        val ready = row(EDITION_READY, null)
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(EDITION_READY))).thenReturn(ready)

        mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.sections.length()") { value(0) }
            jsonPath("$.opinion") { doesNotExist() }
            jsonPath("$.generatedAt") { value(now.toEpochMilli()) }
        }
    }

    @Test
    fun latestParsesRichBody() {
        auth(UUID.randomUUID())
        val body = """{"generatedAt":1700000000000,"opinion":{"text":"op!"},"sections":[
            {"id":"s1","topic":"tech","title":"T1","summary":"S1","articleIds":["a1"],
             "scores":{"worthy":0.8,"interest":0.6,"newness":0.9,"popularity":0.7}},
            {"id":"s2","title":"T2","articleIds":[]}
        ]}"""
        val ready = row(EDITION_READY, body)
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(EDITION_READY))).thenReturn(ready)

        mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.generatedAt") { value(now.toEpochMilli()) }
            jsonPath("$.opinion") { value("op!") }
            jsonPath("$.sections.length()") { value(2) }
            jsonPath("$.sections[0].topic") { value("tech") }
            jsonPath("$.sections[0].scores.worthy") { value(0.8) }
            jsonPath("$.sections[0].scores.newness") { value(0.9) }
            jsonPath("$.sections[0].scores.popularity") { value(0.7) }
            jsonPath("$.sections[1].topic") { doesNotExist() }
            jsonPath("$.sections[1].scores") { doesNotExist() }
        }
    }

    @Test
    fun malformedBodyRendersEmpty() {
        auth(UUID.randomUUID())
        val ready = row(EDITION_READY, "{oops")
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(EDITION_READY))).thenReturn(ready)

        mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.sections.length()") { value(0) }
        }
    }

    @Test
    fun byIdReturnsParsedDetail() {
        val uid = UUID.randomUUID()
        auth(uid)
        val ready = row(EDITION_READY, owner = uid)
        val rid = requireNotNull(ready.id)
        whenever(editions.findById(rid)).thenReturn(java.util.Optional.of(ready))

        mvc.get("/editions/$rid") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(ready.id.toString()) }
            jsonPath("$.windowHours") { value(24) }
            jsonPath("$.sections") { isArray() }
        }
    }

    @Test
    fun byIdWithoutEditionIs404() {
        auth(UUID.randomUUID())
        val id = UUID.randomUUID()
        whenever(editions.findById(id)).thenReturn(java.util.Optional.empty())

        val res = mvc.get("/editions/$id") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()

        assertEquals(404, res.response.status)
        assertEquals("""{"error":"no such edition"}""", res.response.contentAsString)
    }

    @Test
    fun otherUsersEditionIsInvisible() {
        val me = UUID.randomUUID()
        auth(me)
        val theirs = row(EDITION_READY, owner = UUID.randomUUID())
        val theirId = requireNotNull(theirs.id)
        whenever(editions.findTopByUserIdAndStatusOrderByCreatedAtDesc(eq(me), eq(EDITION_READY)))
            .thenReturn(null)
        whenever(editions.findById(theirId)).thenReturn(java.util.Optional.of(theirs))

        val latest = mvc.get("/editions/latest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(404, latest.response.status)

        val one = mvc.get("/editions/$theirId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(404, one.response.status)
        assertEquals("""{"error":"no such edition"}""", one.response.contentAsString)
    }

    @Test
    fun listWithoutLimitReturnsRows() {
        auth(UUID.randomUUID())
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(listOf(row(EDITION_READY)))

        mvc.get("/editions") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.editions.length()") { value(1) }
            jsonPath("$.editions[0].windowHours") { value(24) }
            jsonPath("$.editions[0].generatedAt") { isNumber() }
        }
    }

    @Test
    fun listReturnsMetadataWithoutBodies() {
        auth(UUID.randomUUID())
        whenever(editions.findByUserId(any(), any<Sort>())).thenReturn(listOf(row(EDITION_READY), row(EDITION_FAILED)))

        mvc.get("/editions?limit=5") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.editions.length()") { value(2) }
            jsonPath("$.editions[0].status") { value(EDITION_READY) }
            jsonPath("$.editions[0].body") { doesNotExist() }
        }
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.post("/editions/build") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(401, res.response.status)
        assertEquals("""{"error":"unauthorized"}""", res.response.contentAsString)
    }
}
