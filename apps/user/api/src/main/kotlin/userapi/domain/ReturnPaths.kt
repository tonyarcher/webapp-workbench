package userapi.domain

/** Return paths stay short and printable: no control chars, no long URLs. */
private const val MAX_RETURN_PATH_CHARS = 256
private const val MAX_CONTROL_CODE = 31

fun safeReturnPath(raw: String?): String? {
    if (raw.isNullOrBlank() || raw.length > MAX_RETURN_PATH_CHARS) return null
    if (!raw.startsWith("/")) return null
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null
    if (raw.contains("://") || raw.contains('\\')) return null
    if (raw.any { it.isWhitespace() || it.code <= MAX_CONTROL_CODE }) return null
    return raw
}
