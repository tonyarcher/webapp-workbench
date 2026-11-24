package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TopicKeyExtractorTest {
    @Test
    fun learnsPhrasesAndSourceLinks() {
        val keys = TopicKeyExtractor.keys(
            "Battery grid storage expands across Europe",
            "https://example.com/story?utm=1",
            "https://example.com/original",
            null,
        )

        assertTrue(keys.contains("phrase:battery grid"))
        assertTrue(keys.contains("phrase:grid storage"))
        assertTrue(keys.any { it.startsWith("link:") })
        assertTrue(keys.none { it.contains("across") })
        assertTrue(keys.none { it.contains("utm") == true && it.startsWith("link:") })
    }

    @Test
    fun stopwordsDoNotBecomePhrases() {
        val keys = TopicKeyExtractor.keys("The news that this would be about nothing", null, null, null)

        assertTrue(keys.none { it.startsWith("phrase:") })
    }

    @Test
    fun linksSurviveWithoutATitle() {
        val keys = TopicKeyExtractor.keys(null, null, "https://example.com/a", "   ")

        assertEquals(1, keys.size)
        assertTrue(keys.all { it.startsWith("link:") })
    }
}
