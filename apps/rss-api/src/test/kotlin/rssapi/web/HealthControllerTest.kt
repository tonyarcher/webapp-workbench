package rssapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals

@WebMvcTest(HealthController::class)
class HealthControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun healthzOk() {
        val result = mvc.get("/healthz").andReturn()
        assertEquals(200, result.response.status)
        assertEquals("""{"ok":true}""", result.response.contentAsString)
    }
}
