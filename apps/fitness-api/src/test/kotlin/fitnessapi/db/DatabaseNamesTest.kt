package fitnessapi.db

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DatabaseNamesTest {
    @Test
    fun quotesAllowListedName() {
        assertEquals("CREATE DATABASE \"" + "fitness" + "\"", createDatabaseSql("fitness"))
    }

    @Test
    fun rejectsInjection() {
        assertFailsWith<IllegalArgumentException> {
            createDatabaseSql("fitness\"; DROP TABLE users; --")
        }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("Fitness") }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("rss-reader") }
        assertFailsWith<IllegalArgumentException> { requireDatabaseName("") }
    }
}
