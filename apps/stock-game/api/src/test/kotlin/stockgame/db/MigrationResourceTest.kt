package stockgame.db

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
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS trades"))
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS orders"))
    }

    @Test
    fun userMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V2__users.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS users"))
        assertTrue(sql.contains("local:legacy"))
        assertTrue(sql.contains("PRIMARY KEY (user_id, key)"))
    }

    @Test
    fun flywayBaselinesExistingSchema() {
        val url = Thread.currentThread().contextClassLoader.getResource("application.properties")
        assertNotNull(url)
        assertTrue(url.readText().contains("spring.flyway.baseline-on-migrate=true"))
    }
}
