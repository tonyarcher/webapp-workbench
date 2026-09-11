package fitnessapi.http

import kotlinx.serialization.Serializable

@Serializable
data class HealthBody(val ok: Boolean)
