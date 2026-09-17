package stockgame.web

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import stockgame.persist.UserEntity
import stockgame.persist.UserRepo

private fun marketJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("stock-game"))
    .build()

@WebMvcTest(MarketController::class)
@Import(TestApiConfig::class, RequestIdFilter::class, SecurityConfig::class, IdentityUser::class)
class MarketControllerBranchTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    private fun auth() {
        val id = UUID.randomUUID()
        whenever(decoder.decode(any())).thenReturn(marketJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = id, subject = "u1", username = "u1"))
    }

    private fun authedGet(path: String, params: Map<String, String> = emptyMap()) = mvc.get(path) {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer t")
        params.forEach { (k, v) -> param(k, v) }
    }.andReturn()

    @Test
    fun barsRejectsEmptySymbol() {
        auth()
        val res = authedGet("/bars", mapOf("symbol" to "  ", "interval" to "1d", "from" to "1", "to" to "2"))
        assertEquals(400, res.response.status)
    }

    @Test
    fun barsMissingParamIs400() {
        auth()
        assertEquals(400, authedGet("/bars?symbol=AAPL").response.status)
    }

    @Test
    fun quoteMissingSymbolIs400() {
        auth()
        assertEquals(400, authedGet("/quote").response.status)
    }

    @Test
    fun searchBlankIs400() {
        auth()
        assertEquals(400, authedGet("/search", mapOf("q" to "   ")).response.status)
    }

    @Test
    fun barsHappyPath() {
        auth()
        val res = authedGet(
            "/bars",
            mapOf("symbol" to "AAPL", "interval" to "1d", "from" to "1", "to" to "9999999999999"),
        )
        assertEquals(200, res.response.status)
    }

    @Test
    fun searchHappyPath() {
        auth()
        val res = authedGet("/search", mapOf("q" to " tesla "))
        assertEquals(200, res.response.status)
    }
}
