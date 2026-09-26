package userapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import userapi.Settings
import userapi.accounts.AccountServices
import javax.sql.DataSource
import kotlin.test.assertEquals

/**
 * Whether the published API schema and UI are reachable without a session.
 *
 * The doc paths used to be permitted unconditionally, so nothing but a default
 * in application.yml kept them from being public. Flipping that default in
 * production published the whole API surface without anyone touching
 * SecurityConfig. The four paths are now gated on the same switch springdoc
 * reads, and these tests pin both sides of it so the gate cannot silently
 * become a permanent permit again.
 */
@WebMvcTest(SwaggerDocsProbe::class)
@Import(SecurityConfig::class, RequestIdFilter::class, ErrorAdvice::class, SwaggerDocsProbe::class)
class SwaggerDocsEnabledTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", swaggerEnabled = true)
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @MockitoBean
    private lateinit var dataSource: DataSource

    @MockitoBean
    private lateinit var accounts: AccountServices

    @Test
    fun schemaIsPermittedWhenSwaggerIsEnabled() {
        for (path in listOf("/v3/api-docs", "/swagger-ui.html", "/swagger-ui/", "/webjars/")) {
            assertEquals(
                200,
                mvc.perform(get(path)).andReturn().response.status,
                "$path should be reachable when swaggerEnabled is true",
            )
        }
    }
}

/**
 * Same slice, with the flag at its default. The probe is absent here, so a
 * permitted request would 404; instead the assertion is that the schema is
 * denied outright, which is the whole point of the change.
 */
@WebMvcTest
@Import(SecurityConfig::class, RequestIdFilter::class, ErrorAdvice::class)
class SwaggerDocsDisabledTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", swaggerEnabled = false)
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @MockitoBean
    private lateinit var dataSource: DataSource

    @MockitoBean
    private lateinit var accounts: AccountServices

    @Test
    fun schemaIsDeniedWhenSwaggerIsDisabled() {
        for (path in listOf("/v3/api-docs", "/swagger-ui.html", "/swagger-ui/", "/webjars/")) {
            assertEquals(
                401,
                mvc.perform(get(path)).andReturn().response.status,
                "$path should be denied when swaggerEnabled is false",
            )
        }
    }
}

/**
 * Stands in for the real doc endpoints. springdoc's controllers are not part
 * of this web slice, so without a handler a permitted request returns 404 and
 * a denied one returns 401, which makes the two indistinguishable from the
 * other side. A handler turns that into 401 versus 200.
 */
@org.springframework.web.bind.annotation.RestController
class SwaggerDocsProbe {
    @org.springframework.web.bind.annotation.GetMapping(
        "/v3/api-docs",
        "/swagger-ui.html",
        "/swagger-ui/",
        "/webjars/",
    )
    fun docs() = org.springframework.http.ResponseEntity
        .ok()
        .contentType(MediaType.APPLICATION_JSON)
        .body("""{"ok":true}""")
}
