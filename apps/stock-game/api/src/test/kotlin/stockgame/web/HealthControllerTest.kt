package stockgame.web

import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.sql.Connection
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals

@WebMvcTest(HealthController::class)
@Import(SecurityConfig::class, RequestIdFilter::class)
class HealthControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var dataSource: DataSource

    @Test
    fun healthzOkWithoutToken() {
        val response = mvc.get("/healthz").andReturn()
        assertEquals(200, response.response.status)
        assertEquals("""{"ok":true}""", response.response.contentAsString)
    }

    @Test
    fun readyzOkWhenReachable() {
        val rs = mock<ResultSet> { on { next() } doReturn true }
        val st = mock<Statement> { on { executeQuery("SELECT 1") } doReturn rs }
        val conn = mock<Connection> { on { createStatement() } doReturn st }
        whenever(dataSource.connection).doReturn(conn)
        val response = mvc.get("/readyz").andReturn()
        assertEquals(200, response.response.status)
        assertEquals("""{"ok":true}""", response.response.contentAsString)
    }

    @Test
    fun readyzDownWhenBroken() {
        whenever(dataSource.connection).doThrow(SQLException("down"))
        val response = mvc.get("/readyz").andReturn()
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.response.status)
        assertEquals("""{"ok":false}""", response.response.contentAsString)
    }
}
