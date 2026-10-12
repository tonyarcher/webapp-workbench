package calsync.trakt

/** Trakt caps a calendar window at 33 days; wider asks are rejected, not clipped. */
const val TRAKT_MAX_CALENDAR_DAYS = 33

/** Trakt history pages top out at 100 rows; larger asks are rejected. */
const val TRAKT_HISTORY_PAGE_SIZE = 100

private const val MILLIS_PER_SECOND = 1_000L

private val DATE = Regex("^\\d{4}-\\d{2}-\\d{2}$")

/** The two collection kinds every data endpoint accepts. Anything else is not proxied. */
fun isTraktKind(kind: String): Boolean = kind == "shows" || kind == "movies"

fun isTraktDate(text: String): Boolean = DATE.matches(text)

fun isCalendarDays(days: Int): Boolean = days in 1..TRAKT_MAX_CALENDAR_DAYS

fun isHistoryPage(page: Int, limit: Int): Boolean = page >= 1 && limit in 1..TRAKT_HISTORY_PAGE_SIZE

fun calendarShowsPath(start: String, days: Int): String = "/calendars/my/shows/$start/$days"

fun calendarMoviesPath(start: String, days: Int): String = "/calendars/my/movies/$start/$days"

fun historyPath(kind: String, page: Int, limit: Int): String = "/sync/history/$kind?page=$page&limit=$limit"

const val DEVICE_CODE_PATH: String = "/oauth/device/code"

const val DEVICE_TOKEN_PATH: String = "/oauth/device/token"

const val REFRESH_TOKEN_PATH: String = "/oauth/token"

/** Absolute expiry for a token lifetime in seconds, mirroring the client. */
fun expiresAtMs(expiresInSec: Long, nowMs: Long = System.currentTimeMillis()): Long =
    nowMs + expiresInSec * MILLIS_PER_SECOND
