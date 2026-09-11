package userapi.http

import kotlinx.serialization.Serializable

@Serializable
data class HealthBody(val ok: Boolean)
