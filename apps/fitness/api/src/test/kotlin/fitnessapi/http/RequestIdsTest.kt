package fitnessapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import fitnessapi.web.HealthController
import fitnessapi.web.RequestIdFilter

class RequestIdsTest {
    @Test
    fun prefersRequestIdHeader() {
        val ids = requestIdsFrom("req-1", null) { "generated" }
        assertEquals("req-1", ids.requestId)
        assertNull(ids.traceId)
    }

    @Test
    fun parsesTraceparent() {
        val ids = requestIdsFrom(
            null,
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        ) { "generated" }
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.requestId)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.traceId)
        assertEquals("00f067aa0ba902b7", ids.spanId)
    }

    @Test
    fun generatesWhenMissing() {
        val ids = requestIdsFrom(null, "not-a-trace") { "generated" }
        assertEquals("generated", ids.requestId)
    }
}

@WebMvcTest(HealthController::class)
@Import(RequestIdFilter::class)
class RequestIdTraceTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun traceparentPropagates() {
        val response = mvc.get("/healthz") {
            header("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
        }.andReturn()
        assertEquals(200, response.response.status)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", response.response.getHeader("X-Request-ID"))
    }
}
