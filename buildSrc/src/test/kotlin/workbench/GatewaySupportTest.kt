package workbench

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GatewaySupportTest {
    @Test
    fun apiRoutesTokenRendersOneBlockPerRouteWithTheSharedShape() {
        val token = apiRoutesToken()
        val blocks = token.split("\n\n")
        assertEquals(API_ROUTES.size, blocks.size, "one block per route")
        for ((route, block) in API_ROUTES.zip(blocks)) {
            assertTrue("location ^~ ${route.publicPath} {" in block, block)
            assertTrue("set \$${route.upstreamVar} ${route.upstream};" in block, block)
            assertTrue("rewrite ^${route.publicPath}(.*)\$ /\$1 break;" in block, block)
            assertTrue("proxy_pass \$${route.upstreamVar};" in block, block)
            assertTrue("proxy_set_header X-Request-ID \$request_id;" in block, block)
        }
    }

    @Test
    fun apiRoutesTokenEmitsReadTimeoutOnlyWhereDeclared() {
        val blocks = apiRoutesToken().split("\n\n")
        val rss = blocks.first { "rss-reader" in it }
        val stock = blocks.first { "stock-game" in it }
        assertTrue("proxy_read_timeout 120s;" in rss, rss)
        assertTrue("proxy_read_timeout" !in stock, stock)
    }

    @Test
    fun everyApiRouteCarriesAnUpstreamNameAndPath() {
        for (route in API_ROUTES) {
            assertTrue(route.publicPath.startsWith("/") && route.publicPath.endsWith("/"), route.publicPath)
            assertTrue(route.upstreamVar.startsWith("upstream_"), route.upstreamVar)
            assertTrue(route.upstream.startsWith("http://") && route.upstream.endsWith(":3000"), route.upstream)
        }
    }
}
