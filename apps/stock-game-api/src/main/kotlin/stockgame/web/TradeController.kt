package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.Trade
import stockgame.trading.BackdatedRequest
import stockgame.trading.TradingService

data class PlaceTradeBody(
    val symbol: String,
    val side: String,
    val qty: Int,
    val at: Long,
    val orderType: String? = null,
    val limitPrice: Double? = null,
    val stopPrice: Double? = null,
)

@RestController
class TradeController(
    private val user: IdentityUser,
    private val trading: ObjectProvider<TradingService>,
) {
    @GetMapping("/trades")
    fun list(): List<Trade> = trading.orOffline().listTrades(user.id)

    @PostMapping("/trades")
    fun place(@RequestBody body: PlaceTradeBody): Trade {
        val symbol = body.symbol.trim().uppercase()
        if (symbol.isEmpty() || body.qty <= 0) throw ApiException(400, "invalid trade")
        val orderType = requireOrderType(body.orderType ?: "market")
        requirePrices(orderType, body.limitPrice, body.stopPrice)
        return trading.orOffline().placeBackdatedTrade(
            user.id,
            BackdatedRequest(
                symbol = symbol,
                side = requireSide(body.side),
                qty = body.qty,
                at = body.at,
                orderType = orderType,
                limitPrice = body.limitPrice,
                stopPrice = body.stopPrice,
            ),
        )
    }
}
