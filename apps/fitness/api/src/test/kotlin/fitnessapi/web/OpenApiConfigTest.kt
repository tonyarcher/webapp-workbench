package fitnessapi.web

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.Operation
import io.swagger.v3.oas.models.PathItem
import io.swagger.v3.oas.models.Paths
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OpenApiConfigTest {
    private val config = OpenApiConfig()

    @Test
    fun infoHasTitle() {
        val api = config.fitnessOpenApi()
        assertEquals("fitness-api", api.info.title)
        assertEquals("1", api.info.version)
    }

    @Test
    fun customizerAddsVersionHeaderToDataRoutes() {
        val open = OpenAPI()
        open.paths(
            Paths().apply {
                addPathItem("/profile", PathItem().get(Operation()))
                addPathItem("/healthz", PathItem().get(Operation()))
                addPathItem("/", PathItem().get(Operation()))
                addPathItem("/v3/api-docs", PathItem().get(Operation()))
                addPathItem("/swagger-ui/index.html", PathItem().get(Operation()))
            },
        )
        config.versionHeaderCustomizer().customise(open)
        val profileParams = open.paths["/profile"]?.get?.parameters.orEmpty()
        assertTrue(profileParams.any { it.name == "X-Api-Version" })
        val healthParams = open.paths["/healthz"]?.get?.parameters.orEmpty()
        assertTrue(healthParams.none { it.name == "X-Api-Version" })
        val rootParams = open.paths["/"]?.get?.parameters.orEmpty()
        assertTrue(rootParams.none { it.name == "X-Api-Version" })
        val docsParams = open.paths["/v3/api-docs"]?.get?.parameters.orEmpty()
        assertTrue(docsParams.none { it.name == "X-Api-Version" })
        val uiParams = open.paths["/swagger-ui/index.html"]?.get?.parameters.orEmpty()
        assertTrue(uiParams.none { it.name == "X-Api-Version" })
    }

    @Test
    fun customizerSkipsPresentParamAndEmptyPaths() {
        val open = OpenAPI()
        open.paths(
            Paths().apply {
                val withParam = Operation()
                withParam.addParametersItem(
                    io.swagger.v3.oas.models.parameters.Parameter()
                        .name("X-Api-Version")
                        .`in`("header"),
                )
                addPathItem("/samples", PathItem().get(withParam))
            },
        )
        config.versionHeaderCustomizer().customise(open)
        assertEquals(1, open.paths["/samples"]?.get?.parameters?.size)
        config.versionHeaderCustomizer().customise(OpenAPI())
    }
}
