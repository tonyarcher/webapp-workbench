package stockgame.web

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.domain.SymbolHit
import stockgame.provider.PriceProvider

@RestController
class MarketController(private val provider: PriceProvider) {
    @GetMapping("/quote", headers = ["X-Api-Version=1"])
    fun quote(@RequestParam symbol: String): Quote {
        val s = symbol.trim().uppercase()
        if (s.isEmpty()) throw ApiException(HttpStatus.BAD_REQUEST, "symbol required")
        return provider.getQuote(s)
    }

    @GetMapping("/bars", headers = ["X-Api-Version=1"])
    fun bars(
        @RequestParam symbol: String,
        @RequestParam interval: String,
        @RequestParam from: Long,
        @RequestParam to: Long,
    ): List<Bar> {
        val s = symbol.trim().uppercase()
        if (s.isEmpty()) throw ApiException(HttpStatus.BAD_REQUEST, "symbol required")
        return provider.getBars(s, interval, from, to)
    }

    @GetMapping("/search", headers = ["X-Api-Version=1"])
    fun search(@RequestParam q: String): List<SymbolHit> {
        val query = q.trim()
        if (query.isEmpty()) throw ApiException(HttpStatus.BAD_REQUEST, "q required")
        return provider.search(query)
    }
}
