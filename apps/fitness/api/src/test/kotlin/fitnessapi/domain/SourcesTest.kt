package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class SourcesTest {
    @Test
    fun allowListOrCsv() {
        assertEquals("manual", sampleSource("manual"))
        assertEquals("health-connect-db", sampleSource("health-connect-db"))
        assertEquals("csv", sampleSource("unknown"))
        assertEquals("csv", sampleSource(null))
    }
}
