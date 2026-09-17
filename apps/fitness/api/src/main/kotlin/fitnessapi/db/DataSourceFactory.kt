package fitnessapi.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource

fun dataSource(databaseUrl: String): HikariDataSource {
    val target = parseDatabaseUrl(databaseUrl)
    val cfg = HikariConfig()
    cfg.jdbcUrl = target.jdbcUrl
    cfg.username = target.user
    cfg.password = target.password
    cfg.maximumPoolSize = 10
    cfg.poolName = "fitness-api"
    return HikariDataSource(cfg)
}
