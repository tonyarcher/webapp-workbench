package stockgame.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.mock.env.MockEnvironment
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SwaggerDocsParsingTest {
    @Test
    fun truthyValuesMatchSpring() {
        for (value in listOf("1", "true", "TRUE", "yes", "on")) {
            assertTrue(
                swaggerEnabledFromEnv(MockEnvironment().withProperty("SWAGGER_ENABLED", value)),
                "SWAGGER_ENABLED=$value must be truthy, or the gate and springdoc disagree",
            )
        }
        for (value in listOf("0", "false", "no", "off", "banana")) {
            assertFalse(
                swaggerEnabledFromEnv(MockEnvironment().withProperty("SWAGGER_ENABLED", value)),
                "SWAGGER_ENABLED=$value must be falsy",
            )
        }
        assertFalse(swaggerEnabledFromEnv(MockEnvironment()), "unset must be falsy")
    }

    @Test
    fun whitespaceIsTrimmed() {
        assertTrue(swaggerEnabledFromEnv(MockEnvironment().withProperty("SWAGGER_ENABLED", " true ")))
    }
}

/**
 * The doc paths were permitted unconditionally, so nothing but a default in
 * application.yml kept the schema from being public. This pins the default
 * (unset SWAGGER_ENABLED) to deny them.
 */
@WebMvcTest(ApiRootController::class)
@Import(SecurityConfig::class, RequestIdFilter::class)
class SwaggerDocsDeniedTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @Test
    fun schemaIsDeniedWhenSwaggerIsDisabled() {
        for (path in listOf("/v3/api-docs", "/swagger-ui.html", "/swagger-ui/", "/webjars/x.js")) {
            val result = mvc.get(path).andReturn()
            assertEquals(401, result.response.status, "$path should be denied")
        }
    }

    @Test
    fun publicEndpointsStillWork() {
        // Only / is mapped in this slice; /healthz lives in HealthController.
        assertEquals(200, mvc.get("/").andReturn().response.status)
    }
}
