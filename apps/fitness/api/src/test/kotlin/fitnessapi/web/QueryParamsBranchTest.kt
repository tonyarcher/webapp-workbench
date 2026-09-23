package fitnessapi.web

import fitnessapi.store.ProfileStore
import fitnessapi.store.SampleStore
import org.mockito.kotlin.mock
import org.springframework.beans.factory.ObjectProvider
import java.time.Clock
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class QueryParamsBranchTest {
    @Test
    fun ranges() {
        val clock = Clock.systemUTC()
        val (from, to) = queryRange("1000", "2000", clock)
        assertEquals(1000L, from)
        assertEquals(2000L, to)
        val (dFrom, _) = queryRange(null, null, clock)
        assertEquals(0L, dFrom)
        val (bad, _) = queryRange("abc", null, clock)
        assertEquals(0L, bad)
    }

    @Test
    fun limits() {
        assertEquals(10, limitParam("10"))
        assertEquals(2_000, limitParam(null))
        assertEquals(2_000, limitParam("abc"))
    }

    @Test
    fun offlineThrows() {
        val empty = mock<ObjectProvider<SampleStore>>()
        assertFailsWith<ApiException> { empty.orOffline() }
        val emptyProfile = mock<ObjectProvider<ProfileStore>>()
        assertFailsWith<ApiException> { emptyProfile.orOffline() }
    }
}
