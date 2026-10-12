package calsync.trakt

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper

/** Canonical activation URL; an untrusted verification_url falls back to this. */
const val TRAKT_VERIFICATION_URL = "https://trakt.tv/activate"

private val MAPPER = ObjectMapper()

fun parseJsonBody(raw: String): JsonNode? = try {
    MAPPER.readTree(raw)
} catch (_: Exception) {
    null
}

private fun text(node: JsonNode, field: String): String? =
    node.path(field).takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }

private fun wholeNumber(node: JsonNode, field: String): Long? = node.path(field).takeIf { it.isNumber }?.asLong()

data class DeviceCodeTokens(
    val deviceCode: String,
    val userCode: String,
    val verificationUrl: String,
    val expiresIn: Long,
    val interval: Long,
)

data class TraktTokens(val accessToken: String, val refreshToken: String, val expiresIn: Long)

/** Only a Trakt-hosted https URL; anything else falls back to the canonical page. */
fun safeVerificationUrl(value: String?): String {
    if (value != null) {
        try {
            val url = java.net.URI(value)
            val host = url.host ?: ""
            if (url.scheme == "https" && (host == "trakt.tv" || host.endsWith(".trakt.tv"))) return value
        } catch (_: Exception) {
            // fall through to the safe constant
        }
    }
    return TRAKT_VERIFICATION_URL
}

fun parseDeviceCode(json: JsonNode?): DeviceCodeTokens? {
    if (json == null || !json.isObject) return null
    val deviceCode = text(json, "device_code") ?: return null
    val userCode = text(json, "user_code") ?: return null
    val expiresIn = wholeNumber(json, "expires_in") ?: return null
    val interval = wholeNumber(json, "interval") ?: return null
    return DeviceCodeTokens(
        deviceCode,
        userCode,
        safeVerificationUrl(text(json, "verification_url")),
        expiresIn,
        interval,
    )
}

fun parseToken(json: JsonNode?): TraktTokens? {
    if (json == null || !json.isObject) return null
    val accessToken = text(json, "access_token") ?: return null
    val refreshToken = text(json, "refresh_token") ?: return null
    val expiresIn = wholeNumber(json, "expires_in") ?: return null
    return TraktTokens(accessToken, refreshToken, expiresIn)
}

/** One device-poll outcome. Pending and slow-down both mean: keep polling. */
sealed interface DevicePoll {
    data object Pending : DevicePoll
    data class Token(val tokens: TraktTokens) : DevicePoll
    data class Denied(val error: String) : DevicePoll
    data class Expired(val error: String) : DevicePoll
}

fun pollStatusOf(httpStatus: Int, json: JsonNode?): DevicePoll {
    parseToken(json)?.let { return DevicePoll.Token(it) }
    val error = json?.takeIf { it.isObject }?.let { text(it, "error") }
    if (error == "slow_down" || httpStatus == HTTP_TOO_MANY_REQUESTS) return DevicePoll.Pending
    if (error == "access_denied" || error == "denied") return DevicePoll.Denied("Trakt access denied")
    if (error == "expired_token" || error == "expired") return DevicePoll.Expired("Trakt device code expired")
    return DevicePoll.Pending
}
