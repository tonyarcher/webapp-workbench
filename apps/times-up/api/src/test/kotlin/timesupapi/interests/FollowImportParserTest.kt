package timesupapi.interests

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class FollowImportParserTest {
    @Test
    fun parseDedupesAndCounts() {
        val (report, labels) = FollowImportParser.parse("grid storage\nGrid Storage\n\njunk line that is fine")
        assertEquals(3, report.count)
        assertEquals(2, report.unique)
        assertEquals(1, report.duplicates)
        assertEquals(2, labels.size)
    }

    @Test
    fun parseQuarantinesJunk() {
        val (report, _) = FollowImportParser.parse("https://example.com/feed\ngrid storage")
        assertEquals(1, report.quarantined)
        assertTrue(report.quarantinedLabels.contains("https://example.com/feed"))
    }

    @Test
    fun parseQuarantinesHttp() {
        val (report, _) = FollowImportParser.parse("http://example.com/feed\ngrid storage")
        assertEquals(1, report.quarantined)
    }

    @Test
    fun parseQuarantinesLongLine() {
        val long = "a".repeat(250)
        val (report, _) = FollowImportParser.parse("$long\ngrid storage")
        assertEquals(1, report.quarantined)
    }

    @Test
    fun parseQuarantinesAllDigits() {
        val (report, _) = FollowImportParser.parse("12345\ngrid storage")
        assertEquals(1, report.quarantined)
    }

    @Test
    fun parseQuarantinesDigitSpace() {
        val (report, _) = FollowImportParser.parse("1 2 3\ngrid storage")
        assertEquals(1, report.quarantined)
    }

    @Test
    fun parseNfkcsAndCollapses() {
        val (report, labels) = FollowImportParser.parse("  Grid   Storage  \n")
        assertEquals(1, report.unique)
        assertEquals("Grid Storage", labels.first().display)
    }
}
