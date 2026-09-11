package userapi.domain

private val USERNAME = Regex("^[a-z][a-z0-9_]{2,31}$")

fun normalizeUsername(raw: String): String = raw.trim().lowercase()

fun validUsername(raw: String): String? {
    val name = normalizeUsername(raw)
    return if (USERNAME.matches(name)) name else null
}
