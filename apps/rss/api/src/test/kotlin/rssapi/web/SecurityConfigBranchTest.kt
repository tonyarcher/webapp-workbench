package rssapi.web

import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SecurityConfigBranchTest {
    @Test
    fun decoderBuilds() {
        assertNotNull(SecurityConfig().jwtDecoder())
    }

    @Test
    fun audienceAccepted() {
        val token = Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .claim("aud", listOf("rss-reader"))
            .build()
        assertTrue(audienceValidator("rss-reader").validate(token).hasErrors().not())
    }

    @Test
    fun audienceRejected() {
        val token = Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .claim("aud", listOf("other"))
            .build()
        assertTrue(audienceValidator("rss-reader").validate(token).hasErrors())
        val nullAud = mock<Jwt>()
        whenever(nullAud.audience).thenReturn(null)
        assertTrue(audienceValidator("rss-reader").validate(nullAud).hasErrors())
    }
}
