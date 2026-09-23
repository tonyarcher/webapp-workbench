package radioapi.domain

// Mulberry32 and the seed hash below are fixed by the algorithm, not tunable:
// changing any constant changes the stream, and a seed must keep replaying.
private const val MULBERRY_INCREMENT = 0x6d2b79f5
private const val MULBERRY_SHIFT_1 = 15
private const val MULBERRY_SHIFT_2 = 7
private const val MULBERRY_SHIFT_3 = 14
private const val MULBERRY_MIX = 61
private const val UINT32_CARDINALITY = 4_294_967_296.0

private const val HASH_INITIAL = 1_779_033_703
private const val HASH_MULTIPLIER = 3_432_918_353L.toInt()
private const val HASH_ROTATE_LEFT = 13
private const val HASH_ROTATE_RIGHT = 19

/** Mulberry32. Bit operations match the Node clock so a seed replays. */
class Rng(seed: String) {
    private var state: Int = hashSeed(seed)

    fun next(): Double {
        state = state + MULBERRY_INCREMENT
        var mixed = imul(state xor (state ushr MULBERRY_SHIFT_1), 1 or state)
        mixed = (mixed + imul(mixed xor (mixed ushr MULBERRY_SHIFT_2), MULBERRY_MIX or mixed)) xor mixed
        val bits = (mixed xor (mixed ushr MULBERRY_SHIFT_3)).toUInt()
        return bits.toDouble() / UINT32_CARDINALITY
    }
}

fun hashSeed(seed: String): Int {
    var hash = HASH_INITIAL xor seed.length
    for (ch in seed) {
        hash = imul(hash xor ch.code, HASH_MULTIPLIER)
        hash = (hash shl HASH_ROTATE_LEFT) or (hash ushr HASH_ROTATE_RIGHT)
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
