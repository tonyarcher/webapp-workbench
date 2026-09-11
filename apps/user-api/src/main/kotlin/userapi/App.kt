package userapi

import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import javax.sql.DataSource
import userapi.accounts.AccountServices
import userapi.accounts.productionAccounts
import userapi.db.dataSource
import userapi.db.ensureDatabase
import userapi.db.migrate
import userapi.http.accountRoutes
import userapi.http.healthRoutes
import userapi.http.installCallLog
import userapi.http.installStatusPages
import userapi.log.log

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
    accounts: AccountServices = productionAccounts(dataSource),
) {
    install(ContentNegotiation) { json() }
    installStatusPages(settings)
    installCallLog(settings)
    healthRoutes(dataSource)
    accountRoutes(settings, accounts)
}
