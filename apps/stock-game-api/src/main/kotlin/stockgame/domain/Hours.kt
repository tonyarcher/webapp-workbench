package stockgame.domain

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

private val NY: ZoneId = ZoneId.of("America/New_York")
private val OPEN: LocalTime = LocalTime.of(9, 30)
private val CLOSE: LocalTime = LocalTime.of(16, 0)

fun isNyseOpen(nowMs: Long): Boolean {
    val zdt = Instant.ofEpochMilli(nowMs).atZone(NY)
    if (zdt.dayOfWeek == DayOfWeek.SATURDAY || zdt.dayOfWeek == DayOfWeek.SUNDAY) return false
    val t = zdt.toLocalTime()
    return !t.isBefore(OPEN) && t.isBefore(CLOSE)
}

fun nextNyseOpen(nowMs: Long): Long {
    if (isNyseOpen(nowMs)) return nowMs
    val startDate = Instant.ofEpochMilli(nowMs).atZone(NY).toLocalDate()
    for (offset in 0..8) {
        val candidate = startDate.plusDays(offset.toLong()).atTime(OPEN).atZone(NY).toInstant().toEpochMilli()
        if (candidate <= nowMs) continue
        val dow = Instant.ofEpochMilli(candidate).atZone(NY).dayOfWeek
        if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) return candidate
    }
    return nowMs
}

fun expiresAtForOrder(executeAt: Long): Long {
    val day = Instant.ofEpochMilli(executeAt).atZone(NY).toLocalDate()
    return day.atTime(CLOSE).atZone(NY).toInstant().toEpochMilli()
}

fun asapExecuteAt(nowMs: Long, delayMinutes: Int): Long =
    nextNyseOpen(nowMs + delayMinutes * 60_000L)
