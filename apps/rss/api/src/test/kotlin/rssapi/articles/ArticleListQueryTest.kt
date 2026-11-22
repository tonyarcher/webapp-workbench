package rssapi.articles
import jakarta.persistence.EntityManager
import jakarta.persistence.Tuple
import jakarta.persistence.TypedQuery
import jakarta.persistence.criteria.CriteriaQuery
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Answers
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class ArticleListQueryTest {
    @Test
    fun emptyIdSetDoesNotQuery() {
        val em: EntityManager = mock()

        val result = ArticleListQuery(em).findExcerpts(emptyList())

        assertEquals(emptyMap<String, String>(), result)
        verify(em, never()).createQuery(any<CriteriaQuery<*>>())
    }

    @Test
    fun mapsOnlyRowsWithBothValues() {
        val em: EntityManager = mock(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
        val query: TypedQuery<Tuple> = mock()
        val good: Tuple = mock()
        val noText: Tuple = mock()
        val noId: Tuple = mock()
        whenever(good.get(0, String::class.java)).thenReturn("a1")
        whenever(good.get(1, String::class.java)).thenReturn("excerpt")
        whenever(noText.get(0, String::class.java)).thenReturn("a2")
        whenever(noText.get(1, String::class.java)).thenReturn(null)
        whenever(noId.get(0, String::class.java)).thenReturn(null)
        whenever(em.createQuery(any<CriteriaQuery<Tuple>>())).thenReturn(query)
        org.mockito.kotlin.doReturn(listOf(good, noText, noId)).whenever(query).resultList

        val result = ArticleListQuery(em).findExcerpts(listOf("a1", "a2", "a3"))

        assertEquals(mapOf("a1" to "excerpt"), result)
    }
}
