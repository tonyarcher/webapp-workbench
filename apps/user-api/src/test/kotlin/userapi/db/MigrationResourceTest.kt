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

    @Test
    fun totpMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V3__totp.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("totp_secret"))
        assertTrue(sql.contains("backup_codes"))
    }

    @Test
    fun passkeyMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V4__passkeys.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("CREATE TABLE passkeys"))
    }

    @Test
    fun oauthMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V5__oauth.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("oauth_auth_codes"))
    }

    @Test
    fun oauthClientsMigrationIsOnClasspath() {
        val url = Thread.currentThread().contextClassLoader
            .getResource("db/migration/V6__oauth_clients.sql")
        assertNotNull(url)
        val sql = url.readText()
        assertTrue(sql.contains("oauth_clients"))
        assertTrue(sql.contains("oauth_redirect_uris"))
    }
}
