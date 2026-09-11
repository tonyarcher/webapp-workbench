package fitnessapi.http

import kotlinx.serialization.Serializable

@Serializable
data class ErrorBody(val error: String)
