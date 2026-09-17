package fitnessapi.config

import kotlin.test.Test
import kotlin.test.assertNotNull

class ClockConfigBranchTest {
    @Test
    fun clockBean() {
        assertNotNull(ClockConfig().clock())
    }
}
