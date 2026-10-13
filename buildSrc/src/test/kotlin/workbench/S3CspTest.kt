package workbench

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class S3CspTest {
    @Test
    fun cspPathSourceAppendsSlashOnlyWhenAPathIsPresent() {
        assertEquals("https://host", cspPathSource("https://host"))
        assertEquals("https://host", cspPathSource("https://host/"))
        assertEquals("https://host/calendar-sync/api/", cspPathSource("https://host/calendar-sync/api"))
        assertEquals("https://host/calendar-sync/api/", cspPathSource("https://host/calendar-sync/api/"))
        assertEquals("http://host/user-api/", cspPathSource("http://host/user-api"))
    }

    @Test
    fun cspHeaderJoinsPathBearingSourcesAsPrefixes() {
        val app = S3App(
            id = "calendar-sync",
            basePath = "/calendar-sync/",
            distDir = "apps/calendar-sync/dist",
            apiBase = "https://gateway/calendar-sync/api",
            identityBase = "https://gateway/user-api",
        )
        val header = requireNotNull(cspHeader(app))
        assertTrue(
            "connect-src https://gateway/calendar-sync/api/ https://gateway/user-api/" in header,
            "path-bearing connect sources must end in a slash or CSP matches them exactly: $header",
        )
        assertTrue("frame-src https://accounts.google.com" in header, "GIS iframe origin: $header")
        assertTrue("style-src 'self' 'unsafe-inline'" in header, "lit style attributes: $header")
        assertTrue("script-src 'self' https://accounts.google.com" in header, "GIS script: $header")
    }

    @Test
    fun cspHeaderOmitsSourcesForAppsWithoutThem() {
        val app = S3App(
            id = "fitness",
            basePath = "/fitness/",
            distDir = "apps/fitness/dist",
            apiBase = "https://gateway/fitness/api",
        )
        val header = requireNotNull(cspHeader(app))
        assertTrue("connect-src https://gateway/fitness/api/ 'self'" in header, header)
        assertNull(cspHeader(S3App("unknown-app", "/", "dist", "")), "no policy is written for a foreign app")
    }
}
