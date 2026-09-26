package stockgame.db

import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.core.io.ClassPathResource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class MigrationResourceTest {
    @Test
    fun schemaMigrationIsOnClasspath() {
        val url =
            Thread
                .currentThread()
                .contextClassLoader
                .getResource("db/migration/V1__schema.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS trades"))
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS orders"))
    }

    @Test
    fun userMigrationIsOnClasspath() {
        val url =
            Thread
                .currentThread()
                .contextClassLoader
                .getResource("db/migration/V2__users.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS users"))
        assertTrue(sql.contains("local:legacy"))
        assertTrue(sql.contains("PRIMARY KEY (user_id, key)"))
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
}
