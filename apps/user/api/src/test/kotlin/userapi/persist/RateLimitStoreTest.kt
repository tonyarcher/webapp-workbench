package userapi.persist

import org.junit.jupiter.api.AfterEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The limiter exists because it has to stay correct when two replicas count at
 * same time, so the assertions that matter are the concurrent one and the window
 * arithmetic buried in the upsert. A mocked repository proves neither, and the
 * persist package is excluded from the coverage gate, so this talks to a real
 * Postgres.
 *
 * Nothing here knows about Docker. The test connects to a port; the Gradle
 * `testPostgres` task owns the server's lifecycle, so this file stays about SQL.
 * That split also keeps it off Testcontainers, whose container API the Boot 4.1.1
 * managed version (2.0.5) deprecates -- and this module compiles with
 * allWarningsAsErrors, so a deprecated call is a build failure, not a warning.
 *
 * This class runs only under `-Pintegration`, which is what supplies the port.
 * The default `test` run excludes it, so `check` needs no Docker daemon; a
 * missing property is still a hard failure rather than a skip, because a skipped
 * security test reads as coverage and protects nothing.
 *
 * Flyway runs in this slice, so the V8 migration is exercised here too rather
 * than only asserted as migration text.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(RateLimitStoreTest.StoreConfiguration::class)
@Transactional
class RateLimitStoreTest {
    @TestConfiguration
    class StoreConfiguration {
        /** A bean, so the @Transactional proxy applies exactly as in production. */
        @Bean
        fun rateLimitStore(repo: RateLimitRepo): JpaRateLimitStore = JpaRateLimitStore(repo)
    }

    companion object {
        /**
         * Fail loudly when the port is not supplied. A skipped security test is
         * worse than a missing one: it reads as coverage and protects nothing.
         */
        @JvmStatic
        @DynamicPropertySource
        fun datasource(registry: DynamicPropertyRegistry) {
            val url = requireNotNull(System.getProperty(DB_URL)) {
                "$DB_URL not set; run the tests through Gradle so testPostgres can supply it"
            }
            registry.add("spring.datasource.url") { url }
            registry.add("spring.datasource.username") { System.getProperty(DB_USER) }
            registry.add("spring.datasource.password") { System.getProperty(DB_PASSWORD) }
        }

        private const val DB_URL = "userapi.test.db.url"
        private const val DB_USER = "userapi.test.db.user"
        private const val DB_PASSWORD = "userapi.test.db.password"
    }

    @Autowired
    private lateinit var repo: RateLimitRepo

    @Autowired
    private lateinit var store: JpaRateLimitStore

    private val start: Instant = Instant.parse("2026-01-01T00:00:00Z")
    private val window: Long = 600_000L

    @AfterEach
    fun clear() {
        // The race test runs without a transaction, so nothing rolls it back.
        repo.deleteAll()
    }

    @Test
    fun firstHitStartsAtOne() {
        assertEquals(1, store.recordHit("a", start, window))
    }

    @Test
    fun hitsAccumulateInsideTheWindow() {
        assertEquals(1, store.recordHit("a", start, window))
        assertEquals(2, store.recordHit("a", start.plusSeconds(60), window))
        assertEquals(3, store.recordHit("a", start.plusSeconds(120), window))
    }

    /**
     * The boundary is the security-relevant line. The in-memory rule this
     * replaced reset when `now - start >= window`, so exactly at the window the
     * count must start again, and one millisecond short of it must still count.
     */
    @Test
    fun windowBoundaryMatchesTheInMemoryRuleItReplaced() {
        repeat(4) { store.recordHit("a", start, window) }
        val oneShort = start.plusMillis(window - 1)
        assertEquals(5, store.recordHit("a", oneShort, window), "must still count one ms short")
        val exactly = start.plusMillis(window)
        assertEquals(1, store.recordHit("a", exactly, window), "must reset at exactly the window")
    }

    @Test
    fun keysAreCountedSeparately() {
        repeat(5) { store.recordHit("a", start, window) }
        assertEquals(1, store.recordHit("b", start, window))
    }

    @Test
    fun staleWindowsAreTrimmed() {
        repo.saveAndFlush(RateLimitBucketEntity("cold", start, 9))
        val later = start.plusSeconds(2 * 24 * 60 * 60)
        assertEquals(1, repo.trimStaleWindows(later))
        assertTrue(repo.findById("cold").isEmpty, "trimmed row must not come back")
    }

    /**
     * The reason this is a table and not a map. Every worker commits on its own,
     * so a final count below the total proves two callers read the same value.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun concurrentHitsDoNotLoseUpdates() {
        val threads = 8
        val perThread = 25
        val pool = Executors.newFixedThreadPool(threads)
        val startLine = CountDownLatch(1)
        val finished = CountDownLatch(threads)
        repeat(threads) {
            pool.submit {
                startLine.await()
                repeat(perThread) { store.recordHit("race", start, window) }
                finished.countDown()
            }
        }
        startLine.countDown()
        assertTrue(finished.await(180, TimeUnit.SECONDS), "workers did not finish")
        pool.shutdown()

        assertEquals(
            threads * perThread,
            repo.findById("race").orElseThrow().hits,
            "lost updates: the upsert is not atomic across connections",
        )
    }
}
