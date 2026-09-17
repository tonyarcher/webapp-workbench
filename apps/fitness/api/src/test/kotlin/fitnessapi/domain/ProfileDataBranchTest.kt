package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProfileDataBranchTest {
    @Test
    fun emptyDefaults() {
        val p = emptyProfile()
        assertNull(p.sex)
        assertEquals("kg", p.displayUnit)
    }

    @Test
    fun parseVariants() {
        val male = parseProfile("male", 1990.0, 1.8, "lb", 100.0, 80.0, 120.0, 60.0)
        assertEquals("male", male.sex)
        assertEquals(1990, male.birthYear)
        assertEquals("lb", male.displayUnit)
        val other = parseProfile("other", null, null, "stone", null, null, null, null)
        assertNull(other.sex)
        assertNull(other.birthYear)
        assertEquals("kg", other.displayUnit)
        val none = parseProfile(null, null, null, null, null, null, null, null)
        assertNull(none.sex)
    }
}
