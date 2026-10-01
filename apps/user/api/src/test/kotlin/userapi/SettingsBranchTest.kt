package userapi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SettingsBranchTest {
    @Test
    fun defaults() {
        val s = settingsFromEnv(requiredEnv() + emptyMap())
        assertEquals(3000, s.port)
        assertEquals("user-api", s.service)
        assertEquals(false, s.cookieSecure)
        assertEquals("localhost", s.rpId)
    }

    @Test
    fun overrides() {
        val s = settingsFromEnv(
            requiredEnv() +
                mapOf(
                    "PORT" to "4000",
                    "COOKIE_SECURE" to "true",
                    "WEBAUTHN_RP_ID" to "example.com",
                    "WEBAUTHN_ORIGINS" to "https://example.com",
                    // Moves with the origins above: settingsFromEnv now rejects a
                    // public base whose origin is not allowed, which is the
                    // misconfiguration this guards.
                    "OAUTH_PUBLIC_BASE" to "https://example.com/user-api",
                    "OAUTH_ISSUER" to "https://example.com/issuer",
                    "LOGIN_PATH" to "/login/",
                    "SERVICE" to "svc",
                ),
        )
        assertEquals(4000, s.port)
        assertEquals(true, s.cookieSecure)
        assertEquals("example.com", s.rpId)
        assertEquals(setOf("https://example.com"), s.origins)
        assertEquals("https://example.com/issuer", s.issuer)
        assertEquals("/login/", s.loginPath)
    }

    @Test
    fun badValuesFallback() {
        val s = settingsFromEnv(
            requiredEnv() +
                mapOf(
                    "PORT" to "abc",
                    "SERVICE" to "  ",
                    "COOKIE_SECURE" to "YES",
                ),
        )
        assertEquals(3000, s.port)
        assertEquals("user-api", s.service)
        assertTrue(s.cookieSecure)
    }

    @Test
    fun unparseableOriginsAreRejectedRatherThanSilentlyEmpty() {
        // An origins value that yields no usable origin can no longer reach a
        // running service, because the public base would then match nothing. The
        // old behaviour -- an empty set, no error -- is the silent half of a
        // deployment whose passkeys cannot work.
        val failure = assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(
                requiredEnv() + mapOf("WEBAUTHN_ORIGINS" to "not a url at all,,,"),
            )
        }
        assertTrue(failure.message!!.contains("WEBAUTHN_ORIGINS"))
    }

    @Test
    fun publicBaseOutsideAllowedOriginsIsRejectedAtBoot() {
        // The deployment this guards: tokens signed for thinkpad.lan while
        // passkeys were allowed on a bare IP over plain HTTP. It booted cleanly
        // and failed later at the passkey prompt with no server-side explanation.
        val failure = assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(
                requiredEnv() +
                    mapOf(
                        "WEBAUTHN_ORIGINS" to "https://thinkpad.lan",
                        "OAUTH_PUBLIC_BASE" to "http://10.0.0.63/user-api",
                        "OAUTH_ISSUER" to "http://10.0.0.63/user-api",
                    ),
            )
        }
        val message = failure.message!!
        assertTrue(message.contains("http://10.0.0.63"), "names the offending base: $message")
        assertTrue(message.contains("https://thinkpad.lan"), "names the allowed origins: $message")
    }

    @Test
    fun matchingPublicBaseIsAccepted() {
        val s = settingsFromEnv(
            requiredEnv() +
                mapOf(
                    "WEBAUTHN_RP_ID" to "thinkpad.lan",
                    "WEBAUTHN_ORIGINS" to "https://thinkpad.lan",
                    "OAUTH_PUBLIC_BASE" to "https://thinkpad.lan/user-api",
                    "OAUTH_ISSUER" to "https://thinkpad.lan/user-api",
                ),
        )
        assertEquals("https://thinkpad.lan/user-api", s.publicBase)
    }

    @Test
    fun onlyThePathIsIgnoredWhenComparingOrigins() {
        // The gateway prefix is part of the base but not of the origin, so a
        // subpath deployment must not be rejected for carrying one.
        requirePublicOriginAllowed("https://thinkpad.lan/user-api", setOf("https://thinkpad.lan"))
        requirePublicOriginAllowed("https://thinkpad.lan", setOf("https://thinkpad.lan"))
    }

    @Test
    fun portIsPartOfTheOrigin() {
        // https://host and https://host:8443 are different origins to a browser,
        // so matching them would let a deployment pass that still fails.
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://thinkpad.lan:8443/user-api", setOf("https://thinkpad.lan"))
        }
    }

    @Test
    fun loopbackIgnoresTheDevServerPort() {
        // A dev run serves the API on its own port while the allowed origins name
        // the bare loopback host. Browsers treat loopback as secure, so requiring
        // an exact port and host match here would break every local run to catch a
        // prod misconfiguration. It only relaxes the check at boot: a dev passkey
        // still needs an allowed origin naming the host and port it is served on.
        requirePublicOriginAllowed("http://localhost:3000", setOf("http://localhost", "http://127.0.0.1"))
        requirePublicOriginAllowed("http://127.0.0.1:8080/user-api", setOf("http://localhost"))
    }

    @Test
    fun loopbackExemptionDoesNotLeakToRealHosts() {
        // The exemption is for the host, not for "the scheme happens to be http".
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("http://thinkpad.lan/user-api", setOf("https://thinkpad.lan"))
        }
    }

    @Test
    fun anExplicitPortOnThePublicBaseIsPartOfTheComparison() {
        // A deployment behind a non-default port must name that port in
        // WEBAUTHN_ORIGINS, so the origin comparison has to carry it through
        // rather than compare hosts alone.
        requirePublicOriginAllowed("https://workbench.lan:8443/user-api", setOf("https://workbench.lan:8443"))
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://workbench.lan:8443/user-api", setOf("https://workbench.lan"))
        }
    }

    @Test
    fun aDefaultPortInAnAllowedOriginIsRejectedBecauseNoBrowserReportsOne() {
        // RelyingParty is built with allowOriginPort=false, so OriginMatcher
        // exact-matches the browser's clientData.origin against the raw
        // WEBAUTHN_ORIGINS entries. A browser drops a default port when it
        // serialises that origin, so an entry spelling one out can never match and
        // every passkey would fail at the prompt. Both sides rejected here.
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://workbench.lan/user-api", setOf("https://workbench.lan:443"))
        }
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://workbench.lan:443/user-api", setOf("https://workbench.lan:443"))
        }
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("http://workbench.lan/user-api", setOf("http://workbench.lan:80"))
        }
    }

    @Test
    fun aDefaultPortOnTheBaseMatchesThePortlessOriginTheBrowserSends() {
        // The gateway or a reverse proxy may hand us an explicit :443 while the
        // browser reports the bare origin. Folding the default port on this side
        // is what keeps that working configuration from being rejected.
        requirePublicOriginAllowed("https://workbench.lan:443/user-api", setOf("https://workbench.lan"))
        requirePublicOriginAllowed("http://workbench.lan:80/user-api", setOf("http://workbench.lan"))
    }

    @Test
    fun aNonDefaultPortMustBeNamedOnBothSides() {
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://workbench.lan:8443/user-api", setOf("https://workbench.lan"))
        }
        requirePublicOriginAllowed("https://workbench.lan:8443/user-api", setOf("https://workbench.lan:8443"))
    }

    @Test
    fun ipv6LoopbackIsTreatedAsLoopback() {
        requirePublicOriginAllowed("http://[::1]:3000", setOf("http://localhost"))
    }

    @Test
    fun aHostThatMerelyContainsLoopbackIsNotLoopback() {
        // Substring matching would exempt an attacker-controlled name.
        assertFailsWith<IllegalArgumentException> {
            requirePublicOriginAllowed("https://localhost.evil.example/user-api", setOf("https://workbench.lan"))
        }
    }
}
