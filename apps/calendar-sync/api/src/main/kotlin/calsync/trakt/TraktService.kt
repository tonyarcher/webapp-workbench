package calsync.trakt

import calsync.web.ApiException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

/** One device-poll outcome that is not a failure. */
data class DevicePollResult(val authorized: Boolean, val expiresAt: Instant?)

/**
 * Trakt protocol flows over stored vault credentials. The browser never sees
 * client secrets or tokens: it polls device codes and reads data, while this
 * service injects vault secrets into every Trakt call. Data reads refresh an
 * expired token once and retry before giving up, matching the client's old
 * refresh-and-retry rhythm. Storage itself lives in [TraktVaultService].
 */
@Service
class TraktService(private val vault: TraktVaultService, private val http: TraktHttp = JdkTraktHttp()) {
    fun deviceCode(userId: UUID): DeviceCodeTokens {
        val creds = vault.required(userId)
        val reply = traktCall {
            http.post(
                DEVICE_CODE_PATH,
                traktHeaders(creds.clientId, null),
                """{"client_id":"${creds.clientId}"}""",
            )
        }
        if (reply.status !in 200..299) throw ApiException(HttpStatus.BAD_GATEWAY, "trakt request failed")
        return parseDeviceCode(parseJsonBody(reply.body))
            ?: throw ApiException(HttpStatus.BAD_GATEWAY, "trakt response unreadable")
    }

    fun pollDeviceToken(userId: UUID, deviceCode: String): DevicePollResult {
        val creds = vault.required(userId)
        val code = checkedDeviceCode(deviceCode)
        val reply = traktCall {
            http.post(
                DEVICE_TOKEN_PATH,
                traktHeaders(creds.clientId, null),
                """{"code":"$code","client_id":"${creds.clientId}","client_secret":"${creds.clientSecret}"}""",
            )
        }
        return when (val poll = pollStatusOf(reply.status, parseJsonBody(reply.body))) {
            is DevicePoll.Token -> {
                val at = vault.storeTokens(creds, poll.tokens)
                DevicePollResult(authorized = true, expiresAt = at)
            }

            is DevicePoll.Pending -> DevicePollResult(authorized = false, expiresAt = null)

            is DevicePoll.Denied -> throw ApiException(HttpStatus.BAD_REQUEST, poll.error)

            is DevicePoll.Expired -> throw ApiException(HttpStatus.BAD_REQUEST, poll.error)
        }
    }

    fun refreshTokens(userId: UUID): Instant {
        val creds = vault.required(userId)
        val refreshToken = creds.refreshToken
        if (refreshToken.isNullOrBlank()) throw ApiException(HttpStatus.BAD_REQUEST, "trakt not authorized")
        val reply = traktCall {
            http.post(
                REFRESH_TOKEN_PATH,
                traktHeaders(creds.clientId, null),
                """{"grant_type":"refresh_token","refresh_token":"$refreshToken","client_id":"${creds.clientId}","client_secret":"${creds.clientSecret}"}""",
            )
        }
        val tokens = parseToken(parseJsonBody(reply.body))
        if (reply.status !in 200..299 || tokens == null) {
            if (reply.status in 400..499) vault.dropTokens(creds)
            throw ApiException(HttpStatus.BAD_GATEWAY, "trakt request failed")
        }
        return vault.storeTokens(creds, tokens)
    }

    fun proxiedGet(userId: UUID, path: String): String {
        val creds = vault.required(userId)
        val token = creds.accessToken
        if (token.isNullOrBlank() || creds.refreshToken.isNullOrBlank()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "trakt not authorized")
        }
        val first = traktCall { http.get(path, traktHeaders(creds.clientId, token)) }
        if (first.status != HttpStatus.UNAUTHORIZED.value()) return checkedBody(first)
        refreshTokens(userId)
        val retry = traktCall { http.get(path, traktHeaders(creds.clientId, vault.token(userId))) }
        if (retry.status == HttpStatus.UNAUTHORIZED.value()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "trakt authorization expired")
        }
        return checkedBody(retry)
    }

    /**
     * Transport failures become 502, never a bare 500: Trakt being
     * unreachable is a gateway problem, not an internal one. Only the HTTP
     * call sits inside; ApiException from validation stays untouched.
     */
    private fun <T> traktCall(block: () -> T): T = try {
        block()
    } catch (_: TraktTransportException) {
        throw ApiException(HttpStatus.BAD_GATEWAY, "trakt request failed")
    }

    private fun checkedDeviceCode(deviceCode: String): String = deviceCode.takeIf { it.isNotBlank() }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "device code is required")
}
