package fitnessapi.domain

data class Point(val t: Long, val v: Double)

fun downsampleLttb(points: List<Point>, limit: Int): List<Point> {
    if (limit < 3 || points.size <= limit) return points.toList()
    val first = points.firstOrNull() ?: return emptyList()
    val last = points.last()
    val sampled = mutableListOf(first)
    val bucketSize = (points.size - 2).toDouble() / (limit - 2)
    var a = 0
    for (i in 0 until limit - 2) {
        val nextA = nextBucketIndex(points, last, a, i, bucketSize)
        val chosen = points.getOrNull(nextA)
        if (chosen != null && chosen !== last) sampled.add(chosen)
        a = nextA
    }
    sampled.add(last)
    return sampled
}

private fun nextBucketIndex(points: List<Point>, last: Point, a: Int, i: Int, bucketSize: Double): Int {
    val rangeStart = kotlin.math.floor((i + 1) * bucketSize).toInt() + 1
    val rangeEnd = minOf(kotlin.math.floor((i + 2) * bucketSize).toInt() + 1, points.size)
    val avgStart = kotlin.math.floor((i + 2) * bucketSize).toInt() + 1
    val avgEnd = minOf(kotlin.math.floor((i + 3) * bucketSize).toInt() + 1, points.size)
    val pointA = points.getOrNull(a) ?: return a
    val avgPts = slice(points, avgStart, avgEnd)
    val avg = average(if (avgPts.isEmpty()) listOf(last) else avgPts)
    return pickLargest(pointA, slice(points, rangeStart, rangeEnd), avg, rangeStart)
}

private fun slice(points: List<Point>, start: Int, end: Int): List<Point> {
    val from = start.coerceIn(0, points.size)
    val to = end.coerceIn(from, points.size)
    return points.subList(from, to)
}

private fun average(points: List<Point>): Pair<Double, Double> {
    if (points.isEmpty()) return 0.0 to 0.0
    var t = 0.0
    var v = 0.0
    for (p in points) {
        t += p.t
        v += p.v
    }
    return (t / points.size) to (v / points.size)
}

private fun pickLargest(
    pointA: Point,
    range: List<Point>,
    avg: Pair<Double, Double>,
    rangeStart: Int,
): Int {
    var maxArea = -1.0
    var nextA = rangeStart
    for (j in range.indices) {
        val p = range[j]
        val area = kotlin.math.abs(
            (pointA.t - avg.first) * (p.v - pointA.v) - (pointA.t - p.t) * (avg.second - pointA.v),
        )
        if (area > maxArea) {
            maxArea = area
            nextA = rangeStart + j
        }
    }
    return nextA
}
