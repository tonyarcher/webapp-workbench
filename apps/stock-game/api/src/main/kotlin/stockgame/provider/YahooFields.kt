package stockgame.provider

import com.fasterxml.jackson.databind.JsonNode

internal fun textOr(node: JsonNode, field: String): String? {
    val v = node.path(field)
    if (!v.isTextual) return null
    val t = v.asText()
    return t.ifEmpty { null }
}

internal fun numOrNull(node: JsonNode, field: String): Double? {
    val v = node.path(field)
    return if (v.isNumber) v.asDouble() else null
}
