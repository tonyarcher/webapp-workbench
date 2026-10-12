package calsync.web

import calsync.trakt.TraktService
import calsync.trakt.TraktVaultService
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

private fun Instant.epochMs(): Long = toEpochMilli()

/**
 * Trakt credential vault and OAuth device flow. Secrets never leave the
 * server except to api.trakt.tv: every response below carries status and
 * metadata only. The browser keeps polling device/token until authorized.
 */
@RestController
class TraktController(
    private val user: IdentityUser,
    private val vault: TraktVaultService,
    private val trakt: TraktService,
) {
    @PostMapping("/trakt/credentials", headers = ["X-Api-Version=1"])
    fun saveCredentials(@RequestBody body: TraktCredentialsBody): TraktConfiguredJson {
        vault.saveCredentials(user.id, body.clientId.orEmpty(), body.clientSecret.orEmpty())
        return TraktConfiguredJson(configured = true)
    }

    @GetMapping("/trakt/credentials", headers = ["X-Api-Version=1"])
    fun credentialStatus(): TraktStatusJson {
        val status = vault.status(user.id)
        return TraktStatusJson(status.configured, status.authorized, status.expiresAt?.epochMs())
    }

    @DeleteMapping("/trakt/credentials", headers = ["X-Api-Version=1"])
    fun clearCredentials(): TraktConfiguredJson {
        vault.clear(user.id)
        return TraktConfiguredJson(configured = false)
    }

    @PostMapping("/trakt/device/code", headers = ["X-Api-Version=1"])
    fun deviceCode(): TraktDeviceCodeJson {
        val code = trakt.deviceCode(user.id)
        return TraktDeviceCodeJson(code.deviceCode, code.userCode, code.verificationUrl, code.expiresIn, code.interval)
    }

    @PostMapping("/trakt/device/token", headers = ["X-Api-Version=1"])
    fun deviceToken(@RequestBody body: DeviceTokenBody): DeviceTokenJson {
        val poll = trakt.pollDeviceToken(user.id, body.deviceCode.orEmpty())
        return DeviceTokenJson(poll.authorized, poll.expiresAt?.epochMs())
    }

    @PostMapping("/trakt/token/refresh", headers = ["X-Api-Version=1"])
    fun refreshToken(): TraktRefreshJson {
        val expiresAt = trakt.refreshTokens(user.id)
        return TraktRefreshJson(ok = true, expiresAt = expiresAt.epochMs())
    }
}
