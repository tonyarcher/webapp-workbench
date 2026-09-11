package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProfilesTest {
    @Test
    fun normalizesSexAndUnit() {
        val p = parseProfile("male", 1988.0, 1.8, "lb", 160.0, 100.0, 180.0, 70.0)
        assertEquals("male", p.sex)
        assertEquals(1988, p.birthYear)
        assertEquals("lb", p.displayUnit)
        assertEquals(160.0, p.tmSquat)
        val other = parseProfile("nope", null, null, "stone", null, null, null, null)
        assertNull(other.sex)
        assertEquals("kg", other.displayUnit)
    }
}
