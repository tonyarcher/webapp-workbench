package calsync.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import org.springframework.security.oauth2.jwt.Jwt
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SecurityConfigBranchTest {
    private fun envWith(value: String?): Environment {
        val env = mock<Environment>()
        whenever(env.getProperty("SWAGGER_ENABLED")).thenReturn(value)
        return env
    }

    @Test
    fun swaggerFlagTruthySet() {
        assertTrue(swaggerEnabledFromEnv(envWith("1")))
        assertTrue(swaggerEnabledFromEnv(envWith("true")))
        assertTrue(swaggerEnabledFromEnv(envWith("yes")))
        assertTrue(swaggerEnabledFromEnv(envWith("on")))
        assertTrue(swaggerEnabledFromEnv(envWith(" ON ")))
    }

    @Test
    fun swaggerFlagOff() {
        assertFalse(swaggerEnabledFromEnv(envWith(null)))
        assertFalse(swaggerEnabledFromEnv(envWith("")))
        assertFalse(swaggerEnabledFromEnv(envWith("0")))
        assertFalse(swaggerEnabledFromEnv(envWith("off")))
    }

    private fun jwtWithAud(audience: List<String>): Jwt = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .claim("sub", "u1")
        .claim("aud", audience)
        .build()

    @Test
    fun matchingAudienceSucceeds() {
        assertFalse(audienceValidator("calendar-sync").validate(jwtWithAud(listOf("calendar-sync"))).hasErrors())
    }

    @Test
    fun missingAudienceFails() {
        assertTrue(audienceValidator("calendar-sync").validate(jwtWithAud(listOf("other"))).hasErrors())
    }

    @Test
    fun absentAudienceFails() {
        val bare = Jwt.withTokenValue("tok").header("alg", "RS256").claim("sub", "u1").build()
        assertTrue(audienceValidator("calendar-sync").validate(bare).hasErrors())
    }

    private fun envWithProps(vararg pairs: Pair<String, String>): Environment {
        val env = mock<Environment>()
        val jwks = pairs.toMap()["OAUTH_JWKS_URI"] ?: "http://localhost:3004/oauth/jwks"
        val issuer = pairs.toMap()["OAUTH_ISSUER"] ?: "http://localhost/user-api"
        whenever(env.getRequiredProperty("OAUTH_JWKS_URI")).thenReturn(jwks)
        whenever(env.getRequiredProperty("OAUTH_ISSUER")).thenReturn(issuer)
        whenever(env.getProperty("CALENDAR_CLIENT_ID")).thenReturn(pairs.toMap()["CALENDAR_CLIENT_ID"])
        return env
    }

    @Test
    fun jwtDecoderBuilds() {
        val config = SecurityConfig(envWithProps())
        assertNotNull(config.jwtDecoder())
    }

    @Test
    fun jwtDecoderHonoursClientId() {
        val config = SecurityConfig(envWithProps("CALENDAR_CLIENT_ID" to "custom"))
        assertNotNull(config.jwtDecoder())
    }

    @Test
    fun jwksIndicatorBuilds() {
        val config = SecurityConfig(envWithProps())
        assertNotNull(config.jwksHealthIndicator())
    }
}
