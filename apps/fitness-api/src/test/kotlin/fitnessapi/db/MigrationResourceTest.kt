package fitnessapi.db

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class MigrationResourceTest {
    @Test
    fun schemaMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V1__schema.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS samples"))
        assertTrue(sql.contains("00000000-0000-4000-8000-000000000001"))
    }

    @Test
    fun migrateBaselinesExistingSchema() {
        val src = java.io.File("src/main/kotlin/fitnessapi/db/Migrate.kt").readText()
        assertTrue(src.contains(".baselineOnMigrate(true)"))
    }

    @Test
    fun energyTotalMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V2__energy_total.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("energy_total"))
    }
}
