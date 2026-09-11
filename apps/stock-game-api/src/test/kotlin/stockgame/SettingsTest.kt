package stockgame

import kotlin.test.Test
import kotlin.test.assertEquals
import stockgame.trading.FakeGameStore
import stockgame.trading.FakeProvider
import stockgame.trading.TradingService
import stockgame.trading.AccountService
import java.time.Clock

class SettingsTest {
    @Test
    fun defaultsPortAndService() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3004, s.port)
        assertEquals("", s.databaseUrl)
        assertEquals("info", s.logLevel)
        assertEquals("stock-game-api", s.service)
        assertEquals("yahoo", s.provider)
    }
}
