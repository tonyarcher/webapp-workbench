package userapi.db

import org.flywaydb.core.Flyway
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet
import kotlin.test.assertNotNull

/** Shared Postgres access for migration tests run by the integration profile. */
internal object PostgresMigration {
    const val SCHEMA = "times_up_client_migration_test"
    private const val DB_URL = "userapi.test.db.url"
    private const val DB_USER = "userapi.test.db.user"
    private const val DB_PASSWORD = "userapi.test.db.password"

    fun <T> withSchema(block: () -> T): T {
        execute("DROP SCHEMA IF EXISTS $SCHEMA CASCADE")
        try {
            return block()
        } finally {
            execute("DROP SCHEMA IF EXISTS $SCHEMA CASCADE")
        }
    }

    fun migrate(target: String) {
        Flyway.configure()
            .dataSource(databaseUrl(), databaseUser(), databasePassword())
            .schemas(SCHEMA)
            .defaultSchema(SCHEMA)
            .locations("classpath:db/migration")
            .target(target)
            .load()
            .migrate()
    }

    fun execute(sql: String) {
        connect().use { it.createStatement().use { statement -> statement.execute(sql) } }
    }

    fun <T> query(sql: String, map: (ResultSet) -> T): List<T> = connect().use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { result ->
                buildList {
                    while (result.next()) add(map(result))
                }
            }
        }
    }

    fun count(sql: String): Int = query(sql) { it.getInt(1) }.single()

    private fun connect(): Connection =
        DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword()).apply {
            createStatement().use { it.execute("SET search_path TO $SCHEMA, public") }
        }

    private fun databaseUrl(): String = requireNotNull(System.getProperty(DB_URL)) {
        "$DB_URL not set; run through Gradle with -Pintegration=true"
    }

    private fun databaseUser(): String = assertNotNull(System.getProperty(DB_USER))
    private fun databasePassword(): String = assertNotNull(System.getProperty(DB_PASSWORD))
}
