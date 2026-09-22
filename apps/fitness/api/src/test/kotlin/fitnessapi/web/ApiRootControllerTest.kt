package fitnessapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(ApiRootController::class)
@Import(RequestIdFilter::class)
class ApiRootControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun rootOk() {
        val result = mvc.get("/").andReturn()
        assertEquals(200, result.response.status)
        val body = result.response.contentAsString
        assertTrue(body.contains("\"_links\""))
        assertTrue(body.contains("\"self\""))
        assertTrue(body.contains("/v3/api-docs"))
        assertTrue(body.contains("/swagger-ui.html"))
    }

    @Test
    fun rootHalContentType() {
        val result = mvc.get("/") {
            header("Accept", "application/hal+json")
        }.andReturn()
        assertEquals(200, result.response.status)
        assertTrue(result.response.contentType?.contains("hal") == true)
    }

    @Test
    fun rootJsonAlsoHasLinks() {
        val result = mvc.get("/") {
            header("Accept", "application/json")
        }.andReturn()
        assertEquals(200, result.response.status)
        assertTrue(result.response.contentAsString.contains("\"_links\""))
    }
}
