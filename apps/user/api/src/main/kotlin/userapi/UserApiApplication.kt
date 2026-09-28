package userapi

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.event.ApplicationFailedEvent
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.boot.runApplication
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import userapi.log.log
import java.time.Clock
import java.time.Instant

@SpringBootApplication
class UserApiApplication

/**
 * The prod profile runs the framework at WARN, which is deliberate: Spring's own
 * startup chatter is noise. The side effect is that nothing says how long the boot
 * took, so a two-and-a-half minute startup is indistinguishable from a hang in the
 * logs -- there is no line between the banner and the first request.
 *
 * These two events put the duration back, as one JSON line each, through the same
 * helper the request log uses. A boot is either a completed fact or a failure worth
 * grepping for, and neither should need a container restart to observe.
 *
 * A bean, and that is load-bearing: @EventListener only fires for beans Spring
 * manages, so without it these methods compile, pass their unit tests, and never
 * run in production.
 */
@Component
class BootTiming(private val clock: Clock = Clock.systemUTC()) {
    private val startedAt: Instant = clock.instant()

    private fun elapsedMs(): Long = (clock.instant().toEpochMilli() - startedAt.toEpochMilli())

    @EventListener(ApplicationReadyEvent::class)
    fun ready() {
        log(
            service = SERVICE,
            level = "info",
            msg = "ready",
            extra = mapOf("duration_ms" to elapsedMs()),
        )
    }

    @EventListener(ApplicationFailedEvent::class)
    fun onFailed(event: ApplicationFailedEvent) = failed(event.exception)

    /**
     * Takes the throwable rather than the event so the line can be asserted without
     * constructing a Spring event, whose constructor is not a stable API to test against.
     */
    fun failed(cause: Throwable) {
        log(
            service = SERVICE,
            level = "error",
            msg = "boot_failed",
            extra = mapOf(
                "duration_ms" to elapsedMs(),
                "err" to mapOf(
                    "type" to cause.javaClass.simpleName,
                    "message" to (cause.message ?: ""),
                ),
            ),
        )
    }

    private companion object {
        const val SERVICE = "user-api"
    }
}

fun main(args: Array<String>) {
    runApplication<UserApiApplication>(*args)
}
