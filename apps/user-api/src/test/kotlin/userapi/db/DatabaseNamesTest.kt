package userapi.db

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DatabaseNamesTest {
    @Test
    fun quotesAllowListedName() {
        assertEquals("CREATE DATABASE \"" + "users" + "\"", createDatabaseSql("users"))
    }

    @Test
    fun rejectsInjection() {
        assertFailsWith<IllegalArgumentException> {
            createDatabaseSql("users\"; DROP TABLE users; --")
        }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("Users") }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("rss-reader") }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("") }
    }
}
