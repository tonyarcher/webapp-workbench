package fitnessapi.http

import kotlinx.serialization.json.Json

val API_JSON = Json {
    encodeDefaults = true
    ignoreUnknownKeys = true
    explicitNulls = true
}
