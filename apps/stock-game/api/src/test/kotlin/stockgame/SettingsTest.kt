package stockgame

import stockgame.trading.AccountService
import stockgame.trading.FakeGameStore
import stockgame.trading.FakeProvider
import stockgame.trading.TradingService
import java.time.Clock
import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsTest {
    @Test
    fun defaultsPortAndService() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3005, s.port)
        assertEquals("", s.databaseUrl)
        assertEquals("info", s.logLevel)
        assertEquals("stock-game-api", s.service)
        assertEquals("yahoo", s.provider)
    }
}
