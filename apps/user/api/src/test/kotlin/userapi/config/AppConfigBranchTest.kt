package userapi.config

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import org.mockito.kotlin.mock
import userapi.accounts.OAuthStore

class AppConfigBranchTest {
    @Test
    fun settingsAndClock() {
        assertNotNull(AppConfig().settings())
        assertNotNull(AppConfig().clock())
    }

    @Test
    fun dataSourceRequiresUrl() {
        assertFailsWith<IllegalArgumentException> {
            AppConfig().dataSourceFromEnv(emptyMap())
        }
    }

    @Test
    fun dataSourceBadUrlFails() {
        assertFailsWith<Exception> {
            AppConfig().dataSourceFromEnv(mapOf("DATABASE_URL" to "postgres://localhost:1/nodb"))
        }
    }

    @Test
    fun jwtSignerBuilds() {
        val signer = AppConfig().jwtSigner(mock<OAuthStore>(), userapi.settingsFromEnv(emptyMap()))
        assertNotNull(signer)
    }
}
