package stockgame.config

import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.mock

class OnDatabaseUrlBranchTest {
    @Test
    fun mirrorsEnv() {
        val expected = !System.getenv("DATABASE_URL").isNullOrBlank()
        assertEquals(expected, OnDatabaseUrl().matches(mock(), mock()))
    }
}
