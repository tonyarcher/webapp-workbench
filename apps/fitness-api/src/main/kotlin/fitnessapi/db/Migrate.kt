package fitnessapi.db

import javax.sql.DataSource
import org.flywaydb.core.Flyway

fun migrate(dataSource: DataSource) {
    Flyway.configure()
        .dataSource(dataSource)
        .baselineOnMigrate(true)
        .locations("classpath:db/migration")
        .load()
        .migrate()
}
