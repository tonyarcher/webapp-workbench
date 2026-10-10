package rssapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(AppShellController::class)
@Import(SecurityConfig::class, RequestIdFilter::class)
class AppShellControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @Test
    fun appShellIsPublicHtmlWithBootstrap() {
        val result = mvc.get("/app").andReturn()
        assertEquals(200, result.response.status)
        assertTrue(result.response.contentType?.startsWith("text/html") == true)
        assertTrue(result.response.contentAsString.contains("<title>RSS Reader</title>"))
        assertTrue(result.response.contentAsString.contains("id=\"rss-bootstrap\""))
    }

    @Test
    fun appShellIsNotCached() {
        val result = mvc.get("/app").andReturn()
        assertEquals("no-cache", result.response.getHeader("Cache-Control"))
    }
}
