package stockgame.domain

/** Money is integer cents; these convert to and from a 2-decimal double. */
private const val CENTS_PER_UNIT = 100

fun signedQty(side: String, qty: Int): Int = if (side == "buy" || side == "cover") qty else -qty

fun cashDelta(side: String, qty: Int, price: Double): Long {
    val amount = Math.round(qty * price * CENTS_PER_UNIT)
    return if (side == "buy" || side == "cover") -amount else amount
}

fun applyCommission(deltaCents: Long, commissionCents: Int): Long = deltaCents - commissionCents

fun round2(value: Double): Double = Math.round(value * CENTS_PER_UNIT) / CENTS_PER_UNIT.toDouble()

fun defaultFillPriceSource(side: String): String = if (side == "buy" || side == "cover") "ask" else "bid"
