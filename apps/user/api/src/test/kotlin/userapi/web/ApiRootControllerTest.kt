package userapi.web

import javax.sql.DataSource
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import userapi.Settings
import userapi.accounts.AccountServices
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(ApiRootController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    ApiRootController::class,
    ErrorAdvice::class,
)
class ApiRootControllerTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @MockitoBean
    private lateinit var dataSource: DataSource

    @MockitoBean
    private lateinit var accounts: AccountServices

    @Test
    fun rootOkWithoutSession() {
        val response = mvc.perform(get("/")).andReturn().response
        assertEquals(200, response.status)
        val body = response.contentAsString
        assertTrue(body.contains("\"_links\""))
        assertTrue(body.contains("\"self\""))
        assertTrue(body.contains("/v3/api-docs"))
        assertTrue(body.contains("/swagger-ui.html"))
    }

    @Test
    fun rootHalContentType() {
        val response = mvc.perform(get("/").accept("application/hal+json")).andReturn().response
        assertEquals(200, response.status)
        assertTrue(response.contentType?.contains("hal") == true)
    }

    @Test
    fun rootJsonAlsoHasLinks() {
        val response = mvc.perform(get("/").accept("application/json")).andReturn().response
        assertEquals(200, response.status)
        assertTrue(response.contentAsString.contains("\"_links\""))
    }
}
