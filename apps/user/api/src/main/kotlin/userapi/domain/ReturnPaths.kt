package userapi.domain

fun safeReturnPath(raw: String?): String? {
    if (raw.isNullOrBlank() || raw.length > 256) return null
    if (!raw.startsWith("/")) return null
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null
    if (raw.contains("://") || raw.contains('\\')) return null
    if (raw.any { it.isWhitespace() || it.code < 32 }) return null
    return raw
}
