package userapi.http

import kotlinx.serialization.Serializable

@Serializable
data class PasswordBody(val username: String, val password: String)

@Serializable
data class CsrfBody(val csrf: String)

@Serializable
data class MeBody(val id: String, val username: String)

@Serializable
data class OkBody(val ok: Boolean)
