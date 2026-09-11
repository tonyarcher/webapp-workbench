package userapi.domain

fun parseOrigins(raw: String): Set<String> {
    return raw.split(',')
        .map { it.trim() }
        .filter { it.startsWith("http://") || it.startsWith("https://") }
        .toSet()
}

fun validRpId(raw: String): String {
    val id = raw.trim().lowercase()
    require(id.isNotEmpty() && ' ' !in id && '/' !in id && ':' !in id) { "invalid rp id" }
    return id
}
