package stockgame.web

import kotlin.test.Test
import kotlin.test.assertEquals
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(HealthController::class)
@Import(RequestIdFilter::class)
class HealthControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun healthzOk() {
        val response = mvc.get("/healthz").andReturn()
        assertEquals(200, response.response.status)
        assertEquals("""{"ok":true}""", response.response.contentAsString)
    }

    @Test
    fun readyzOffline() {
        val response = mvc.get("/readyz").andReturn()
        assertEquals(503, response.response.status)
        assertEquals("""{"ok":false}""", response.response.contentAsString)
    }
}
