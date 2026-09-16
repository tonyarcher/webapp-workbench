package userapi.web

import java.sql.Connection
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import javax.sql.DataSource
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import userapi.Settings
import userapi.accounts.AccountServices
import kotlin.test.Test
import kotlin.test.assertEquals

@WebMvcTest(HealthController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    HealthController::class,
    ErrorAdvice::class,
)
class HealthRoutesTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @MockitoBean
    private lateinit var dataSource: DataSource

    @MockitoBean
    private lateinit var accounts: AccountServices

    @Test
    fun healthzOk() {
        val response = mvc.perform(get("/healthz")).andReturn().response
        assertEquals(200, response.status)
        assertEquals("""{"ok":true}""", response.contentAsString)
    }

    @Test
    fun readyzOkWhenDatabaseReachable() {
        val rs = mock<ResultSet> { on { next() } doReturn true }
        val st = mock<Statement> { on { executeQuery("SELECT 1") } doReturn rs }
        val conn = mock<Connection> { on { createStatement() } doReturn st }
        whenever(dataSource.connection).doReturn(conn)
        val response = mvc.perform(get("/readyz")).andReturn().response
        assertEquals(200, response.status)
        assertEquals("""{"ok":true}""", response.contentAsString)
    }

    @Test
    fun readyzUnavailableWhenDatabaseDown() {
        whenever(dataSource.connection).doThrow(SQLException("down"))
        val response = mvc.perform(get("/readyz")).andReturn().response
        assertEquals(503, response.status)
        assertEquals("""{"ok":false}""", response.contentAsString)
    }

    @Test
    fun echoesRequestId() {
        val response = mvc.perform(get("/healthz").header("X-Request-ID", "req-1")).andReturn().response
        assertEquals("req-1", response.getHeader("X-Request-ID"))
    }
}
