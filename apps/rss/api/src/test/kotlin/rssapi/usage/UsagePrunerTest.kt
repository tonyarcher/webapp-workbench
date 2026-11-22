package rssapi.usage
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class UsagePrunerTest {
    @Test
    fun prunesOldRows() {
        val repo = mock<FeatureUsageRepo>()
        whenever(repo.deleteOlderThan(any())).thenReturn(3)
        UsagePruner(repo).prune()
        verify(repo).deleteOlderThan(any())
    }

    @Test
    fun skipsLogWhenNothingPruned() {
        val repo = mock<FeatureUsageRepo>()
        whenever(repo.deleteOlderThan(any())).thenReturn(0)
        UsagePruner(repo).prune()
        verify(repo).deleteOlderThan(any())
    }
}
