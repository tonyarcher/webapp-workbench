package stockgame.web

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import stockgame.persist.UserEntity
import stockgame.persist.UserRepo

private const val ALICE_SUB = "alice-sub"
private const val BOB_SUB = "bob-sub"
private val ALICE_ID = UUID.fromString("00000000-0000-4000-8000-000000000001")
private val BOB_ID = UUID.fromString("00000000-0000-4000-8000-000000000002")

private fun jwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("stock-game"))
    .build()

@WebMvcTest
@Import(TestApiConfig::class, RequestIdFilter::class, SecurityConfig::class, IdentityUser::class)
class ApiRoutesTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    private fun asUser(sub: String, id: UUID) {
        whenever(decoder.decode(any())).thenReturn(jwt(sub))
        stubUser(users, sub, id)
    }

    private fun authedGet(path: String, token: String) = mvc.get(path) {
        header("Authorization", "Bearer $token")
    }.andReturn()

    @Test
    fun unauthorizedWithoutToken() {
        val res = mvc.get("/config").andReturn()
        assertEquals(401, res.response.status)
        assertEquals("""{"error":"unauthorized"}""", res.response.contentAsString)
    }

    @Test
    fun validTokenProvisionsIdentityUser() {
        whenever(decoder.decode(any())).thenReturn(jwt(ALICE_SUB))
        whenever(users.findBySubject(ALICE_SUB)).thenReturn(null)
        val saved = UserEntity(id = ALICE_ID, subject = ALICE_SUB, username = ALICE_SUB)
        whenever(users.save(any())).thenReturn(saved)
        val res = authedGet("/config", "alice-token")
        assertEquals(200, res.response.status)
        val captor = argumentCaptor<UserEntity>()
        verify(users).save(captor.capture())
        assertEquals(ALICE_SUB, captor.firstValue.subject)
    }

    @Test
    fun knownSubjectSkipsInsert() {
        whenever(decoder.decode(any())).thenReturn(jwt(BOB_SUB))
        whenever(users.findBySubject(BOB_SUB))
            .thenReturn(UserEntity(id = BOB_ID, subject = BOB_SUB, username = BOB_SUB))
        val res = authedGet("/config", "bob-token")
        assertEquals(200, res.response.status)
        verify(users, never()).save(any())
    }

    @Test
    fun configRoundTrip() {
        asUser(ALICE_SUB, ALICE_ID)
        val put = mvc.put("/config") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"startingCashCents":1000000,"startDate":1704067200000}"""
        }.andReturn()
        assertEquals(200, put.response.status)
        assertTrue(put.response.contentAsString.contains("\"startingCashCents\":1000000,"))
        val got = authedGet("/config", "alice-token")
        assertEquals(200, got.response.status)
        assertTrue(got.response.contentAsString.contains("\"startingCashCents\":1000000,"))
    }

    @Test
    fun usersGetSeparatePortfolios() {
        asUser(ALICE_SUB, ALICE_ID)
        mvc.put("/config") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"startingCashCents":1000000,"startDate":1704067200000}"""
        }.andReturn()
        asUser(BOB_SUB, BOB_ID)
        val got = authedGet("/config", "bob-token")
        assertEquals(200, got.response.status)
        assertTrue(!got.response.contentAsString.contains("\"startingCashCents\":1000000,"))
        assertTrue(got.response.contentAsString.contains("\"startingCashCents\":10000000"))
    }

    @Test
    fun tradesRejectInvalid() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = mvc.post("/trades") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"","side":"buy","qty":0,"at":1704067200000}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun ordersListAndCancel() {
        asUser(ALICE_SUB, ALICE_ID)
        val placed = mvc.post("/orders") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"buy","qty":1,"executeAt":4102444800000}"""
        }.andReturn()
        assertEquals(200, placed.response.status)
        val list = authedGet("/orders", "alice-token")
        assertEquals(200, list.response.status)
        assertTrue(list.response.contentAsString.contains("AAPL"))
    }

    @Test
    fun quoteRequiresSymbol() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = authedGet("/quote?symbol=", "alice-token")
        assertEquals(400, res.response.status)
    }

    @Test
    fun searchRequiresQuery() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = authedGet("/search?q=", "alice-token")
        assertEquals(400, res.response.status)
    }

    @Test
    fun unknownPath404() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = authedGet("/nope", "alice-token")
        assertEquals(404, res.response.status)
        assertEquals("""{"error":"not found"}""", res.response.contentAsString)
    }

    @Test
    fun invalidSideIs400() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = mvc.post("/trades") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"BUY","qty":1,"at":1704067200000}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun limitOrderNeedsPrice() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = mvc.post("/orders") {
            header("Authorization", "Bearer alice-token")
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"buy","qty":1,"executeAt":4102444800000,"orderType":"limit"}"""
        }.andReturn()
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("limitPrice"))
    }

    @Test
    fun badQueryParamIs400() {
        asUser(ALICE_SUB, ALICE_ID)
        val res = authedGet("/bars?symbol=AAPL&interval=1d&from=abc&to=9", "alice-token")
        assertEquals(400, res.response.status)
    }
}
