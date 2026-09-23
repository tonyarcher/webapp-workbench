package stockgame.web

import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import stockgame.trading.AccountService
import stockgame.trading.TradingService
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TradingAccessBranchTest {
    @Test
    fun missingBeansAre503() {
        val trading = mock<ObjectProvider<TradingService>>()
        whenever(trading.ifAvailable).thenReturn(null)
        assertFailsWith<ApiException> { trading.orOffline() }
        val accounts = mock<ObjectProvider<AccountService>>()
        whenever(accounts.ifAvailable).thenReturn(null)
        assertFailsWith<ApiException> { accounts.orOffline() }
    }

    @Test
    fun presentBeansPass() {
        val trading = mock<ObjectProvider<TradingService>>()
        val svc = mock<TradingService>()
        whenever(trading.ifAvailable).thenReturn(svc)
        assertEquals(svc, trading.orOffline())
        val accounts = mock<ObjectProvider<AccountService>>()
        val acc = mock<AccountService>()
        whenever(accounts.ifAvailable).thenReturn(acc)
        assertEquals(acc, accounts.orOffline())
    }
}
