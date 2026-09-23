package rssapi.ai

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import rssapi.persist.AiQuotaEntity
import rssapi.persist.AiQuotaRepo
import rssapi.web.ApiException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import java.util.UUID

/** Rolling per-user budgets. One row per user; windows reset lazily on use. */
@Service
class AiQuotaService(private val quota: AiQuotaRepo) {
    internal var clock: Clock = Clock.systemUTC()

    @Transactional
    fun consume(userId: UUID, hourlyLimit: Int, dailyLimit: Int) {
        try {
            consumeOnce(userId, hourlyLimit, dailyLimit)
        } catch (_: ObjectOptimisticLockingFailureException) {
            // Lost a race with another request: treat contention as over budget.
            throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI budget used")
        } catch (_: DataIntegrityViolationException) {
            // Lost a first-write race with another request: same treatment.
            throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI budget used")
        }
    }

    private fun consumeOnce(userId: UUID, hourlyLimit: Int, dailyLimit: Int) {
        val now = clock.instant()
        val row = quota.findById(userId).orElseGet { AiQuotaEntity(userId = userId) }
        if (row.hourStart.isBefore(now.minus(1, ChronoUnit.HOURS))) {
            row.hourStart = now
            row.hourCount = 0
        }
        val today = dayStart(now)
        if (row.dayStart.isBefore(today)) {
            row.dayStart = today
            row.dayCount = 0
        }
        if (row.hourCount >= hourlyLimit) throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "hourly AI budget used")
        if (row.dayCount >= dailyLimit) throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "daily AI budget used")
        row.hourCount += 1
        row.dayCount += 1
        quota.saveAndFlush(row)
    }

    private fun dayStart(now: Instant): Instant =
        LocalDate.ofInstant(now, ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant()
}
