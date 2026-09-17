package stockgame.domain

fun signedQty(side: String, qty: Int): Int =
    if (side == "buy" || side == "cover") qty else -qty

fun cashDelta(side: String, qty: Int, price: Double): Long {
    val amount = Math.round(qty * price * 100)
    return if (side == "buy" || side == "cover") -amount else amount
}

fun applyCommission(deltaCents: Long, commissionCents: Int): Long =
    deltaCents - commissionCents

fun round2(value: Double): Double = Math.round(value * 100) / 100.0

fun defaultFillPriceSource(side: String): String =
    if (side == "buy" || side == "cover") "ask" else "bid"
