package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import stockgame.trading.AccountService
import stockgame.trading.TradingService

fun ObjectProvider<TradingService>.orOffline(): TradingService =
    ifAvailable ?: throw ApiException(503, "database offline")

fun ObjectProvider<AccountService>.orOffline(): AccountService =
    ifAvailable ?: throw ApiException(503, "database offline")
