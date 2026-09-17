package stockgame.provider

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.store.BarCache
import stockgame.trading.FakeProvider

class CachedProviderBranchTest {
    private fun quote(symbol: String, price: Double): Quote =
        Quote(symbol, symbol, price, "USD", "T", 0, 0)

    @Test
    fun quoteCachesWithinTtl() {
        val inner = mock<PriceProvider>()
        val cache = mock<BarCache>()
        whenever(inner.getQuote("AAPL")).thenReturn(quote("AAPL", 10.0))
        val cached = CachedProvider(inner, cache, 60_000L)
        assertEquals(10.0, cached.getQuote("AAPL").price)
        assertEquals(10.0, cached.getQuote("AAPL").price)
        org.mockito.kotlin.verify(inner, org.mockito.kotlin.times(1)).getQuote("AAPL")
    }

    @Test
    fun expiredCacheRefetches() {
        val inner = mock<PriceProvider>()
        val cache = mock<BarCache>()
        whenever(inner.getQuote("AAPL")).thenReturn(quote("AAPL", 10.0))
        val cached = CachedProvider(inner, cache, 0L)
        assertEquals(10.0, cached.getQuote("AAPL").price)
        assertEquals(10.0, cached.getQuote("AAPL").price)
        org.mockito.kotlin.verify(inner, org.mockito.kotlin.times(2)).getQuote("AAPL")
    }

    @Test
    fun barsFromCacheOrFetch() {
        val bar = Bar(1, 1.0, 2.0, 0.5, 1.5, 10)
        val cache = mock<BarCache>()
        whenever(cache.getBars(any(), any(), any(), any())).thenReturn(listOf(bar))
        val cached = CachedProvider(FakeProvider(), cache, 60_000L)
        assertEquals(listOf(bar), cached.getBars("A", "1d", 0, 9))
    }

    @Test
    fun emptyFetchCachesEmpty() {
        val cache = mock<BarCache>()
        whenever(cache.getBars(any(), any(), any(), any())).thenReturn(emptyList())
        val cached = CachedProvider(FakeProvider(), cache, 60_000L)
        assertTrue(cached.getBars("A", "1d", 0, 9).isEmpty())
        assertTrue(cached.getBars("A", "1d", 0, 9).isEmpty())
    }

    @Test
    fun missFetchesAndCaches() {
        val bar = Bar(1, 1.0, 2.0, 0.5, 1.5, 10)
        val cache = mock<BarCache>()
        whenever(cache.getBars(any(), any(), any(), any())).thenReturn(emptyList(), listOf(bar))
        val supplied = listOf(bar)
        val inner = FakeProvider(supplied)
        val cached = CachedProvider(inner, cache, 60_000L)
        assertEquals(listOf(bar), cached.getBars("A", "1d", 0, 9))
        verify(cache).upsertBars("A", "1d", supplied)
    }

    @Test
    fun searchDelegates() {
        val cached = CachedProvider(FakeProvider(), mock(), 60_000L)
        assertTrue(cached.search("x").isEmpty())
        assertEquals("fake", cached.id)
    }
}
