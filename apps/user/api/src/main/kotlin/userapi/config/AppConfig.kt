package userapi.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.accounts.JpaAccountStore
import userapi.accounts.JpaChallengeStore
import userapi.accounts.JpaOAuthStore
import userapi.accounts.JpaPasskeyStore
import userapi.accounts.JpaTotpStore
import userapi.accounts.OAuthService
import userapi.accounts.OAuthStore
import userapi.accounts.PasskeyService
import userapi.accounts.PasskeyStore
import userapi.accounts.TotpStore
import userapi.accounts.WebauthnChallengeStore
import userapi.accounts.buildRelyingParty
import userapi.crypto.Argon2Hasher
import userapi.crypto.JwtSigner
import userapi.crypto.Rfc6238Totp
import userapi.db.dataSource
import userapi.db.ensureDatabase
import userapi.http.RateLimiter
import userapi.persist.AuthCodeRepo
import userapi.persist.BackupCodeRepo
import userapi.persist.LoginChallengeRepo
import userapi.persist.OAuthClientRepo
import userapi.persist.PasskeyRepo
import userapi.persist.RedirectUriRepo
import userapi.persist.RefreshTokenRepo
import userapi.persist.SessionRepo
import userapi.persist.SigningKeyRepo
import userapi.persist.UserRepo
import userapi.persist.WebauthnChallengeRepo
import userapi.settingsFromEnv
import java.time.Clock
import javax.sql.DataSource

@Configuration
class AppConfig {
    @Bean
    fun settings(): Settings = settingsFromEnv(System.getenv())

    @Bean
    fun clock(): Clock = Clock.systemUTC()

    @Bean
    fun dataSource(): DataSource = dataSourceFromEnv(System.getenv())

    internal fun dataSourceFromEnv(env: Map<String, String>): DataSource {
        val url = env["DATABASE_URL"].orEmpty()
        require(url.isNotBlank()) { "DATABASE_URL required" }
        ensureDatabase(url)
        return dataSource(url)
    }

    @Bean
    fun jwtSigner(oauthStore: OAuthStore, settings: Settings): JwtSigner = JwtSigner(oauthStore, settings.issuer)
}

@Configuration
class StoreConfig {
    @Bean
    fun accountStore(userRepo: UserRepo, sessionRepo: SessionRepo): AccountStore =
        JpaAccountStore(userRepo, sessionRepo)

    @Bean
    fun totpStore(userRepo: UserRepo, challengeRepo: LoginChallengeRepo, backupRepo: BackupCodeRepo): TotpStore =
        JpaTotpStore(userRepo, challengeRepo, backupRepo)

    @Bean
    fun passkeyStore(passkeyRepo: PasskeyRepo, userRepo: UserRepo): PasskeyStore =
        JpaPasskeyStore(passkeyRepo, userRepo)

    @Bean
    fun challengeStore(challengeRepo: WebauthnChallengeRepo): WebauthnChallengeStore = JpaChallengeStore(challengeRepo)

    @Bean
    fun oauthStore(
        clientRepo: OAuthClientRepo,
        redirectRepo: RedirectUriRepo,
        keyRepo: SigningKeyRepo,
        codeRepo: AuthCodeRepo,
        refreshRepo: RefreshTokenRepo,
    ): OAuthStore = JpaOAuthStore(clientRepo, redirectRepo, keyRepo, codeRepo, refreshRepo)

    @Bean
    fun passkeyService(
        passkeyStore: PasskeyStore,
        challengeStore: WebauthnChallengeStore,
        settings: Settings,
        clock: Clock,
    ): PasskeyService = PasskeyService(buildRelyingParty(settings, passkeyStore), passkeyStore, challengeStore, clock)

    @Bean
    fun oauthService(oauthStore: OAuthStore, signer: JwtSigner, clock: Clock): OAuthService =
        OAuthService(oauthStore, signer, clock)

    @Bean
    fun accountServices(
        accountStore: AccountStore,
        totpStore: TotpStore,
        passkeyService: PasskeyService,
        oauthService: OAuthService,
        clock: Clock,
    ): AccountServices = AccountServices(
        store = accountStore,
        hasher = Argon2Hasher(),
        limiter = RateLimiter(),
        clock = clock,
        totpStore = totpStore,
        totp = Rfc6238Totp(),
        passkeys = passkeyService,
        oauth = oauthService,
    )
}
