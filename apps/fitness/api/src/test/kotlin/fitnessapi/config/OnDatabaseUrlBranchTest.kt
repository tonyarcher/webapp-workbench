package fitnessapi.config

import org.mockito.kotlin.mock
import kotlin.test.Test
import kotlin.test.assertEquals

class OnDatabaseUrlBranchTest {
    @Test
    fun mirrorsEnv() {
        val expected = !System.getenv("DATABASE_URL").isNullOrBlank()
        assertEquals(expected, OnDatabaseUrl().matches(mock(), mock()))
    }
}
