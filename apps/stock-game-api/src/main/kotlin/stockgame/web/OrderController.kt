package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.Order
import stockgame.trading.OrderRequest
import stockgame.trading.TradingService

data class PlaceOrderBody(
    val symbol: String,
    val side: String,
    val qty: Int,
    val executeAt: Long? = null,
    val orderType: String? = null,
    val tif: String? = null,
    val limitPrice: Double? = null,
    val stopPrice: Double? = null,
    val fillPriceSource: String? = null,
)

data class OkBody(val ok: Boolean = true)

@RestController
class OrderController(
    private val user: IdentityUser,
    private val trading: ObjectProvider<TradingService>,
) {
    @GetMapping("/orders")
    fun list(): List<Order> {
        val svc = trading.orOffline()
        svc.executeDueOrders(user.id)
        return svc.listOrders(user.id)
    }

    @PostMapping("/orders")
    fun place(@RequestBody body: PlaceOrderBody): Order {
        val symbol = body.symbol.trim().uppercase()
        if (symbol.isEmpty() || body.qty <= 0) throw ApiException(400, "invalid order")
        val orderType = requireOrderType(body.orderType ?: "market")
        val tif = requireTif(body.tif ?: "GTC")
        if (body.fillPriceSource != null) requireFillSource(body.fillPriceSource)
        requirePrices(orderType, body.limitPrice, body.stopPrice)
        return trading.orOffline().placeOrder(
            user.id,
            OrderRequest(
                symbol = symbol,
                side = requireSide(body.side),
                qty = body.qty,
                executeAt = body.executeAt,
                orderType = orderType,
                tif = tif,
                limitPrice = body.limitPrice,
                stopPrice = body.stopPrice,
                fillPriceSource = body.fillPriceSource,
            ),
        )
    }

    @PostMapping("/orders/{id}/cancel")
    fun cancel(@PathVariable id: Long): OkBody {
        trading.orOffline().cancelOrder(user.id, id)
        return OkBody()
    }
}
