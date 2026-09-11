package userapi.accounts

import java.time.Clock
import javax.sql.DataSource
import userapi.Settings
import userapi.crypto.Argon2Hasher
import userapi.crypto.JwtSigner
import userapi.crypto.Rfc6238Totp
import userapi.domain.defaultOAuthClients
import userapi.domain.PasswordHasher
import userapi.domain.TotpEngine
import userapi.http.RateLimiter

data class AccountServices(
    val store: AccountStore?,
    val hasher: PasswordHasher,
    val limiter: RateLimiter,
    val clock: Clock,
    val totpStore: TotpStore? = null,
    val totp: TotpEngine = Rfc6238Totp(),
    val passkeys: PasskeyService? = null,
    val oauth: OAuthService? = null,
) {
    val dummyHash: String by lazy { hasher.hash("not-a-real-password") }
}

fun productionAccounts(dataSource: DataSource?, settings: Settings): AccountServices {
    val clock = Clock.systemUTC()
    return AccountServices(
        store = dataSource?.let { JdbcAccountStore(it) },
        hasher = Argon2Hasher(),
        limiter = RateLimiter(),
        clock = clock,
        totpStore = dataSource?.let { JdbcTotpStore(it) },
        totp = Rfc6238Totp(),
        passkeys = productionPasskeys(dataSource, settings, clock),
        oauth = productionOauth(dataSource, settings, clock),
    )
}

private fun productionPasskeys(
    dataSource: DataSource?,
    settings: Settings,
    clock: Clock,
): PasskeyService? {
    val store = dataSource?.let { JdbcPasskeyStore(it) } ?: return null
    return PasskeyService(buildRelyingParty(settings, store), store, JdbcChallengeStore(dataSource), clock)
}

private fun productionOauth(
    dataSource: DataSource?,
    settings: Settings,
    clock: Clock,
): OAuthService? {
    val store = dataSource?.let { JdbcOAuthStore(it) } ?: return null
    val clients = defaultOAuthClients(settings.origins)
    return OAuthService(store, clients, JwtSigner(store, settings.issuer), clock)
}
