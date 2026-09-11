package rssapi.db

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

class JdbcTarget(
    val jdbcUrl: String,
    val user: String,
    val password: String,
    val database: String,
    val host: String,
    val port: Int,
) {
    override fun toString(): String =
        "JdbcTarget(jdbcUrl=$jdbcUrl, user=$user, database=$database, host=$host, port=$port)"
}

fun parseDatabaseUrl(raw: String): JdbcTarget {
    val uri = URI(normalizeScheme(raw))
    val host = uri.host ?: error("database URL missing host")
    val port = if (uri.port == -1) 5432 else uri.port
    val database = requireDatabaseName(uri.path.trimStart('/'))
    val (user, password) = userInfo(uri.userInfo)
    return JdbcTarget("jdbc:postgresql://$host:$port/$database", user, password, database, host, port)
}

fun adminJdbcUrl(target: JdbcTarget): String =
    "jdbc:postgresql://${target.host}:${target.port}/postgres"

private fun normalizeScheme(raw: String): String {
    return when {
        raw.startsWith("jdbc:postgresql://") -> raw.removePrefix("jdbc:")
        raw.startsWith("postgresql://") -> raw
        raw.startsWith("postgres://") -> "postgresql://" + raw.removePrefix("postgres://")
        else -> error("unsupported database URL scheme")
    }
}

private fun userInfo(userInfo: String?): Pair<String, String> {
    if (userInfo.isNullOrBlank()) error("database URL missing user")
    val segs = userInfo.split(":", limit = 2)
    val charset = StandardCharsets.UTF_8
    val user = URLDecoder.decode(segs[0], charset)
    val password = URLDecoder.decode(segs.getOrElse(1) { "" }, charset)
    return user to password
}
