package stockgame.db

private val NAME = Regex("^[a-z][a-z0-9_]*$")

fun requireDatabaseName(name: String): String {
    require(NAME.matches(name)) { "refusing database name '$name'" }
    return name
}

fun createDatabaseSql(name: String): String {
    val safe = requireDatabaseName(name)
    return "CREATE DATABASE \"" + safe + "\""
}
