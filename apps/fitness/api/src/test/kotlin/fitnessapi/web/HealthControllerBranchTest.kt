package fitnessapi.web

import java.sql.Connection
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(HealthController::class)
@Import(RequestIdFilter::class)
class HealthControllerBranchTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var dataSource: DataSource

    @Test
    fun readyzOkWhenReachable() {
        val rs = mock<ResultSet> { on { next() } doReturn true }
        val st = mock<Statement> { on { executeQuery("SELECT 1") } doReturn rs }
        val conn = mock<Connection> { on { createStatement() } doReturn st }
        whenever(dataSource.connection).doReturn(conn)
        val response = mvc.get("/readyz").andReturn()
        assertEquals(200, response.response.status)
    }

    @Test
    fun readyzDownWhenBroken() {
        whenever(dataSource.connection).doThrow(SQLException("down"))
        val response = mvc.get("/readyz").andReturn()
        assertEquals(503, response.response.status)
    }
}
