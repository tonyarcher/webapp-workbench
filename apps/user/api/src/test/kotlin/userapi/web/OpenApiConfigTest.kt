package userapi.web

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
        val api = config.userOpenApi()
        assertEquals("user-api", api.info.title)
        assertEquals("1", api.info.version)
    }

    @Test
    fun customizerAddsVersionHeaderToDataRoutes() {
        val open = versionedPaths()
        config.versionHeaderCustomizer().customise(open)
        val meParams = open.paths["/me"]?.get?.parameters.orEmpty()
        assertTrue(meParams.any { it.name == "X-Api-Version" })
        val csrfParams = open.paths["/csrf"]?.get?.parameters.orEmpty()
        assertTrue(csrfParams.any { it.name == "X-Api-Version" })
    }

    @Test
    fun customizerSkipsUnversionedRoutes() {
        val open = unversionedPaths()
        config.versionHeaderCustomizer().customise(open)
        val healthParams = open.paths["/healthz"]?.get?.parameters.orEmpty()
        assertTrue(healthParams.none { it.name == "X-Api-Version" })
        val jwksParams = open.paths["/oauth/jwks"]?.get?.parameters.orEmpty()
        assertTrue(jwksParams.none { it.name == "X-Api-Version" })
        val tokenParams = open.paths["/oauth/token"]?.post?.parameters.orEmpty()
        assertTrue(tokenParams.none { it.name == "X-Api-Version" })
        val docsParams = open.paths["/v3/api-docs"]?.get?.parameters.orEmpty()
        assertTrue(docsParams.none { it.name == "X-Api-Version" })
        val uiParams = open.paths["/swagger-ui/index.html"]?.get?.parameters.orEmpty()
        assertTrue(uiParams.none { it.name == "X-Api-Version" })
        val rootParams = open.paths["/"]?.get?.parameters.orEmpty()
        assertTrue(rootParams.none { it.name == "X-Api-Version" })
    }

    @Test
    fun customizerSkipsPresentParamAndEmptyPaths() {
        val open = OpenAPI()
        open.paths(mixedPaths())
        config.versionHeaderCustomizer().customise(open)
        assertEquals(1, open.paths["/me"]?.get?.parameters?.size)
        assertEquals(2, open.paths["/login"]?.post?.parameters?.size)
        config.versionHeaderCustomizer().customise(OpenAPI())
    }
}

private fun mixedPaths(): Paths = Paths().apply {
    val withParam = Operation()
    withParam.addParametersItem(
        io.swagger.v3.oas.models.parameters.Parameter()
            .name("X-Api-Version")
            .`in`("header"),
    )
    addPathItem("/me", PathItem().get(withParam))
    val otherParam = Operation()
    otherParam.addParametersItem(
        io.swagger.v3.oas.models.parameters.Parameter()
            .name("Other")
            .`in`("query"),
    )
    addPathItem("/login", PathItem().post(otherParam))
    addPathItem("/empty", PathItem())
}

private fun versionedPaths(): OpenAPI {
    val open = OpenAPI()
    open.paths(
        Paths().apply {
            addPathItem("/me", PathItem().get(Operation()))
            addPathItem("/csrf", PathItem().get(Operation()))
        },
    )
    return open
}

private fun unversionedPaths(): OpenAPI {
    val open = OpenAPI()
    open.paths(
        Paths().apply {
            addPathItem("/healthz", PathItem().get(Operation()))
            addPathItem("/oauth/jwks", PathItem().get(Operation()))
            addPathItem("/oauth/token", PathItem().post(Operation()))
            addPathItem("/v3/api-docs", PathItem().get(Operation()))
            addPathItem("/swagger-ui/index.html", PathItem().get(Operation()))
            addPathItem("/", PathItem().get(Operation()))
        },
    )
    return open
}
