package stockgame.domain

data class Position(val qty: Int, val totalCostCents: Long)

fun accumulatePositions(trades: List<Trade>): Map<String, Position> {
    val state = linkedMapOf<String, Position>()
    for (trade in trades) {
        state[trade.symbol] = updatePosition(state[trade.symbol], trade)
    }
    return state
}

private fun updatePosition(prev: Position?, trade: Trade): Position {
    val state = prev ?: Position(0, 0)
    val signed = signedQty(trade.side, trade.qty)
    val nextQty = state.qty + signed
    if (state.qty == 0) return openingPosition(trade)
    if (Math.signum(nextQty.toDouble()) == Math.signum(state.qty.toDouble()) &&
        Math.abs(nextQty) > Math.abs(state.qty)
    ) {
        return increasingPosition(state, trade, nextQty)
    }
    if (nextQty == 0) return Position(0, 0)
    return reducingPosition(state, trade, nextQty)
}

private fun openingPosition(trade: Trade): Position {
    val cost = Math.round(trade.qty * trade.price * 100)
    return Position(signedQty(trade.side, trade.qty), cost)
}

private fun increasingPosition(state: Position, trade: Trade, nextQty: Int): Position {
    val added = Math.round(trade.qty * trade.price * 100)
    return Position(nextQty, state.totalCostCents + added)
}

private fun reducingPosition(state: Position, trade: Trade, nextQty: Int): Position {
    val absPrev = Math.abs(state.qty)
    val closingQty = minOf(trade.qty, absPrev)
    val avg = state.totalCostCents.toDouble() / absPrev
    val remaining = absPrev - closingQty
    return Position(nextQty, Math.round(avg * remaining))
}
