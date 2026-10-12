package calsync.web

import calsync.persist.UserEntity
import calsync.persist.UserRepo
import calsync.trakt.TraktService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(TraktDataController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class TraktDataControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var trakt: TraktService

    private fun auth(): UUID {
        val uid = UUID.randomUUID()
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("preferred_username", "u1")
                .claim("aud", listOf("calendar-sync"))
                .build(),
        )
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
        whenever(trakt.proxiedGet(any(), any())).thenReturn("""[{"id":1}]""")
        return uid
    }

    @Test
    fun calendarShowsPassThrough() {
        val uid = auth()

        val res = mvc.get("/trakt/calendars/shows?startDate=2026-10-05&days=7") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentType?.startsWith(MediaType.APPLICATION_JSON_VALUE) == true)
        assertEquals("""[{"id":1}]""", res.response.contentAsString)
        verify(trakt).proxiedGet(eq(uid), eq("/calendars/my/shows/2026-10-05/7"))
    }

    @Test
    fun calendarMoviesPassThrough() {
        auth()

        val res = mvc.get("/trakt/calendars/movies?startDate=2026-10-05&days=33") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        verify(trakt).proxiedGet(any(), eq("/calendars/my/movies/2026-10-05/33"))
    }

    @Test
    fun calendarRejectsBadKindDateAndDays() {
        auth()
        val bad = listOf(
            "/trakt/calendars/episodes?startDate=2026-10-05&days=7",
            "/trakt/calendars/shows?startDate=tomorrow&days=7",
            "/trakt/calendars/shows?startDate=2026-10-05&days=0",
            "/trakt/calendars/shows?startDate=2026-10-05&days=34",
            "/trakt/calendars/shows?startDate=2026-10-05",
        )
        for (path in bad) {
            val res = mvc.get(path) {
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status, path)
        }
        verify(trakt, never()).proxiedGet(any(), anyOrNull())
    }

    @Test
    fun historyPassThrough() {
        auth()

        val res = mvc.get("/trakt/history/movies?page=2&limit=100") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        verify(trakt).proxiedGet(any(), eq("/sync/history/movies?page=2&limit=100"))
    }

    @Test
    fun historyRejectsBadPage() {
        auth()
        val bad = listOf(
            "/trakt/history/shows?page=0&limit=100",
            "/trakt/history/shows?page=1&limit=0",
            "/trakt/history/shows?page=1&limit=101",
            "/trakt/history/other?page=1&limit=100",
        )
        for (path in bad) {
            val res = mvc.get(path) {
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status, path)
        }
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.get("/trakt/calendars/shows?startDate=2026-10-05&days=7") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), res.response.status)
    }
}
