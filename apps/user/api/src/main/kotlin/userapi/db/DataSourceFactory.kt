package userapi.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource

/** Connection pool sizing for a single-tenant API. */
private const val MAXIMUM_POOL_SIZE = 10

fun dataSource(databaseUrl: String): HikariDataSource {
    val target = parseDatabaseUrl(databaseUrl)
    val cfg = HikariConfig()
    cfg.jdbcUrl = target.jdbcUrl
    cfg.username = target.user
    cfg.password = target.password
    cfg.maximumPoolSize = MAXIMUM_POOL_SIZE
    cfg.poolName = "user-api"
    return HikariDataSource(cfg)
}
