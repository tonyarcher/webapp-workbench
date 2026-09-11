package fitnessapi.web

import com.fasterxml.jackson.databind.JsonNode

fun JsonNode.string(key: String): String? {
    val n = this.get(key) ?: return null
    return if (n.isTextual) n.asText() else null
}

fun JsonNode.numberLike(key: String): Double? {
    val n = this.get(key) ?: return null
    val d = if (n.isTextual) n.asText().toDoubleOrNull() else if (n.isNumber) n.asDouble() else null
    return d?.takeIf { it.isFinite() }
}

fun JsonNode.jsonNumber(key: String): Double? {
    val n = this.get(key) ?: return null
    if (!n.isNumber) return null
    return n.asDouble()
}

fun JsonNode.bool(key: String): Boolean? {
    val n = this.get(key) ?: return null
    return if (n.isBoolean) n.asBoolean() else null
}
