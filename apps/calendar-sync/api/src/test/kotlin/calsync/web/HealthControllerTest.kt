package calsync.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals

@WebMvcTest(HealthController::class)
@Import(SecurityConfig::class, RequestIdFilter::class)
class HealthControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @Test
    fun healthzIsOk() {
        val res = mvc.get("/healthz").andReturn()
        assertEquals(200, res.response.status)
        assertEquals("""{"ok":true}""", res.response.contentAsString)
    }

    @Test
    fun readyzIsOk() {
        val res = mvc.get("/readyz").andReturn()
        assertEquals(200, res.response.status)
        assertEquals("""{"ok":true}""", res.response.contentAsString)
    }
}
