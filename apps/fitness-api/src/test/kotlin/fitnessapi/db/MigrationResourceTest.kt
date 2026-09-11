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
    fun flywayBaselinesExistingSchema() {
        val url = Thread.currentThread().contextClassLoader.getResource("application.properties")
        assertNotNull(url)
        assertTrue(url.readText().contains("spring.flyway.baseline-on-migrate=true"))
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
