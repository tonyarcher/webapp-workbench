package userapi.web

import com.fasterxml.jackson.annotation.JsonProperty
import tools.jackson.databind.JsonNode

data class PasswordBody(val username: String, val password: String)

data class CsrfBody(val csrf: String)

data class MeBody(
    val id: String,
    val username: String,
    val totpEnabled: Boolean = false,
    val passkeyCount: Int = 0,
)

data class OkBody(val ok: Boolean)

data class TotpRequiredBody(val totpRequired: Boolean = true)

data class TotpBeginBody(val secret: String, val otpauth: String)

data class TotpConfirmBody(val code: String)

data class BackupCodesBody(val backupCodes: List<String>)

data class PasskeyBeginBody(val requestId: String, val options: JsonNode)

data class PasskeyFinishBody(val requestId: String, val credential: JsonNode)

data class HealthBody(val ok: Boolean)

data class ErrBody(val err: ErrDetail)

data class ErrDetail(val type: String, val message: String)

data class OAuthErrorBody(val error: String)

data class TokenResponseBody(
    @param:JsonProperty("access_token") val accessToken: String,
    @param:JsonProperty("token_type") val tokenType: String = "Bearer",
    @param:JsonProperty("expires_in") val expiresIn: Int,
    @param:JsonProperty("refresh_token") val refreshToken: String,
)
