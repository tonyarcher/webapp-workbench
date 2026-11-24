package userapi.db

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Exercises V18 against Postgres, including an existing refresh-token family. */
class TimesUpClientMigrationPostgresTest {
    @Test
    fun renamePreservesOriginsAndRefreshSessions() {
        PostgresMigration.withSchema {
            PostgresMigration.migrate("17")
            seedLegacyClient()
            PostgresMigration.migrate("18")
            assertRenamedClient()
            assertRefreshSessionMigrated()
        }
    }

    private fun seedLegacyClient() {
        PostgresMigration.execute(
            "INSERT INTO ${PostgresMigration.SCHEMA}.oauth_redirect_uris (client_id, redirect_uri) VALUES " +
                "('rss-reader', 'https://workbench.lan/rss-reader/'), " +
                "('rss-reader', 'https://assets.example/rss-reader/'), " +
                "('rss-reader', 'https://custom.example/callback') " +
                "ON CONFLICT DO NOTHING",
        )
        PostgresMigration.execute(
            "INSERT INTO ${PostgresMigration.SCHEMA}.users (id, username, password_hash) " +
                "VALUES ('$USER_ID', 'reader', 'unused')",
        )
        PostgresMigration.execute(
            "INSERT INTO ${PostgresMigration.SCHEMA}.oauth_refresh_tokens " +
                "(token_hash, family_id, user_id, client_id, expires_at, revoked) " +
                "VALUES ('legacy-refresh', '$FAMILY_ID', '$USER_ID', 'rss-reader', " +
                "now() + interval '1 day', false)",
        )
    }

    private fun assertRenamedClient() {
        assertRedirects()
        assertCount(
            "SELECT count(*) FROM ${PostgresMigration.SCHEMA}.oauth_clients WHERE client_id = 'rss-reader'",
            0,
        )
        assertCount(
            "SELECT count(*) FROM ${PostgresMigration.SCHEMA}.oauth_redirect_uris WHERE client_id = 'rss-reader'",
            0,
        )
        assertTrue(
            PostgresMigration.count(
                "SELECT count(*) FROM ${PostgresMigration.SCHEMA}.oauth_clients WHERE client_id = 'fitness'",
            ) == 1,
        )
    }

    private fun assertRedirects() {
        val redirects = PostgresMigration.query(
            "SELECT redirect_uri FROM ${PostgresMigration.SCHEMA}.oauth_redirect_uris " +
                "WHERE client_id = 'times-up' ORDER BY redirect_uri",
        ) { it.getString("redirect_uri") }
        assertEquals(
            listOf(
                "http://127.0.0.1/times-up/",
                "http://localhost/times-up/",
                "https://assets.example/times-up/",
                "https://custom.example/callback",
                "https://workbench.lan/times-up/",
            ),
            redirects,
        )
    }

    private fun assertCount(sql: String, expected: Int) {
        assertEquals(expected, PostgresMigration.count(sql))
    }

    private fun assertRefreshSessionMigrated() {
        val row = PostgresMigration.query(
            "SELECT client_id, token_hash, family_id, revoked FROM ${PostgresMigration.SCHEMA}.oauth_refresh_tokens " +
                "WHERE token_hash = 'legacy-refresh'",
        ) {
            RefreshSession(
                it.getString("client_id"),
                it.getString("token_hash"),
                it.getString("family_id"),
                it.getBoolean("revoked"),
            )
        }.single()
        assertEquals("times-up", row.clientId)
        assertEquals("legacy-refresh", row.tokenHash)
        assertEquals(FAMILY_ID.toString(), row.familyId)
        assertFalse(row.revoked)
    }

    private data class RefreshSession(
        val clientId: String,
        val tokenHash: String,
        val familyId: String,
        val revoked: Boolean,
    )

    companion object {
        private val USER_ID: UUID = UUID.fromString("00000000-0000-0000-0000-000000000001")
        private val FAMILY_ID: UUID = UUID.fromString("00000000-0000-0000-0000-000000000002")
    }
}
