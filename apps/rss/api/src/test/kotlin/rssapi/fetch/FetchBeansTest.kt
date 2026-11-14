package rssapi.fetch

import kotlin.test.Test
import kotlin.test.assertTrue

class FetchBeansTest {
    @Test
    fun createsPageFetcherBean() {
        val bean = FetchBeans().pageFetcher()
        assertTrue(bean is HttpPageFetcher)
    }
}
