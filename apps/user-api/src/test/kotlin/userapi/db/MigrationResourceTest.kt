package userapi.db

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class MigrationResourceTest {
    @Test
    fun phase0MigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V1__pgcrypto.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
    }

    @Test
    fun accountsMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V2__accounts.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE users"))
        assertTrue(sql.contains("CREATE TABLE sessions"))
    }
}
