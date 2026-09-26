package stockgame.web

import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.mock.env.MockEnvironment
import org.springframework.security.oauth2.jwt.Jwt
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SecurityConfigBranchTest {
    @Test
    fun decoderBuilds() {
        val env = MockEnvironment()
            .withProperty("OAUTH_JWKS_URI", "http://localhost:3004/oauth/jwks")
            .withProperty("OAUTH_ISSUER", "http://localhost/user-api")
        assertNotNull(SecurityConfig(env).jwtDecoder())
    }

    @Test
    fun audienceAccepted() {
        val token =
            Jwt
                .withTokenValue("tok")
                .header("alg", "RS256")
                .claim("aud", listOf("stock-game"))
                .build()
        assertTrue(audienceValidator("stock-game").validate(token).hasErrors().not())
    }

    @Test
    fun audienceRejected() {
        val token =
            Jwt
                .withTokenValue("tok")
                .header("alg", "RS256")
                .claim("aud", listOf("other"))
                .build()
        assertTrue(audienceValidator("stock-game").validate(token).hasErrors())
        val nullAud = mock<Jwt>()
        whenever(nullAud.audience).thenReturn(null)
        assertTrue(audienceValidator("stock-game").validate(nullAud).hasErrors())
    }
}
