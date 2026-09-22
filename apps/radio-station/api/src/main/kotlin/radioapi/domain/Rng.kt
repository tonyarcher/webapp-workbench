package radioapi.domain

/** Mulberry32. Bit operations match the Node clock so a seed replays. */
class Rng(seed: String) {
    private var state: Int = hashSeed(seed)

    fun next(): Double {
        state = state + 0x6d2b79f5
        var mixed = imul(state xor (state ushr 15), 1 or state)
        mixed = (mixed + imul(mixed xor (mixed ushr 7), 61 or mixed)) xor mixed
        val bits = (mixed xor (mixed ushr 14)).toUInt()
        return bits.toDouble() / 4_294_967_296.0
    }
}

fun hashSeed(seed: String): Int {
    var hash = 1_779_033_703 xor seed.length
    val mix = 3_432_918_353L.toInt()
    for (ch in seed) {
        hash = imul(hash xor ch.code, mix)
        hash = (hash shl 13) or (hash ushr 19)
    }
    return if (hash == 0) 1 else hash
}

fun <T> pickWeighted(rng: Rng, items: List<T>, weights: List<Double>): T {
    val total = weights.sum()
    if (items.isEmpty() || total <= 0.0) error("pickWeighted: empty")
    var roll = rng.next() * total
    for (index in items.indices) {
        roll -= weights.getOrElse(index) { 0.0 }
        if (roll < 0.0) return items[index]
    }
    return items.last()
}

fun <T> pickUniform(rng: Rng, items: List<T>): T {
    if (items.isEmpty()) error("pickUniform: empty")
    return items[(rng.next() * items.size).toInt()]
}

private fun imul(left: Int, right: Int): Int = left * right
