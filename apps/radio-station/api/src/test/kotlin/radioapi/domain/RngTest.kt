package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class RngTest {
    @Test
    fun autumnOakMatchesNode() {
        assertEquals(-2_045_378_864, hashSeed("autumn-oak"))
        val rng = Rng("autumn-oak")
        assertEquals(0.05574787757359445, rng.next(), 1e-12)
        assertEquals(0.6909931187983602, rng.next(), 1e-12)
    }
}
