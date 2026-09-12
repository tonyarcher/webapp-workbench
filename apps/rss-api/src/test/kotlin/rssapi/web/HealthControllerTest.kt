package rssapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
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
    fun healthzOkWithoutToken() {
        val result = mvc.get("/healthz").andReturn()
        assertEquals(200, result.response.status)
        assertEquals("""{"ok":true}""", result.response.contentAsString)
    }
}
