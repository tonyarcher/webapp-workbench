package stockgame.config

import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import stockgame.log.log
import stockgame.settingsFromEnv

@Component
class ReadyLog {
    @EventListener
    fun onReady(event: ApplicationReadyEvent) {
        val settings = settingsFromEnv(System.getenv())
        if (settings.databaseUrl.isBlank()) {
            log(settings.service, "warn", "no-database", minLevel = settings.logLevel)
        }
        val port = event.applicationContext.environment.getProperty("local.server.port")?.toIntOrNull()
            ?: settings.port
        log(settings.service, "info", "listening", mapOf("port" to port), settings.logLevel)
    }
}
