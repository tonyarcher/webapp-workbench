package rssapi.ai

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.AiQuotaEntity
import rssapi.persist.AiQuotaRepo
import rssapi.web.ApiException

private fun fixedClockAt(now: Instant): Clock = Clock.fixed(now, ZoneOffset.UTC)

private fun quotaServiceAt(repo: AiQuotaRepo, now: Instant): AiQuotaService {
    val service = AiQuotaService(repo)
    service.clock = fixedClockAt(now)
    return service
}

class AiQuotaServiceTest {
    private val now = Instant.parse("2026-09-13T12:00:00Z")
    private val uid = UUID.randomUUID()

    @Test
    fun freshUserStartsNewWindows() {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(uid)).thenReturn(Optional.empty())

        quotaServiceAt(repo, now).consume(uid, 30, 100)

        val captor = argumentCaptor<AiQuotaEntity>()
        verify(repo).saveAndFlush(captor.capture())
        assertEquals(1, captor.firstValue.hourCount)
        assertEquals(1, captor.firstValue.dayCount)
        assertEquals(now, captor.firstValue.hourStart)
    }

    @Test
    fun rolledWindowsResetBeforeCounting() {
        val repo: AiQuotaRepo = mock()
        val stale = AiQuotaEntity(uid, now.minusSeconds(4_000), 30, now.minusSeconds(100_000), 100)
        whenever(repo.findById(uid)).thenReturn(Optional.of(stale))

        quotaServiceAt(repo, now).consume(uid, 30, 100)

        val captor = argumentCaptor<AiQuotaEntity>()
        verify(repo).saveAndFlush(captor.capture())
        assertEquals(1, captor.firstValue.hourCount)
        assertEquals(1, captor.firstValue.dayCount)
    }

    @Test
    fun hourlyBudgetReturns429() {
        val repo: AiQuotaRepo = mock()
        val spent = AiQuotaEntity(uid, now, 30, now, 5)
        whenever(repo.findById(uid)).thenReturn(Optional.of(spent))

        val err = assertFailsWith<ApiException> { quotaServiceAt(repo, now).consume(uid, 30, 100) }
        assertEquals(429, err.status)
        verify(repo, never()).saveAndFlush(any())
    }

    @Test
    fun dailyBudgetReturns429() {
        val repo: AiQuotaRepo = mock()
        val spent = AiQuotaEntity(uid, now, 5, now, 100)
        whenever(repo.findById(uid)).thenReturn(Optional.of(spent))

        val err = assertFailsWith<ApiException> { quotaServiceAt(repo, now).consume(uid, 30, 100) }
        assertEquals(429, err.status)
    }

    @Test
    fun writeContentionReturns429() {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(uid)).thenReturn(Optional.empty())
        whenever(repo.saveAndFlush(any())).thenThrow(
            org.springframework.orm.ObjectOptimisticLockingFailureException(AiQuotaEntity::class.java, uid),
        )

        val err = assertFailsWith<ApiException> { quotaServiceAt(repo, now).consume(uid, 30, 100) }
        assertEquals(429, err.status)
    }

    @Test
    fun firstWriteRaceReturns429() {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(uid)).thenReturn(Optional.empty())
        whenever(repo.saveAndFlush(any())).thenThrow(
            org.springframework.dao.DataIntegrityViolationException("duplicate key"),
        )

        val err = assertFailsWith<ApiException> { quotaServiceAt(repo, now).consume(uid, 30, 100) }
        assertEquals(429, err.status)
    }
}
