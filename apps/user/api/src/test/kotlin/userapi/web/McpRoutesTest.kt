package userapi.web
import com.fasterxml.jackson.databind.ObjectMapper
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.McpClientInfo
import userapi.accounts.McpClientService
import userapi.accounts.McpIssuedClient
import userapi.http.FakeAccountStore
import userapi.http.PlainHasher
import userapi.http.TestCookies
import userapi.http.bodyText
import userapi.http.csrfToken
import userapi.http.getWithCookies
import userapi.http.postJson
import userapi.settingsForTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(AccountController::class, McpController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    McpController::class,
    ErrorAdvice::class,
)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class McpRoutesTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = settingsForTest()

        @Bean
        fun clock(): Clock = Clock.fixed(Instant.parse("2026-11-22T12:00:00Z"), ZoneOffset.UTC)

        @Bean
        fun dataSource(): DataSource = mock()

        @Bean
        fun services(clock: Clock): AccountServices = AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = testLimiter(limit = 100),
            clock = clock,
        )

        @Bean
        fun mcpClients(): McpClientService = mock()
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    @Autowired
    private lateinit var clients: McpClientService

    private fun signedIn(): TestCookies {
        val cookies = TestCookies()
        val csrf = mvc.getWithCookies(cookies, "/csrf").csrfToken(mapper)
        mvc.postJson(
            cookies,
            "/register",
            csrf = true,
            json = mapper.writeValueAsString(
                mapOf("username" to "alice", "password" to "twelvechars!!"),
            ),
        )
        mvc.postJson(
            cookies,
            "/login",
            csrf = true,
            json = mapper.writeValueAsString(
                mapOf("username" to "alice", "password" to "twelvechars!!"),
            ),
        )
        return cookies
    }

    @Test
    fun issueAndList() {
        val cookies = signedIn()
        val id = UUID.randomUUID()
        whenever(clients.issue(any(), any(), any())).thenReturn(McpIssuedClient(id, "desk", "jwt.token"))
        whenever(clients.list(any())).thenReturn(
            listOf(McpClientInfo(id, "desk", false, Instant.parse("2026-11-22T12:00:00Z"))),
        )

        val issued = mvc.postJson(cookies, "/oauth/mcp/clients", csrf = true, json = """{"label":"desk"}""")
        assertEquals(200, issued.response.status)
        assertTrue(issued.bodyText().contains("jwt.token"))

        val listed = mvc.getWithCookies(cookies, "/oauth/mcp/clients")
        assertEquals(200, listed.response.status)
        assertTrue(listed.bodyText().contains("desk"))
    }

    @Test
    fun consentAndRevoke() {
        val cookies = signedIn()
        val id = UUID.randomUUID()
        whenever(clients.setWrites(any(), any(), any())).thenReturn(true)
        val consentRequest = cookies.apply(
            patch("/oauth/mcp/clients/$id/consent")
                .header("X-Api-Version", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"enabled":true}"""),
        )
        assertEquals(200, mvc.perform(consentRequest).andReturn().response.status)

        whenever(clients.revoke(any(), any())).thenReturn(true)
        val revokeRequest = cookies.apply(
            delete("/oauth/mcp/clients/$id").header("X-Api-Version", "1"),
        )
        assertEquals(200, mvc.perform(revokeRequest).andReturn().response.status)
    }

    @Test
    fun failedWritesAnswer404Or400() {
        val cookies = signedIn()
        val id = UUID.randomUUID()
        whenever(clients.revoke(any(), any())).thenReturn(false)
        val revokeRequest = cookies.apply(delete("/oauth/mcp/clients/$id").header("X-Api-Version", "1"))
        assertEquals(404, mvc.perform(revokeRequest).andReturn().response.status)

        val badConsent = cookies.apply(
            patch("/oauth/mcp/clients/$id/consent")
                .header("X-Api-Version", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{}"""),
        )
        assertEquals(400, mvc.perform(badConsent).andReturn().response.status)

        whenever(clients.setWrites(any(), any(), any())).thenReturn(false)
        val missing = cookies.apply(
            patch("/oauth/mcp/clients/$id/consent")
                .header("X-Api-Version", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"enabled":true}"""),
        )
        assertEquals(404, mvc.perform(missing).andReturn().response.status)
    }

    @Test
    fun missingVersionIs404() {
        val cookies = signedIn()
        val result = mvc.perform(cookies.apply(get("/oauth/mcp/clients"))).andReturn()
        assertEquals(404, result.response.status)
    }
}
