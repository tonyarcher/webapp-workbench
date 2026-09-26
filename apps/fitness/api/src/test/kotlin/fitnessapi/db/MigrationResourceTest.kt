package fitnessapi.db

import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.core.io.ClassPathResource
import kotlin.test.Test
import kotlin.test.assertEquals
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
        // Read the parsed property, not a line of the file, so this keeps
        // testing the setting rather than the syntax it happens to be written in.
        val properties = YamlPropertySourceLoader()
            .load("application", ClassPathResource("application.yml"))
            .first()
        assertEquals(true, properties.getProperty("spring.flyway.baseline-on-migrate"))
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
