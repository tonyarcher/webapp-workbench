package rssapi.web

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
        val api = config.rssOpenApi()
        assertEquals("rss-api", api.info.title)
        assertEquals("1", api.info.version)
        assertTrue(api.components.securitySchemes.containsKey("bearer"))
    }

    @Test
    fun customizerAddsVersionHeaderToDataRoutes() {
        val open = OpenAPI()
        open.paths(
            Paths().apply {
                addPathItem("/articles", PathItem().get(Operation()))
                addPathItem("/healthz", PathItem().get(Operation()))
                addPathItem("/", PathItem().get(Operation()))
                addPathItem("/v3/api-docs", PathItem().get(Operation()))
                addPathItem("/swagger-ui/index.html", PathItem().get(Operation()))
            },
        )
        config.versionHeaderCustomizer().customise(open)
        val articlesParams = open.paths["/articles"]?.get?.parameters.orEmpty()
        assertTrue(articlesParams.any { it.name == "X-Api-Version" })
        val healthParams = open.paths["/healthz"]?.get?.parameters.orEmpty()
        assertTrue(healthParams.none { it.name == "X-Api-Version" })
        val rootParams = open.paths["/"]?.get?.parameters.orEmpty()
        assertTrue(rootParams.none { it.name == "X-Api-Version" })
        val docsParams = open.paths["/v3/api-docs"]?.get?.parameters.orEmpty()
        assertTrue(docsParams.none { it.name == "X-Api-Version" })
        val uiParams = open.paths["/swagger-ui/index.html"]?.get?.parameters.orEmpty()
        assertTrue(uiParams.none { it.name == "X-Api-Version" })
        assertEquals(emptyList(), open.paths["/healthz"]?.get?.security)
        assertEquals(emptyList(), open.paths["/"]?.get?.security)
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
                addPathItem("/articles", PathItem().get(withParam))
            },
        )
        config.versionHeaderCustomizer().customise(open)
        assertEquals(1, open.paths["/articles"]?.get?.parameters?.size)
        config.versionHeaderCustomizer().customise(OpenAPI())
    }
}
