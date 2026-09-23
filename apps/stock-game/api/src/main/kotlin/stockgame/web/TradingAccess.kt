package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpStatus
import stockgame.trading.AccountService
import stockgame.trading.TradingService

fun ObjectProvider<TradingService>.orOffline(): TradingService =
    ifAvailable ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "database offline")

fun ObjectProvider<AccountService>.orOffline(): AccountService =
    ifAvailable ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "database offline")
