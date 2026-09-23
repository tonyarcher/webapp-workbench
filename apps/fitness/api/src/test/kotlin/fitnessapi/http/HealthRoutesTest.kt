package fitnessapi.http

import fitnessapi.web.HealthController
import fitnessapi.web.RequestIdFilter
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.Test
import kotlin.test.assertEquals

@WebMvcTest(HealthController::class)
@Import(RequestIdFilter::class)
class HealthRoutesTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun healthzOkWithoutDatabase() {
        val response = mvc.get("/healthz").andReturn()
        assertEquals(200, response.response.status)
        assertEquals("""{"ok":true}""", response.response.contentAsString)
    }

    @Test
    fun readyzUnavailableWithoutDatabase() {
        val response = mvc.get("/readyz").andReturn()
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.response.status)
        assertEquals("""{"ok":false}""", response.response.contentAsString)
    }

    @Test
    fun echoesRequestId() {
        val response = mvc.get("/healthz") {
            header("X-Api-Version", "1")
            header("X-Request-ID", "req-1")
        }.andReturn()
        assertEquals("req-1", response.response.getHeader("X-Request-ID"))
    }
}
