package userapi.db

import org.flywaydb.core.Flyway
import javax.sql.DataSource

fun migrate(dataSource: DataSource) {
    Flyway.configure()
        .dataSource(dataSource)
        .locations("classpath:db/migration")
        .load()
        .migrate()
}
