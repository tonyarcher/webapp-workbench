package calsync.web

data class TraktCredentialsBody(val clientId: String?, val clientSecret: String?)

data class TraktConfiguredJson(val configured: Boolean)

data class TraktStatusJson(val configured: Boolean, val authorized: Boolean, val expiresAt: Long?)

data class TraktDeviceCodeJson(
    val deviceCode: String,
    val userCode: String,
    val verificationUrl: String,
    val expiresIn: Long,
    val interval: Long,
)

data class DeviceTokenBody(val deviceCode: String?)

data class DeviceTokenJson(val authorized: Boolean, val expiresAt: Long?)

data class TraktRefreshJson(val ok: Boolean, val expiresAt: Long?)
