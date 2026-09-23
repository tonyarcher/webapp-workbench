package rssapi.db

import org.flywaydb.core.Flyway
import javax.sql.DataSource

fun migrate(dataSource: DataSource) {
    Flyway.configure()
        .dataSource(dataSource)
        .baselineOnMigrate(true)
        .locations("classpath:db/migration")
        .load()
        .migrate()
}
