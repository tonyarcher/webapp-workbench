package workbench

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GatewaySupportTest {
    /** The catalog shape apps.json carries for the six deployed APIs. */
    private fun catalogSpecs(): Map<String, ApiRouteSpec> = linkedMapOf(
        "times-up-api" to ApiRouteSpec("/times-up/api/", readTimeout = "120s"),
        "stock-game-api" to ApiRouteSpec("/stock-game/api/"),
        "calendar-sync-api" to ApiRouteSpec("/calendar-sync/api/"),
        "radio-api" to ApiRouteSpec("/radio-station/api/"),
        "fitness-api" to ApiRouteSpec("/fitness/api/"),
        "user-api" to ApiRouteSpec("/user-api/"),
    )

    @Test
    fun apiRoutesOfDerivesUpstreamNamesAndAddressesFromTheServiceKey() {
        val routes = apiRoutesOf(catalogSpecs()).associateBy { it.publicPath }
        val rss = requireNotNull(routes["/times-up/api/"])
        assertEquals("upstream_times_up_api", rss.upstreamVar)
        assertEquals("http://times-up-api:3000", rss.upstream)
        assertEquals("120s", rss.readTimeout)
        val user = requireNotNull(routes["/user-api/"])
        assertEquals("upstream_user_api", user.upstreamVar)
        assertEquals("http://user-api:3000", user.upstream)
        assertEquals(null, user.readTimeout)
    }

    @Test
    fun apiRoutesTokenRendersOneBlockPerRouteWithTheSharedShape() {
        val specs = catalogSpecs()
        val token = apiRoutesToken(specs)
        val blocks = token.split("\n\n")
        assertEquals(specs.size, blocks.size, "one block per route")
        for ((route, block) in apiRoutesOf(specs).zip(blocks)) {
            assertTrue("location ^~ ${route.publicPath} {" in block, block)
            assertTrue("set \$${route.upstreamVar} ${route.upstream};" in block, block)
            assertTrue("rewrite ^${route.publicPath}(.*)\$ /\$1 break;" in block, block)
            assertTrue("proxy_pass \$${route.upstreamVar};" in block, block)
            assertTrue("proxy_set_header X-Request-ID \$request_id;" in block, block)
        }
    }

    @Test
    fun apiRoutesTokenEmitsReadTimeoutOnlyWhereDeclared() {
        val blocks = apiRoutesToken(catalogSpecs()).split("\n\n")
        val rss = blocks.first { "times-up" in it }
        val stock = blocks.first { "stock-game" in it }
        assertTrue("proxy_read_timeout 120s;" in rss, rss)
        assertTrue("proxy_read_timeout" !in stock, stock)
    }
}

class AppCatalogApiRoutesTest {
    private fun catalogFile(apiRoutes: String): java.io.File {
        val dir = java.io.File.createTempFile("catalog", "").also {
            it.delete()
            it.mkdirs()
        }
        java.io.File(dir, "apps.json").writeText(
            """
            {
                "composeFile": "deploy/docker-compose.yml",
                "dockerOnly": {},
                "apiJars": { "times-up-api": "apps/times-up/api/build/libs/times-up-api-0.1.0.jar" },
                "apiRoutes": $apiRoutes,
                "apps": [
                    {
                        "id": "times-up",
                        "workspaces": ["times-up"],
                        "services": ["times-up"],
                        "basePath": "/times-up/"
                    }
                ]
            }
            """.trimIndent(),
        )
        return dir
    }

    @Test
    fun aRouteMustNameAServiceTheCatalogAlsoBuilds() {
        val error = assertFailsWith<IllegalStateException> {
            loadAppCatalog(catalogFile("""{ "ghost-api": { "path": "/ghost/api/" } }"""))
        }
        assertTrue("no such service in apiJars" in (error.message ?: ""), error.message)
    }

    @Test
    fun aRoutePathMustWrapTheSubpathInSlashes() {
        val error = assertFailsWith<IllegalStateException> {
            loadAppCatalog(catalogFile("""{ "times-up-api": { "path": "/times-up/api" } }"""))
        }
        assertTrue("must start and end" in (error.message ?: ""), error.message)
    }

    @Test
    fun aValidRouteSurvivesParsingWithItsTimeout() {
        val catalog =
            loadAppCatalog(catalogFile("""{ "times-up-api": { "path": "/times-up/api/", "readTimeout": "120s" } }"""))
        val spec = requireNotNull(catalog.apiRoutes["times-up-api"])
        assertEquals("/times-up/api/", spec.path)
        assertEquals("120s", spec.readTimeout)
    }
}
