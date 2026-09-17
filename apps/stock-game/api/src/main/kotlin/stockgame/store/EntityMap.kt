package stockgame.store

import stockgame.domain.Bar
import stockgame.domain.Order
import stockgame.domain.Trade
import stockgame.persist.OrderEntity
import stockgame.persist.PriceCacheEntity
import stockgame.persist.TradeEntity

fun TradeEntity.toTrade(): Trade = Trade(
    id = id!!,
    symbol = symbol,
    side = side,
    qty = qty,
    price = price,
    cashDeltaCents = cashDeltaCents,
    mode = mode,
    executedAt = executedAt,
    createdAt = createdAt,
)

fun OrderEntity.toOrder(): Order = Order(
    id = id!!,
    symbol = symbol,
    side = side,
    qty = qty,
    executeAt = executeAt,
    status = status,
    createdAt = createdAt,
    tradeId = tradeId,
    orderType = orderType,
    tif = tif,
    limitPrice = limitPrice,
    stopPrice = stopPrice,
    expiresAt = expiresAt,
    fillPriceSource = fillPriceSource,
)

fun PriceCacheEntity.toBar(): Bar = Bar(date, open, high, low, close, volume)

fun NewTrade.toEntity(): TradeEntity = TradeEntity(
    userId = userId,
    symbol = symbol,
    side = side,
    qty = qty,
    price = price,
    cashDeltaCents = cashDeltaCents,
    mode = mode,
    executedAt = executedAt,
    createdAt = createdAt,
)

fun NewOrder.toEntity(): OrderEntity = OrderEntity(
    userId = userId,
    symbol = symbol,
    side = side,
    qty = qty,
    executeAt = executeAt,
    status = "pending",
    createdAt = createdAt,
    orderType = orderType,
    tif = tif,
    limitPrice = limitPrice,
    stopPrice = stopPrice,
    expiresAt = expiresAt,
    fillPriceSource = fillPriceSource,
)
