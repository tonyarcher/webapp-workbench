package userapi.http

import kotlinx.serialization.Serializable

@Serializable
data class PasswordBody(val username: String, val password: String)

@Serializable
data class CsrfBody(val csrf: String)

@Serializable
data class MeBody(val id: String, val username: String, val totpEnabled: Boolean = false)

@Serializable
data class OkBody(val ok: Boolean)

@Serializable
data class TotpRequiredBody(val totpRequired: Boolean = true)

@Serializable
data class TotpBeginBody(val secret: String, val otpauth: String)

@Serializable
data class TotpConfirmBody(val code: String)

@Serializable
data class BackupCodesBody(val backupCodes: List<String>)
