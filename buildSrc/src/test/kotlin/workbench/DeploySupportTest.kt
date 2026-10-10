package workbench

import kotlin.test.Test
import kotlin.test.assertEquals

class DeploySupportTest {
    @Test
    fun dotenvLineStripsABomSoTheFirstKeySurvives() {
        // PowerShell's Set-Content writes a UTF-8 BOM. Without stripping it the
        // first key parses as "\uFEFFPUBLIC_ORIGIN" and vanishes, which left
        // `${PUBLIC_ORIGIN}` unexpanded in the rendered gateway config.
        assertEquals(
            "PUBLIC_ORIGIN" to "https://host.example",
            dotenvLine("\uFEFFPUBLIC_ORIGIN=https://host.example"),
        )
    }

    @Test
    fun certHostsOfAddsTheAssetHostWhenTlsIsOn() {
        val env = mapOf("ASSETS_HOST" to "assets.example")
        assertEquals(listOf("a.example", "assets.example"), certHostsOf(env, listOf("a.example")))
    }

    @Test
    fun certHostsOfKeepsTlsOffWhenNoHostsAreSet() {
        // No TLS hosts means no certs, so the asset host must not turn TLS on.
        assertEquals(emptyList(), certHostsOf(mapOf("ASSETS_HOST" to "assets.example"), emptyList()))
    }

    @Test
    fun certHostsOfDedupesAnAssetHostAlreadyInTlsHosts() {
        assertEquals(listOf("a.example"), certHostsOf(mapOf("ASSETS_HOST" to "a.example"), listOf("a.example")))
    }

    @Test
    fun certHostsOfIgnoresABlankAssetHost() {
        assertEquals(listOf("a.example"), certHostsOf(mapOf("ASSETS_HOST" to "   "), listOf("a.example")))
    }
}
