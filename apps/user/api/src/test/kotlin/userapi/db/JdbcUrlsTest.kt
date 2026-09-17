package userapi.db

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class JdbcUrlsTest {
    @Test
    fun parsesPostgresUrl() {
        val t = parseDatabaseUrl("postgres://rss:s3cret@postgres:5432/users")
        assertEquals("jdbc:postgresql://postgres:5432/users", t.jdbcUrl)
        assertEquals("rss", t.user)
        assertEquals("s3cret", t.password)
        assertEquals("users", t.database)
        assertEquals("postgres", t.host)
        assertEquals(5432, t.port)
        assertEquals("jdbc:postgresql://postgres:5432/postgres", adminJdbcUrl(t))
        assertFalse("s3cret" in t.toString())
    }

    @Test
    fun parsesPostgresqlUrl() {
        val t = parseDatabaseUrl("postgresql://u:p@localhost:5432/users")
        assertEquals("jdbc:postgresql://localhost:5432/users", t.jdbcUrl)
        assertEquals("users", t.database)
        assertEquals("u", t.user)
    }

    @Test
    fun rejectsBadSchemeAndName() {
        assertFailsWith<IllegalStateException> { parseDatabaseUrl("mysql://localhost/users") }
        assertFailsWith<IllegalArgumentException> {
            parseDatabaseUrl("postgres://u:p@localhost:5432/bad-name")
        }
    }
}
