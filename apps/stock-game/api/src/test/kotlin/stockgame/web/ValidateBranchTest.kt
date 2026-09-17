package stockgame.web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ValidateBranchTest {
    @Test
    fun sides() {
        assertEquals("buy", requireSide("buy"))
        assertEquals("cover", requireSide("cover"))
        assertFailsWith<ApiException> { requireSide("BUY") }
        assertFailsWith<ApiException> { requireSide("") }
    }

    @Test
    fun orderTypes() {
        assertEquals("market", requireOrderType("market"))
        assertEquals("stopLimit", requireOrderType("stopLimit"))
        assertFailsWith<ApiException> { requireOrderType("limit ") }
    }

    @Test
    fun prices() {
        requirePrices("market", null, null)
        requirePrices("limit", 10.0, null)
        requirePrices("stop", null, 5.0)
        requirePrices("stopLimit", 10.0, 5.0)
        assertFailsWith<ApiException> { requirePrices("limit", null, null) }
        assertFailsWith<ApiException> { requirePrices("limit", -1.0, null) }
        assertFailsWith<ApiException> { requirePrices("stop", null, Double.NaN) }
        assertFailsWith<ApiException> { requirePrices("stopLimit", 10.0, null) }
        assertFailsWith<ApiException> { requirePrices("stopLimit", null, 5.0) }
    }

    @Test
    fun tifAndSource() {
        assertEquals("GTC", requireTif("GTC"))
        assertFailsWith<ApiException> { requireTif("gtc") }
        assertEquals("mid", requireFillSource("mid"))
        assertFailsWith<ApiException> { requireFillSource("close") }
    }
}
