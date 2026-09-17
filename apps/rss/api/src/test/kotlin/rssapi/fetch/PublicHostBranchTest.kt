package rssapi.fetch

import kotlin.test.Test
import kotlin.test.assertFailsWith

class PublicHostBranchTest {
    @Test
    fun rejectsBadUrls() {
        assertFailsWith<Exception> { assertPublicHost("ftp://example.com/rss", false) }
        assertFailsWith<Exception> { assertPublicHost("https://user:pass@example.com/rss", false) }
        assertFailsWith<Exception> { assertPublicHost("not a url", false) }
    }

    @Test
    fun allowLocalSkipsDns() {
        assertPublicHost("https://example.com/rss", true)
        assertPublicHost("http://127.0.0.1/rss", true)
    }

    @Test
    fun rejectsLoopback() {
        assertFailsWith<IllegalArgumentException> { assertPublicHost("http://127.0.0.1/rss", false) }
        assertFailsWith<IllegalArgumentException> { assertPublicHost("http://localhost/rss", false) }
    }
}
