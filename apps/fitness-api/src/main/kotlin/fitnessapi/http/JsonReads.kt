package fitnessapi.http

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

fun JsonObject.string(key: String): String? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    return if (primitive.isString) primitive.content else null
}

fun JsonObject.numberLike(key: String): Double? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    val n = if (primitive.isString) primitive.content.toDoubleOrNull() else primitive.doubleOrNull
    return n?.takeIf { it.isFinite() }
}

fun JsonObject.jsonNumber(key: String): Double? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    if (primitive.isString) return null
    return primitive.doubleOrNull
}

fun JsonObject.bool(key: String): Boolean? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    return primitive.booleanOrNull
}
