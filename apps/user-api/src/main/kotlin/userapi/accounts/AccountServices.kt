package userapi.accounts

import java.time.Clock
import userapi.crypto.Argon2Hasher
import userapi.crypto.Rfc6238Totp
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
