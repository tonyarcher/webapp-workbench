package userapi.config
import org.mockito.kotlin.mock
import userapi.accounts.OAuthStore
import userapi.requiredEnv
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class AppConfigBranchTest {
    @Test
    fun settingsAndClock() {
        assertNotNull(AppConfig().settingsFor(requiredEnv()))
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
        val signer = AppConfig().jwtSigner(mock<OAuthStore>(), userapi.settingsFromEnv(requiredEnv() + emptyMap()))
        assertNotNull(signer)
    }
}
