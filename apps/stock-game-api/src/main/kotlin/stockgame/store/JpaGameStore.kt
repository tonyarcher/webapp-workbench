package stockgame.store

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade
import stockgame.persist.GameConfigEntity
import stockgame.persist.GameConfigRepo
import stockgame.persist.OrderRepo
import stockgame.persist.TradeRepo

@Service
@ConditionalOnBean(DataSource::class)
class JpaGameStore(
    private val configs: GameConfigRepo,
    private val trades: TradeRepo,
    private val orders: OrderRepo,
    private val mapper: ObjectMapper,
) : GameStore {
    override fun getConfig(): GameConfig? {
        val raw = configs.findById("game").orElse(null)?.value ?: return null
        return mapper.readValue<GameConfig>(raw)
    }

    override fun saveConfig(config: GameConfig) {
        configs.save(GameConfigEntity("game", mapper.writeValueAsString(config)))
    }

    override fun listTrades(): List<Trade> = trades.findAllByOrderByExecutedAtAscIdAsc().map { it.toTrade() }

    override fun insertTrade(trade: NewTrade): Trade = trades.save(trade.toEntity()).toTrade()

    override fun listOrders(): List<Order> = orders.findAllByOrderByExecuteAtAscIdAsc().map { it.toOrder() }

    override fun insertOrder(order: NewOrder): Order = orders.save(order.toEntity()).toOrder()

    override fun pendingOrders(now: Long): List<Order> =
        orders.findByStatusAndExecuteAtLessThanEqualOrderByExecuteAtAsc("pending", now).map { it.toOrder() }

    @Transactional
    override fun fillOrderWithTrade(orderId: Long, trade: NewTrade): Trade? {
        val row = orders.findById(orderId).orElse(null) ?: return null
        if (row.status != "pending") return null
        val saved = trades.save(trade.toEntity())
        row.status = "filled"
        row.tradeId = saved.id
        orders.save(row)
        return saved.toTrade()
    }

    override fun cancelOrder(orderId: Long) {
        val row = orders.findById(orderId).orElse(null) ?: return
        if (row.status != "pending") return
        row.status = "cancelled"
        orders.save(row)
    }
}
