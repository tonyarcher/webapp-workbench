package fitnessapi

import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import javax.sql.DataSource
import fitnessapi.db.dataSource
import fitnessapi.db.ensureDatabase
import fitnessapi.db.migrate
import fitnessapi.http.API_JSON
import fitnessapi.http.healthRoutes
import fitnessapi.http.importRoutes
import fitnessapi.http.installCallLog
import fitnessapi.http.installStatusPages
import fitnessapi.http.patchSampleRoute
import fitnessapi.http.profileRoutes
import fitnessapi.http.sampleRoutes
import fitnessapi.log.log
import fitnessapi.store.FitnessServices
import fitnessapi.store.productionFitness

fun startServer(settings: Settings) {
    val ds = bootDataSource(settings)
    val server = embeddedServer(
        Netty,
        port = settings.port,
        host = "0.0.0.0",
    ) {
        module(settings, ds)
    }
    log(
        service = settings.service,
        level = "info",
        msg = "listening",
        extra = mapOf("port" to settings.port),
        minLevel = settings.logLevel,
    )
    server.start(wait = true)
}

fun bootDataSource(settings: Settings): DataSource? {
    if (settings.databaseUrl.isBlank()) {
        log(
            service = settings.service,
            level = "warn",
            msg = "no-database",
            minLevel = settings.logLevel,
        )
        return null
    }
    ensureDatabase(settings.databaseUrl)
    val ds = dataSource(settings.databaseUrl)
    migrate(ds)
    return ds
}

fun Application.module(
    settings: Settings,
    dataSource: DataSource?,
    fitness: FitnessServices = productionFitness(dataSource),
) {
    install(ContentNegotiation) { json(API_JSON) }
    installStatusPages(settings)
    installCallLog(settings)
    healthRoutes(dataSource)
    profileRoutes(fitness)
    sampleRoutes(fitness)
    patchSampleRoute(fitness)
    importRoutes(fitness)
}
