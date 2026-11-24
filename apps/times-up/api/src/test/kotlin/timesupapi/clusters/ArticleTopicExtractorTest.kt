package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

class ArticleTopicExtractorTest {
    private val articles: TopicArticleRepo = mock()
    private val topics: ArticleTopicRepo = mock()
    private val extractor = ArticleTopicExtractor(articles, topics)

    private fun candidate(id: String) = object : TopicArticleRepo.Candidate {
        override val id = id
        override val title = "Battery grid storage expands"
        override val normLink: String? = null
        override val canonicalUrl: String? = null
        override val sourceUrl: String? = null
    }

    @Test
    fun extractsKeysThenMarksTheArticle() {
        whenever(articles.candidates(any())).thenReturn(listOf(candidate("a1")))

        extractor.runBatch()

        val saved = argumentCaptor<List<ArticleTopicEntity>>()
        verify(topics).saveAll(saved.capture())
        assertTrue(saved.firstValue.any { it.topicKey == "phrase:battery grid" })
        verify(articles).markExtracted(eq("a1"), any<Instant>())
    }

    @Test
    fun stoppedExtractorDoesNothing() {
        extractor.stop()

        extractor.runBatch()

        verify(articles, never()).candidates(any())
    }

    @Test
    fun emptyBatchDoesNothing() {
        whenever(articles.candidates(any())).thenReturn(emptyList())

        extractor.runBatch()

        verify(topics, never()).saveAll(any<List<ArticleTopicEntity>>())
    }

    @Test
    fun articleWithoutKeysIsStillMarkedExtracted() {
        val plain = object : TopicArticleRepo.Candidate {
            override val id = "plain"
            override val title = "the with and of"
            override val normLink: String? = null
            override val canonicalUrl: String? = null
            override val sourceUrl: String? = null
        }
        whenever(articles.candidates(any())).thenReturn(listOf(plain))

        extractor.runBatch()

        verify(articles).markExtracted(eq("plain"), any<Instant>())
        verify(topics, never()).saveAll(any<List<ArticleTopicEntity>>())
    }
}
